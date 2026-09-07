'use strict';

/**
 * Tests for shared/storage.js
 * Verifies the factory selects the correct backend and resolves URLs correctly.
 */

const path = require('path');

describe('shared/storage', () => {
  let originalStorage;

  beforeEach(() => {
    originalStorage = process.env.UPLOAD_STORAGE;
    jest.resetModules();
  });

  afterEach(() => {
    process.env.UPLOAD_STORAGE = originalStorage;
    jest.resetModules();
  });

  describe('createUpload()', () => {
    it('throws when subdir is not provided', () => {
      process.env.UPLOAD_STORAGE = 'local';
      const { createUpload } = require('../../shared/storage');
      expect(() => createUpload({ filenameFn: () => 'file.webp' })).toThrow('subdir is required');
    });

    it('throws when filenameFn is not provided', () => {
      process.env.UPLOAD_STORAGE = 'local';
      const { createUpload } = require('../../shared/storage');
      expect(() => createUpload({ subdir: 'avatars' })).toThrow('filenameFn is required');
    });

    it('returns a multer instance for local backend', () => {
      process.env.UPLOAD_STORAGE = 'local';
      process.env.UPLOAD_DIR     = '/tmp/wisebiz-test';
      const { createUpload } = require('../../shared/storage');
      const upload = createUpload({ subdir: 'avatars', filenameFn: () => 'test.webp' });
      // multer instances have a .single() method
      expect(typeof upload.single).toBe('function');
    });

    it('throws for S3 backend when multer-s3 is not installed', () => {
      process.env.UPLOAD_STORAGE = 's3';
      process.env.AWS_S3_BUCKET  = 'my-bucket';

      // Force require to fail for multer-s3
      jest.doMock('multer-s3', () => { throw new Error('Cannot find module'); });

      const { createUpload } = require('../../shared/storage');
      expect(() =>
        createUpload({ subdir: 'avatars', filenameFn: () => 'test.webp' })
      ).toThrow();
    });
  });

  describe('resolveFileUrl()', () => {
    it('returns /uploads/<subdir>/<filename> for local backend', () => {
      process.env.UPLOAD_STORAGE = 'local';
      const { resolveFileUrl } = require('../../shared/storage');

      const mockFile = { path: '/tmp/uploads/avatars/avatar-user-123.webp' };
      const url = resolveFileUrl(mockFile, 'avatars');

      expect(url).toBe('/uploads/avatars/avatar-user-123.webp');
    });

    it('returns file.location for S3 backend', () => {
      process.env.UPLOAD_STORAGE = 's3';
      const { resolveFileUrl } = require('../../shared/storage');

      const mockFile = { location: 'https://my-bucket.s3.ap-south-1.amazonaws.com/uploads/avatars/avatar-123.webp' };
      const url = resolveFileUrl(mockFile, 'avatars');

      expect(url).toBe(mockFile.location);
    });
  });

  describe('deleteFile()', () => {
    it('silently returns when fileUrl is null', async () => {
      process.env.UPLOAD_STORAGE = 'local';
      const { deleteFile } = require('../../shared/storage');
      await expect(deleteFile(null, 'avatars')).resolves.toBeUndefined();
    });

    it('silently handles missing local files without throwing', async () => {
      process.env.UPLOAD_STORAGE = 'local';
      process.env.UPLOAD_DIR     = '/tmp/wisebiz-test-nonexistent';
      const { deleteFile } = require('../../shared/storage');
      // File does not exist — should not throw
      await expect(deleteFile('/uploads/avatars/does-not-exist.webp', 'avatars')).resolves.toBeUndefined();
    });
  });
});
