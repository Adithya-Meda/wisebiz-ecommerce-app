'use strict';

const amqp = require('amqplib');
const { sendMail } = require('../mailer/transporter');
const templates = require('../mailer/templates');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('notification-svc:consumer');

const EXCHANGE     = process.env.RABBITMQ_ORDER_EXCHANGE    || 'order.events';
const QUEUE        = process.env.RABBITMQ_NOTIFICATION_QUEUE || 'notifications';
const DLX          = `${EXCHANGE}.dlx`;   // dead-letter exchange
const DLQ          = `${QUEUE}.dlq`;      // dead-letter queue

const ROUTING_KEYS = [
  'order.placed',
  'order.confirmed',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'user.registered',
  'user.password_reset',
];

let connection = null;
let channel    = null;

// ─── Event handlers ──────────────────────────────────────────────────────────

const HANDLER_MAP = {
  'order.placed':        handleOrderPlaced,
  'order.confirmed':     handleOrderConfirmed,
  'order.shipped':       handleOrderShipped,
  'order.delivered':     handleOrderDelivered,
  'order.cancelled':     handleOrderCancelled,
  'user.registered':     handleUserRegistered,
  'user.password_reset': handlePasswordReset,
};

async function handleOrderPlaced(payload) {
  const tpl = templates.orderPlaced(payload);
  await sendMail({ to: payload.user_email, ...tpl });
}

async function handleOrderConfirmed(payload) {
  // Confirmation email is sent at order.placed to avoid duplicates
  logger.info('Order confirmed event received', { orderId: payload.order_id });
}

async function handleOrderShipped(payload) {
  const tpl = templates.orderShipped(payload);
  await sendMail({ to: payload.user_email, ...tpl });
}

async function handleOrderDelivered(payload) {
  const tpl = templates.orderDelivered(payload);
  await sendMail({ to: payload.user_email, ...tpl });
}

async function handleOrderCancelled(payload) {
  const tpl = templates.orderCancelled(payload);
  await sendMail({ to: payload.user_email, ...tpl });
}

async function handleUserRegistered(payload) {
  const tpl = templates.welcomeEmail(payload);
  await sendMail({ to: payload.email, ...tpl });
}

async function handlePasswordReset(payload) {
  const tpl = templates.passwordReset(payload);
  await sendMail({ to: payload.email, ...tpl });
}

// ─── Broker setup ────────────────────────────────────────────────────────────

async function connect() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  connection = await amqp.connect(url);
  channel    = await connection.createChannel();

  // 1. Dead-letter exchange — fanout, catches all rejected messages
  await channel.assertExchange(DLX, 'fanout', { durable: true });

  // 2. Dead-letter queue — bound to DLX, holds unprocessable messages for inspection
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, '');
  logger.info('Dead-letter queue ready', { dlx: DLX, dlq: DLQ });

  // 3. Main exchange (topic) — mirrors the same exchange used by order-svc / auth-svc
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // 4. Main queue — durable, with DLX configured so rejected messages route to DLQ
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX,
    },
  });

  // 5. Bind each routing key to the main queue
  for (const key of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE, EXCHANGE, key);
    logger.info('Queue bound', { queue: QUEUE, routingKey: key });
  }

  // 6. Process one message at a time — prevents overwhelming the mail service
  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) { return; }

    const routingKey = msg.fields.routingKey;
    let payload;

    // Parse failure → nack without requeue; message routes to DLQ via x-dead-letter-exchange
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      logger.error('Failed to parse message — routing to DLQ', {
        routingKey,
        error: parseErr.message,
        rawContent: msg.content.toString().slice(0, 200),
      });
      channel.nack(msg, false, false);
      return;
    }

    const handler = HANDLER_MAP[routingKey];
    if (!handler) {
      logger.warn('No handler for routing key — acking to avoid poison-pill loop', { routingKey });
      channel.ack(msg);
      return;
    }

    try {
      logger.info('Processing event', { routingKey, payloadKeys: Object.keys(payload) });
      await handler(payload);
      channel.ack(msg);
      logger.info('Event processed successfully', { routingKey });
    } catch (err) {
      logger.error('Error processing event', { routingKey, error: err.message });

      if (msg.fields.redelivered) {
        // Second attempt also failed — send to DLQ for manual inspection
        logger.warn('Redelivered message failed again — routing to DLQ', { routingKey });
        channel.nack(msg, false, false);
      } else {
        // First failure — requeue once for a single retry
        channel.nack(msg, false, true);
      }
    }
  });

  connection.on('error', (err) => {
    logger.error('RabbitMQ connection error', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed — reconnecting in 5s');
    connection = null;
    channel    = null;
    setTimeout(connect, 5000);
  });

  logger.info('RabbitMQ consumer started', { exchange: EXCHANGE, queue: QUEUE, dlq: DLQ });
}

async function close() {
  if (channel)    { try { await channel.close(); }    catch { /* */ } }
  if (connection) { try { await connection.close(); } catch { /* */ } }
}

module.exports = { connect, close };
