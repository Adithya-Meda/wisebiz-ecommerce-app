'use strict';

const mongoose = require('mongoose');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('product-svc:db');

async function connect() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/wisebiz_products';

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { error: err.message }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
