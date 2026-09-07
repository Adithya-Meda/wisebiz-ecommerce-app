'use strict';

/**
 * Middleware that protects service-to-service internal routes.
 *
 * Every internal call MUST include the header:
 *   X-Internal-Secret: <value of INTERNAL_SECRET env var>
 *
 * Set INTERNAL_SECRET to a strong random string (min 32 chars) in your .env.
 * All services read from the same .env so the value is shared automatically.
 *
 * Usage:
 *   const { internalAuth } = require('../../../shared/internalAuth');
 *   router.get('/internal/snapshot/:userId', internalAuth, ctrl.getSnapshot);
 */
function internalAuth(req, res, next) {
  const secret = process.env.INTERNAL_SECRET;

  if (!secret) {
    // If INTERNAL_SECRET is not configured, block all internal routes in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'MISCONFIGURATION',
          message: 'Internal secret not configured',
        },
      });
    }
    // In development allow through with a warning
    return next();
  }

  const provided = req.headers['x-internal-secret'];
  if (!provided || provided !== secret) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid or missing internal secret' },
    });
  }

  next();
}

module.exports = { internalAuth };
