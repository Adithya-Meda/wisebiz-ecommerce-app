'use strict';

const authService = require('../services/auth.service');
const { query } = require('../db/pool');
const { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } = require('../utils/cookies');
const { success, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('auth-svc:controller');

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    return success(res, { user }, 'Account created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const deviceInfo = req.headers['user-agent'];

    const { accessToken, refreshToken, user } = await authService.login(
      email,
      password,
      ipAddress,
      deviceInfo
    );

    setAuthCookies(res, accessToken, refreshToken);

    return success(res, { user, access_token: accessToken }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const incomingToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refresh_token;

    if (!incomingToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token required' },
      });
    }

    const { accessToken, refreshToken } = await authService.refreshTokens(
      incomingToken,
      req.ip
    );

    setAuthCookies(res, accessToken, refreshToken);
    return success(res, { access_token: accessToken }, 'Tokens refreshed');
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refresh_token;
    await authService.logout(refreshToken);
    clearAuthCookies(res);
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    // userId comes from X-User-ID header set by the gateway
    const userId = req.headers['x-user-id'];
    await authService.logoutAll(userId);
    clearAuthCookies(res);
    return success(res, {}, 'All sessions terminated');
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const { current_password, new_password } = req.body;
    await authService.changePassword(userId, current_password, new_password);
    clearAuthCookies(res);
    return success(res, {}, 'Password updated. Please log in again.');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { token, userId, email } = await authService.forgotPassword(req.body.email);

    // Publish event to notification-svc — non-blocking, non-fatal
    if (token) {
      const resetUrl = `${process.env.APP_URL || 'https://wisebiz.online'}/auth/reset-password?token=${token}`;
      const amqp = require('amqplib');
      (async () => {
        let conn;
        try {
          conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
          const ch = await conn.createChannel();
          const exchange = process.env.RABBITMQ_ORDER_EXCHANGE || 'order.events';
          await ch.assertExchange(exchange, 'topic', { durable: true });
          ch.publish(
            exchange,
            'user.password_reset',
            Buffer.from(JSON.stringify({
              email,
              reset_url: resetUrl,
              expires_in: '1 hour',
              timestamp: new Date().toISOString(),
            })),
            { persistent: true, contentType: 'application/json' }
          );
          await ch.close();
        } catch (e) {
          logger.warn('Could not publish password reset event', { error: e.message });
        } finally {
          if (conn) { try { await conn.close(); } catch (_) { /* */ } }
        }
      })();
    }

    // Always return success to prevent email enumeration
    return success(
      res,
      {},
      'If an account with that email exists, a reset link has been sent.'
    );
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, new_password } = req.body;
    await authService.resetPassword(token, new_password);
    return success(res, {}, 'Password reset successful. Please log in.');
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User identity missing' } });
    }
    const result = await query(
      'SELECT id, email, first_name, last_name, role, is_verified, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    return success(res, { user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  me,
};
