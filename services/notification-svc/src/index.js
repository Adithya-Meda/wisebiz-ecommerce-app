'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { validateEnv, createLogger } = require('@Adithya-Meda/wisebiz-shared');
validateEnv(['RABBITMQ_URL']);

const express = require('express');
const consumer = require('./messaging/consumer');

const logger = createLogger('notification-svc');
const PORT = process.env.NOTIFICATION_SVC_PORT || 3007;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-svc', timestamp: new Date().toISOString() });
});

async function start() {
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      await consumer.connect();
      logger.info('RabbitMQ consumer connected');
      break;
    } catch (err) {
      retries++;
      logger.warn(`RabbitMQ not ready (attempt ${retries}/${maxRetries}), retrying in 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  if (retries === maxRetries) {
    logger.error('Could not connect to RabbitMQ after max retries');
    // Still start the HTTP health endpoint even if RabbitMQ is unavailable
  }

  const server = app.listen(PORT, () => {
    logger.info(`Notification Service running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(async () => {
      await consumer.close();
      process.exit(0);
    });
  });
}

start();
