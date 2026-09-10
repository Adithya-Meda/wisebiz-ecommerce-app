'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const amqp = require('amqplib');
const { query, getClient } = require('../db/pool');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} = require('../utils/jwt');
const { ConflictError, UnauthorizedError, NotFoundError, AppError, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('auth-svc:service');
const BCRYPT_ROUNDS = 12;

/**
 * Publish a one-off event to RabbitMQ without keeping a persistent connection.
 * Used for low-frequency events like user.registered.
 */
async function publishEvent(routingKey, payload) {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const exchange = process.env.RABBITMQ_ORDER_EXCHANGE || 'order.events';
  let conn;
  try {
    conn = await amqp.connect(url);
    const ch = await conn.createChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    ch.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() })),
      { persistent: true, contentType: 'application/json' }
    );
    await ch.close();
    logger.info('Event published', { routingKey });
  } catch (err) {
    logger.warn('Could not publish event (non-critical)', { routingKey, error: err.message });
  } finally {
    if (conn) { try { await conn.close(); } catch { /* */ } }
  }
}

/**
 * Call user-svc to create the profile record after successful registration.
 * Failure is non-fatal — the auth account already exists; profile can be
 * lazily created on first login if needed.
 */
async function createUserProfile(user) {
  try {
    const secret = process.env.INTERNAL_SECRET || '';
    await axios.post(
      `${process.env.USER_SVC_URL || 'http://localhost:3002'}/api/users/internal/create`,
      {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      {
        timeout: 5000,
        headers: { 'X-Internal-Secret': secret },
      }
    );
    logger.info('User profile created in user-svc', { userId: user.id });
  } catch (err) {
    logger.warn('Could not create user profile in user-svc (non-critical)', {
      userId: user.id,
      error: err.message,
    });
  }
}

async function register(data) {
  const { email, password, first_name, last_name } = data;

  // Check uniqueness
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rowCount > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, role, is_verified, created_at`,
    [email.toLowerCase(), password_hash, first_name.trim(), last_name.trim()]
  );

  const user = result.rows[0];
  logger.info('New user registered', { userId: user.id });

  // Create mirrored profile in user-svc (non-blocking, non-fatal)
  await createUserProfile(user);

  // Publish user.registered event so notification-svc sends welcome email
  await publishEvent('user.registered', {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });

  return user;
}

async function login(email, password, ipAddress, deviceInfo) {
  const result = await query(
    'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  // Constant-time comparison to prevent user enumeration
  const dummyHash = '$2a$12$dummy.hash.for.timing.attack.prevention.only';
  const passwordMatch = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !passwordMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.is_active) {
    throw new UnauthorizedError('Account has been deactivated');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, device_info, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, ipAddress, deviceInfo, getRefreshTokenExpiry()]
  );

  logger.info('User logged in', { userId: user.id });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    },
  };
}

async function refreshTokens(incomingRefreshToken, ipAddress) {
  const tokenHash = hashToken(incomingRefreshToken);

  const result = await query(
    `SELECT rt.*, u.id as user_id, u.email, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  const record = result.rows[0];

  if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (!record.is_active) {
    throw new UnauthorizedError('Account has been deactivated');
  }

  // Rotate: revoke old, issue new pair
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);

    const newAccessToken = generateAccessToken({
      id: record.user_id,
      email: record.email,
      role: record.role,
    });
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [record.user_id, newTokenHash, ipAddress, getRefreshTokenExpiry()]
    );

    await client.query('COMMIT');
    logger.info('Tokens rotated', { userId: record.user_id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function logout(refreshToken) {
  if (!refreshToken) { return; }
  const tokenHash = hashToken(refreshToken);
  await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
}

async function logoutAll(userId) {
  await query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);
  logger.info('All sessions revoked', { userId });
}

async function changePassword(userId, currentPassword, newPassword) {
  const result = await query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) { throw new NotFoundError('User'); }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) { throw new UnauthorizedError('Current password is incorrect'); }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

  // Revoke all refresh tokens for security
  await logoutAll(userId);
  logger.info('Password changed', { userId });
}

async function forgotPassword(email) {
  const result = await query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
  // Always return uniform shape to prevent enumeration
  if (result.rowCount === 0) { return { token: null, userId: null, email: null }; }

  const user = result.rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return { token, userId: user.id, email: user.email };
}

async function resetPassword(token, newPassword) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `SELECT prt.*, u.id as user_id
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  const record = result.rows[0];
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      record.user_id,
    ]);
    await client.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [record.id]);
    await client.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [
      record.user_id,
    ]);
    await client.query('COMMIT');
    logger.info('Password reset completed', { userId: record.user_id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
};
