'use strict';

const { Router } = require('express');
const { publicClient, buildClient, extractError } = require('../lib/api');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const router = Router();

// ── Login ─────────────────────────────────────────────────────────────────────
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { title: 'Sign In — WiseBiz', error: null });
});

router.post('/login', redirectIfAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const response = await publicClient.post('/api/auth/login', { email, password });

    if (response.status !== 200) {
      return res.render('auth/login', {
        title: 'Sign In — WiseBiz',
        error: extractError(response),
      });
    }

    const { user, access_token } = response.data.data;
    req.session.user = user;
    req.session.accessToken = access_token;

    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (err) { next(err); }
});

// ── Register ──────────────────────────────────────────────────────────────────
router.get('/register', redirectIfAuth, (req, res) => {
  res.render('auth/register', { title: 'Create Account — WiseBiz', error: null });
});

router.post('/register', redirectIfAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    const response = await publicClient.post('/api/auth/register', {
      email, password, first_name, last_name,
    });

    if (response.status !== 201) {
      return res.render('auth/register', {
        title: 'Create Account — WiseBiz',
        error: extractError(response),
      });
    }

    req.session.flash = { type: 'success', message: 'Account created! Please sign in.' };
    return res.redirect('/auth/login');
  } catch (err) { next(err); }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    await buildClient(req.session.accessToken).post('/api/auth/logout');
  } catch (_err) { /* best-effort */ }

  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
