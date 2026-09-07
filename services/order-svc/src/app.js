'use strict';

const express = require('express');
const helmet = require('helmet');
const { errorHandler } = require('@Adithya-Meda/wisebiz-shared');
const orderRoutes = require('./routes/order.routes');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-svc', timestamp: new Date().toISOString() });
});

app.use('/api/orders', orderRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});
app.use(errorHandler);

module.exports = app;
