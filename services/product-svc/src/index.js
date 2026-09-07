'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['MONGO_URI', 'INTERNAL_SECRET']);

const app = require('./app');
const { connect } = require('./db/connection');

const logger = createLogger('product-svc');
const PORT = process.env.PRODUCT_SVC_PORT || 3003;

async function start() {
  try {
    await connect();
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('Failed to connect to MongoDB', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Product Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
  });
}

start();
