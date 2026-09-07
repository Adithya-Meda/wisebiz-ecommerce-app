'use strict';

const express = require('express');
const path    = require('path');
const helmet  = require('helmet');
const morgan  = require('morgan');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const { createLogger } = require('@Adithya-Meda/wisebiz-shared');
const router = require('./routes');
const { csrfMiddleware } = require('./middleware/csrf');

const logger = createLogger('frontend-svc');
const app    = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
        styleSrc:   ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc:    ["'self'", 'fonts.gstatic.com'],
        imgSrc:     ["'self'", 'data:', 'images.unsplash.com', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Validate required env vars before accepting any traffic ──────────────────
const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret && process.env.NODE_ENV === 'production') {
  logger.error('FATAL: COOKIE_SECRET env var is not set. Refusing to start in production.');
  process.exit(1);
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(morgan('dev', { stream: { write: (m) => logger.info(m.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(cookieSecret));
app.use(
  session({
    secret: cookieSecret || 'wisebiz-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ── Template locals ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user      = req.session.user      || null;
  res.locals.flash     = req.session.flash     || null;
  res.locals.cartCount = req.session.cartCount || 0;
  if (req.session.flash) { delete req.session.flash; }
  next();
});

// ── CSRF token — generate per-session and expose to all EJS templates ─────────
app.use(csrfMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', router);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).render('error', { title: '404 – Page Not Found', code: 404, message: 'The page you\'re looking for doesn\'t exist.' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(err.status || 500).render('error', {
    title: 'Something went wrong',
    code: err.status || 500,
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
  });
});

module.exports = app;
