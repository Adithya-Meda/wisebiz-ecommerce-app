'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['POSTGRES_HOST', 'POSTGRES_PASSWORD', 'USER_DB_NAME', 'INTERNAL_SECRET']);

const app = require('./app');
const { pool } = require('./db/pool');
const logger = createLogger('user-svc');
const PORT = process.env.USER_SVC_PORT || 3002;

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connection verified');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`User Service running on port ${PORT}`);
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
