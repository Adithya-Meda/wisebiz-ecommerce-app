'use strict';

/**
 * Avatar upload middleware.
 *
 * Delegates storage backend selection to shared/storage.js.
 * Switching between local disk and S3 requires only changing
 * UPLOAD_STORAGE in .env — no code changes needed here.
 */

const { createUpload } = require('@Adithya-Meda/wisebiz-shared');

const upload = createUpload({
  subdir: 'avatars',
  filenameFn: (req) => {
    const userId = req.headers['x-user-id'] || 'unknown';
    return `avatar-${userId}-${Date.now()}.webp`;
  },
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
});

module.exports = { upload };
