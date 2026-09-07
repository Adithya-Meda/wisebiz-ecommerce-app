'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['POSTGRES_HOST', 'POSTGRES_PASSWORD', 'ORDER_DB_NAME', 'CART_SVC_URL']);

const app = require('./app');
const { pool } = require('./db/pool');
const publisher = require('./messaging/publisher');

const logger = createLogger('order-svc');
const PORT = process.env.ORDER_SVC_PORT || 3005;

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connection verified');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL', { error: err.message });
    process.exit(1);
  }

  try {
    await publisher.connect();
  } catch (err) {
    // RabbitMQ is non-critical at startup — orders still work, events just won't fire
    logger.warn('RabbitMQ not available at startup', { error: err.message });
  }

  const server = app.listen(PORT, () => {
    logger.info(`Order Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(async () => {
      await publisher.close();
      await pool.end();
      process.exit(0);
    });
  });
}

start();
