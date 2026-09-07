'use strict';

const amqp = require('amqplib');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('order-svc:publisher');

let connection = null;
let channel = null;

const EXCHANGE = process.env.RABBITMQ_ORDER_EXCHANGE || 'order.events';

async function connect() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  // Durable topic exchange — messages survive broker restart
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  connection.on('error', (err) => {
    logger.error('RabbitMQ connection error', { error: err.message });
  });
  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed — will reconnect on next publish');
    connection = null;
    channel = null;
  });

  logger.info('RabbitMQ publisher connected', { exchange: EXCHANGE });
}

/**
 * Publish an order event.
 * @param {string} routingKey  e.g. 'order.placed', 'order.shipped'
 * @param {object} payload
 */
async function publish(routingKey, payload) {
  try {
    if (!channel) {
      await connect();
    }

    const message = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));

    channel.publish(EXCHANGE, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
    });

    logger.info('Event published', { routingKey, orderId: payload.order_id });
  } catch (err) {
    // Log but don't crash the order flow if messaging fails
    logger.error('Failed to publish event', { routingKey, error: err.message });
  }
}

async function close() {
  if (channel) { await channel.close(); }
  if (connection) { await connection.close(); }
}

module.exports = { connect, publish, close };
