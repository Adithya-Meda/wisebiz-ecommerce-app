'use strict';

const sharp = require('sharp');
const { query, getClient } = require('../db/pool');
const { NotFoundError, createLogger, resolveFileUrl, deleteFile, STORAGE_BACKEND } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('user-svc:service');

// ─── Profile ─────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const result = await query(
    'SELECT id, email, first_name, last_name, phone, date_of_birth, gender, avatar_url, bio, created_at, updated_at FROM profiles WHERE id = $1',
    [userId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Profile'); }
  return result.rows[0];
}

/**
 * Called by auth-svc after a successful registration (internal service call).
 * Creates the profile record mirroring the auth user.
 */
async function createProfile(data) {
  const { id, email, first_name, last_name } = data;
  const existing = await query('SELECT id FROM profiles WHERE id = $1', [id]);
  if (existing.rowCount > 0) { return existing.rows[0]; }

  const result = await query(
    `INSERT INTO profiles (id, email, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, email, first_name, last_name]
  );
  return result.rows[0];
}

async function updateProfile(userId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['first_name', 'last_name', 'phone', 'date_of_birth', 'gender', 'bio'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) { return getProfile(userId); }

  values.push(userId);
  const result = await query(
    `UPDATE profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (result.rowCount === 0) { throw new NotFoundError('Profile'); }
  return result.rows[0];
}

async function uploadAvatar(userId, file) {
  let avatarUrl;

  if (STORAGE_BACKEND === 'local') {
    // For local storage: the file is already on disk; process with sharp in-place.
    const fs = require('fs');
    const outputPath = file.path.replace(/\.[^.]+$/, '.webp');

    await sharp(file.path)
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Remove the original upload if sharp wrote to a different path
    if (file.path !== outputPath && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Patch file object so resolveFileUrl reads the correct processed filename
    file.path = outputPath;
    avatarUrl = resolveFileUrl(file, 'avatars');
  } else {
    // For S3: multer-s3 already uploaded the raw file; resolve the location URL.
    // Sharp processing on S3 uploads would require a stream-based pipeline —
    // acceptable trade-off for a portfolio project; add if needed.
    avatarUrl = resolveFileUrl(file, 'avatars');
  }

  // Delete previous avatar (non-fatal)
  const current = await query('SELECT avatar_url FROM profiles WHERE id = $1', [userId]);
  if (current.rows[0]?.avatar_url) {
    await deleteFile(current.rows[0].avatar_url, 'avatars');
  }

  const result = await query(
    'UPDATE profiles SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url',
    [avatarUrl, userId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Profile'); }

  logger.info('Avatar updated', { userId, backend: STORAGE_BACKEND });
  return { avatar_url: result.rows[0].avatar_url };
}

// ─── Addresses ───────────────────────────────────────────────────────────────

async function getAddresses(userId) {
  const result = await query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
    [userId]
  );
  return result.rows;
}

async function getAddress(userId, addressId) {
  const result = await query(
    'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
    [addressId, userId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Address'); }
  return result.rows[0];
}

async function createAddress(userId, data) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // If new address is set as default, unset all others
    if (data.is_default) {
      await client.query(
        'UPDATE addresses SET is_default = false WHERE user_id = $1',
        [userId]
      );
    }

    const result = await client.query(
      `INSERT INTO addresses (user_id, label, full_name, line1, line2, city, state, postal_code, country, phone, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        userId,
        data.label,
        data.full_name,
        data.line1,
        data.line2 || null,
        data.city,
        data.state,
        data.postal_code,
        data.country,
        data.phone || null,
        data.is_default,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateAddress(userId, addressId, data) {
  // Verify ownership
  await getAddress(userId, addressId);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (data.is_default) {
      await client.query(
        'UPDATE addresses SET is_default = false WHERE user_id = $1',
        [userId]
      );
    }

    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = [
      'label', 'full_name', 'line1', 'line2', 'city',
      'state', 'postal_code', 'country', 'phone', 'is_default',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) { return getAddress(userId, addressId); }

    values.push(addressId, userId);
    const result = await client.query(
      `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteAddress(userId, addressId) {
  const result = await query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
    [addressId, userId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Address'); }
}

async function setDefaultAddress(userId, addressId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    const result = await client.query(
      'UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [addressId, userId]
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError('Address');
    }
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

async function getWishlist(userId) {
  const result = await query(
    'SELECT * FROM wishlists WHERE user_id = $1 ORDER BY added_at DESC',
    [userId]
  );
  return result.rows;
}

async function addToWishlist(userId, data) {
  const result = await query(
    `INSERT INTO wishlists (user_id, product_id, product_name, product_price, product_image)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, product_id) DO UPDATE
       SET product_name = EXCLUDED.product_name,
           product_price = EXCLUDED.product_price,
           product_image = EXCLUDED.product_image
     RETURNING *`,
    [userId, data.product_id, data.product_name, data.product_price || null, data.product_image || null]
  );
  return result.rows[0];
}

async function removeFromWishlist(userId, productId) {
  const result = await query(
    'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2 RETURNING id',
    [userId, productId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Wishlist item'); }
}

module.exports = {
  getProfile,
  createProfile,
  updateProfile,
  uploadAvatar,
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
