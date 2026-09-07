'use strict';

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { errorHandler } = require('@Adithya-Meda/wisebiz-shared');
const userRoutes = require('./routes/user.routes');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded avatars as static files
app.use(
  '/uploads',
  express.static(
    path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads'))
  )
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'user-svc', timestamp: new Date().toISOString() });
});

app.use('/api/users', userRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

app.use(errorHandler);

module.exports = app;
