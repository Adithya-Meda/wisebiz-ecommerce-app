'use strict';

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { query, getClient } = require('../db/pool');
const { AppError, NotFoundError, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('payment-svc:service');

// ─── Mock gateway simulator ───────────────────────────────────────────────────
// Simulates a real payment gateway (Stripe-style) with realistic outcomes.
// Card numbers ending in specific digits control the outcome for demos.
const MOCK_GATEWAY_OUTCOMES = {
  '0000': { status: 'succeeded', delay: 800 },
  '1111': { status: 'failed',    delay: 600, reason: 'Insufficient funds' },
  '2222': { status: 'failed',    delay: 400, reason: 'Card declined' },
  '3333': { status: 'failed',    delay: 300, reason: 'Invalid CVV' },
};

async function simulateGateway(paymentMethod, amount) {
  const last4 = paymentMethod?.card_last4 || '0000';
  const outcome = MOCK_GATEWAY_OUTCOMES[last4] || { status: 'succeeded', delay: 700 };

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, outcome.delay));

  return {
    gateway_ref: `mock_pi_${uuidv4().replace(/-/g, '')}`,
    status: outcome.status,
    failure_reason: outcome.failure_reason || null,
  };
}

// ─── Payment intent lifecycle ─────────────────────────────────────────────────

async function createPaymentIntent(userId, data) {
  const { order_id, amount, currency = 'INR', payment_method } = data;

  // Prevent duplicate payment for same order
  const existing = await query(
    `SELECT id, status FROM payment_intents
     WHERE order_id = $1 AND status IN ('created','processing','succeeded')`,
    [order_id]
  );
  if (existing.rowCount > 0) {
    const intent = existing.rows[0];
    if (intent.status === 'succeeded') {
      throw new AppError('This order has already been paid', 409, 'ALREADY_PAID');
    }
    // Return existing intent so frontend can retry
    return getPaymentIntent(intent.id);
  }

  const result = await query(
    `INSERT INTO payment_intents (order_id, user_id, amount, currency, payment_method, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [order_id, userId, amount, currency, payment_method.type, JSON.stringify({ payment_method })]
  );

  logger.info('Payment intent created', { intentId: result.rows[0].id, orderId: order_id });
  return result.rows[0];
}

async function confirmPayment(intentId, userId) {
  const intent = await getPaymentIntent(intentId);

  if (intent.user_id !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }
  if (intent.status !== 'created') {
    throw new AppError(
      `Payment intent is already in '${intent.status}' state`,
      409, 'INVALID_STATE'
    );
  }

  // Move to processing
  await query('UPDATE payment_intents SET status = $1 WHERE id = $2', ['processing', intentId]);

  // Call mock gateway
  const metadata = intent.metadata || {};
  const gatewayResult = await simulateGateway(metadata.payment_method, intent.amount);

  const newStatus = gatewayResult.status;
  await query(
    `UPDATE payment_intents
     SET status = $1, gateway_ref = $2, failure_reason = $3
     WHERE id = $4`,
    [newStatus, gatewayResult.gateway_ref, gatewayResult.failure_reason, intentId]
  );

  const updated = await getPaymentIntent(intentId);

  if (newStatus === 'succeeded') {
    // Notify order-svc to confirm the order
    try {
      await axios.patch(
        `${process.env.ORDER_SVC_URL || 'http://localhost:3005'}/api/orders/${intent.order_id}/status`,
        { status: 'confirmed', note: `Payment confirmed. Ref: ${gatewayResult.gateway_ref}` },
        { timeout: 5000 }
      );
    } catch (err) {
      logger.warn('Could not update order status after payment', { error: err.message });
    }

    // Clear customer cart after successful payment
    // Uses the internal clear endpoint with X-Internal-Secret + user identity header
    try {
      await axios.delete(
        `${process.env.CART_SVC_URL || 'http://localhost:3004'}/api/cart/internal/clear/${intent.user_id}`,
        {
          timeout: 3000,
          headers: { 'X-Internal-Secret': process.env.INTERNAL_SECRET || '' },
        }
      );
    } catch (_err) {
      // Non-critical — cart TTL will expire naturally
    }

    logger.info('Payment succeeded', { intentId, orderId: intent.order_id });
  } else {
    logger.warn('Payment failed', {
      intentId,
      reason: gatewayResult.failure_reason,
      orderId: intent.order_id,
    });
  }

  return updated;
}

async function getPaymentIntent(intentId) {
  const result = await query('SELECT * FROM payment_intents WHERE id = $1', [intentId]);
  if (result.rowCount === 0) { throw new NotFoundError('Payment intent'); }
  return result.rows[0];
}

async function getPaymentByOrderId(orderId, userId) {
  const result = await query(
    'SELECT * FROM payment_intents WHERE order_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
    [orderId, userId]
  );
  if (result.rowCount === 0) { throw new NotFoundError('Payment'); }
  return result.rows[0];
}

async function createRefund(intentId, userId, data) {
  const intent = await getPaymentIntent(intentId);

  if (intent.user_id !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }
  if (intent.status !== 'succeeded') {
    throw new AppError('Only succeeded payments can be refunded', 409, 'INVALID_STATE');
  }

  const refundAmount = data.amount || intent.amount;
  if (refundAmount > intent.amount) {
    throw new AppError('Refund amount exceeds payment amount', 400, 'INVALID_AMOUNT');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Simulate refund gateway call (always succeeds in mock)
    await new Promise((resolve) => setTimeout(resolve, 500));
    const gatewayRef = `mock_re_${uuidv4().replace(/-/g, '')}`;

    const refund = await client.query(
      `INSERT INTO refunds (payment_intent_id, amount, reason, status, gateway_ref)
       VALUES ($1,$2,$3,'succeeded',$4) RETURNING *`,
      [intentId, refundAmount, data.reason || 'Customer request', gatewayRef]
    );

    await client.query(
      'UPDATE payment_intents SET status = $1 WHERE id = $2',
      ['refunded', intentId]
    );

    await client.query('COMMIT');
    logger.info('Refund processed', { intentId, amount: refundAmount });
    return refund.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getPaymentIntent,
  getPaymentByOrderId,
  createRefund,
};
