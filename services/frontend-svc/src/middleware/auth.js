'use strict';

/**
 * Require authenticated session — redirect to login if not present.
 */
function requireAuth(req, res, next) {
  if (req.session.user && req.session.accessToken) {
    return next();
  }
  req.session.flash = { type: 'warning', message: 'Please log in to continue.' };
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

/**
 * Redirect already-authenticated users away from login/register pages.
 */
function redirectIfAuth(req, res, next) {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth };
