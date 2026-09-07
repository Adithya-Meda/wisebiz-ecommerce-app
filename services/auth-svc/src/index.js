'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const app = require('./app');
const { pool } = require('./db/pool');
const { createLogger, validateEnv } = require('@Adithya-Meda/wisebiz-shared');

validateEnv(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'POSTGRES_HOST', 'POSTGRES_PASSWORD', 'AUTH_DB_NAME', 'COOKIE_SECRET']);

const logger = createLogger('auth-svc');
const PORT = process.env.AUTH_SVC_PORT || 3001;

async function start() {
  // Verify DB connection before accepting traffic
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connection verified');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Auth Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(async () => {
      await pool.end();
      logger.info('Auth Service shut down');
      process.exit(0);
    });
  });
}

start();
