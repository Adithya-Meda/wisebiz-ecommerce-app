'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['COOKIE_SECRET', 'GATEWAY_URL']);

const app = require('./app');

const logger = createLogger('frontend-svc');
const PORT = process.env.FRONTEND_SVC_PORT || 8080;

const server = app.listen(PORT, () => {
  logger.info(`Frontend Service running → http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason?.message || reason });
});
