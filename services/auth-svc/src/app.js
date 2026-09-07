'use strict';

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('@Adithya-Meda/wisebiz-shared');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-svc', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

app.use(errorHandler);

module.exports = app;
