'use strict';

const crypto = require('crypto');

/**
 * Lightweight CSRF protection using the synchroniser-token pattern.
 *
 * How it works:
 *  1. csrfMiddleware() generates a per-session token, stores it in req.session.csrfToken,
 *     and exposes it as res.locals.csrfToken for EJS templates.
 *  2. Every state-changing form must include <input type="hidden" name="_csrf" value="<%= csrfToken %>">
 *  3. verifyCsrf() checks the submitted _csrf value against the session token.
 *
 * AJAX requests using fetch() must send the token in the X-CSRF-Token header.
 *
 * This avoids the deprecated `csurf` package while providing equivalent protection.
 */

function csrfMiddleware(req, res, next) {
  // Generate once per session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  // Expose to all EJS templates
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

/**
 * Verify CSRF token on state-changing requests.
 * Accepts token from form body (_csrf) or X-CSRF-Token header (for AJAX).
 */
function verifyCsrf(req, res, next) {
  // Only enforce on state-changing methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const submittedToken = req.body?._csrf || req.headers['x-csrf-token'];

  if (!sessionToken || !submittedToken) {
    return res.status(403).render('error', {
      title: 'Forbidden',
      code: 403,
      message: 'Invalid or missing security token. Please refresh the page and try again.',
    });
  }

  // Constant-time comparison to prevent timing attacks
  const sessionBuf   = Buffer.from(sessionToken,   'hex');
  const submittedBuf = Buffer.from(submittedToken, 'hex');

  if (
    sessionBuf.length !== submittedBuf.length ||
    !crypto.timingSafeEqual(sessionBuf, submittedBuf)
  ) {
    return res.status(403).render('error', {
      title: 'Forbidden',
      code: 403,
      message: 'Security token mismatch. Please refresh the page and try again.',
    });
  }

  next();
}

module.exports = { csrfMiddleware, verifyCsrf };
