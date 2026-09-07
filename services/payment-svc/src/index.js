'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['POSTGRES_HOST', 'POSTGRES_PASSWORD', 'PAYMENT_DB_NAME', 'ORDER_SVC_URL', 'CART_SVC_URL']);

const app = require('./app');
const { pool } = require('./db/pool');

const logger = createLogger('payment-svc');
const PORT = process.env.PAYMENT_SVC_PORT || 3006;

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connection verified');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Payment Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}

start();
