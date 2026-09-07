'use strict';

/**
 * Storage abstraction for file uploads.
 *
 * Selects the backend based on UPLOAD_STORAGE environment variable:
 *   UPLOAD_STORAGE=local  → multer disk storage (default; files in UPLOAD_DIR)
 *   UPLOAD_STORAGE=s3     → multer-s3 storage   (requires AWS_S3_BUCKET + AWS credentials)
 *
 * Both backends expose the same interface so upload.js never changes when switching.
 *
 * Local storage:
 *   - Files written to  <UPLOAD_DIR>/<subdir>/<filename>
 *   - Served statically via express.static in each service's app.js
 *
 * S3 storage:
 *   - Files written to  s3://<AWS_S3_BUCKET>/<S3_KEY_PREFIX>/<subdir>/<filename>
 *   - req.file.location is the public S3 URL after upload
 *   - Requires: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *     (or an IAM role when running on EC2/ECS/EKS)
 */

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { AppError } = require('./errors');

const STORAGE_BACKEND = (process.env.UPLOAD_STORAGE || 'local').toLowerCase();

// ─── Local disk storage ───────────────────────────────────────────────────────

function buildLocalStorage(subdir, filenameFn) {
  const uploadRoot = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '../uploads');

  const destDir = path.join(uploadRoot, subdir);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename:    (req, file, cb)  => cb(null, filenameFn(req, file)),
  });
}

/**
 * Get the public URL for a locally stored file.
 * e.g.  /uploads/avatars/avatar-<userId>-<ts>.webp
 */
function localFileUrl(subdir, filename) {
  return `/uploads/${subdir}/${filename}`;
}

// ─── S3 storage ───────────────────────────────────────────────────────────────

function buildS3Storage(subdir, filenameFn) {
  // Lazy-require multer-s3 and @aws-sdk/client-s3 only when S3 backend is selected.
  // This avoids a hard dependency for projects that stay on local storage.
  let multerS3, S3Client;
  try {
    multerS3 = require('multer-s3');
    const { S3Client: _S3Client } = require('@aws-sdk/client-s3');
    S3Client = _S3Client;
  } catch {
    throw new Error(
      'S3 storage backend requires multer-s3 and @aws-sdk/client-s3. ' +
      'Run: npm install multer-s3 @aws-sdk/client-s3'
    );
  }

  const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  const bucket = process.env.AWS_S3_BUCKET;
  const keyPrefix = process.env.S3_KEY_PREFIX || 'uploads';

  if (!bucket) {
    throw new Error('AWS_S3_BUCKET environment variable is required for S3 storage backend');
  }

  return multerS3({
    s3,
    bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (_req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(null, `${keyPrefix}/${subdir}/${filenameFn(req, file)}`);
    },
  });
}

// ─── Public factory ───────────────────────────────────────────────────────────

/**
 * Create a multer instance configured for the active storage backend.
 *
 * @param {object} options
 * @param {string}   options.subdir      - Subdirectory under the upload root (e.g. 'avatars')
 * @param {Function} options.filenameFn  - (req, file) => string — generates the filename/key
 * @param {string[]} options.allowedMimeTypes - Allowed MIME types (default: common images)
 * @param {number}   options.maxSizeMB   - Max file size in MB (default: from MAX_FILE_SIZE_MB env or 5)
 * @returns {multer.Multer}
 */
function createUpload({
  subdir,
  filenameFn,
  allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
} = {}) {
  if (!subdir)     { throw new Error('createUpload: subdir is required'); }
  if (!filenameFn) { throw new Error('createUpload: filenameFn is required'); }

  let storage;
  if (STORAGE_BACKEND === 's3') {
    storage = buildS3Storage(subdir, filenameFn);
  } else {
    storage = buildLocalStorage(subdir, filenameFn);
  }

  const fileFilter = (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        `File type not allowed. Accepted: ${allowedMimeTypes.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      ));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });
}

/**
 * Resolve the public URL for an uploaded file.
 * - Local: returns the /uploads/<subdir>/<filename> path
 * - S3:    returns req.file.location (set by multer-s3 automatically)
 *
 * @param {object} file - The req.file object from multer
 * @param {string} subdir - Subdirectory (only used for local backend)
 * @returns {string} Public URL or path
 */
function resolveFileUrl(file, subdir) {
  if (STORAGE_BACKEND === 's3') {
    // multer-s3 sets file.location to the full S3 URL
    return file.location;
  }
  return localFileUrl(subdir, path.basename(file.path));
}

/**
 * Delete a file from the active storage backend.
 * - Local: unlinks the file from disk.
 * - S3:    sends a DeleteObject command.
 *
 * Silent on missing files — safe to call even if file doesn't exist.
 *
 * @param {string} fileUrl - The public URL/path previously returned by resolveFileUrl
 * @param {string} subdir  - Subdirectory (local backend uses this to reconstruct the path)
 */
async function deleteFile(fileUrl, subdir) {
  if (!fileUrl) { return; }

  if (STORAGE_BACKEND === 's3') {
    try {
      const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      // Extract the S3 key from the URL: everything after the bucket hostname
      const url = new URL(fileUrl);
      const key = url.pathname.replace(/^\//, '');
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }));
    } catch {
      // Non-fatal — stale S3 objects don't break the app
    }
  } else {
    try {
      const uploadRoot = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../uploads');
      // fileUrl is like /uploads/avatars/avatar-xxx.webp; strip the leading /uploads/
      const relative = fileUrl.replace(/^\/uploads\//, '');
      const fullPath  = path.join(uploadRoot, relative);
      if (fs.existsSync(fullPath)) { fs.unlinkSync(fullPath); }
    } catch {
      // Non-fatal
    }
  }
}

module.exports = { createUpload, resolveFileUrl, deleteFile, STORAGE_BACKEND };
