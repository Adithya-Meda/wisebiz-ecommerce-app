'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['REDIS_HOST', 'INTERNAL_SECRET']);

const app = require('./app');
const redis = require('./db/redis');

const logger = createLogger('cart-svc');
const PORT = process.env.CART_SVC_PORT || 3004;

async function start() {
  try {
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Cart Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(async () => {
      await redis.quit();
      process.exit(0);
    });
  });
}

start();
