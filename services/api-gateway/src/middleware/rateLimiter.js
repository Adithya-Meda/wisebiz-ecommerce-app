'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min default
const max      = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

const standardHandler = (_req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

/** Global — applied to every route as a baseline */
const globalRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  keyGenerator: (req) => req.ip,
});

/**
 * Auth limiter — covers login, register, forgot-password.
 * 20 requests per 15 min per IP.
 * Previously had `skip` for /refresh which left that endpoint unlimited — removed.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  keyGenerator: (req) => req.ip,
});

/**
 * Refresh token limiter — separate, tighter budget.
 * 30 refreshes per 15 min per IP is generous for real users but blocks harvesting.
 * Applied specifically to POST /api/auth/refresh in proxy.js.
 */
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  keyGenerator: (req) => req.ip,
});

/**
 * Password reset limiter — very tight to prevent token farming.
 * 5 requests per hour per IP.
 */
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  keyGenerator: (req) => req.ip,
});

module.exports = {
  globalRateLimiter,
  authRateLimiter,
  refreshRateLimiter,
  passwordResetRateLimiter,
};
