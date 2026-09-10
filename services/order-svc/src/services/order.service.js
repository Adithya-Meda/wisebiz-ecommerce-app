'use strict';

const axios = require('axios');
const { query, getClient } = require('../db/pool');
const publisher = require('../messaging/publisher');
const { NotFoundError, AppError, ForbiddenError, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('order-svc:service');

const PRODUCT_SVC_URL = process.env.PRODUCT_SVC_URL || 'http://localhost:3003';
const CART_SVC_URL   = process.env.CART_SVC_URL   || 'http://localhost:3004';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

// Allowlist of trusted internal service base URLs.
// Only these origins are permitted for inter-service requests — prevents SSRF
// if an env var is misconfigured or tampered with at the infrastructure level.
const ALLOWED_SERVICE_ORIGINS = new Set(
  [PRODUCT_SVC_URL, CART_SVC_URL].map((u) => new URL(u).origin)
);

function assertTrustedOrigin(url) {
  const origin = new URL(url).origin;
  if (!ALLOWED_SERVICE_ORIGINS.has(origin)) {
    throw new AppError(`Blocked request to untrusted service origin: ${origin}`, 500, 'SSRF_BLOCKED');
  }
}

/**
 * Decrement stock for each item in a placed order.
 * Called after the DB transaction commits — intentionally non-blocking and non-fatal.
 * A product-svc outage must never roll back a valid order.
 */
async function decrementStock(items) {
  const results = await Promise.allSettled(
    items.map((item) => {
      const stockUrl = `${PRODUCT_SVC_URL}/api/products/${item.product_id}/stock`;
      assertTrustedOrigin(stockUrl);
      return axios.patch(
        stockUrl,
        { delta: -item.quantity },
        {
          timeout: 5000,
          headers: { 'X-Internal-Secret': INTERNAL_SECRET },
        }
      );
    })
  );

  results.forEach((result, idx) => {
    if (result.status === 'rejected') {
      logger.warn('Failed to decrement stock for product', {
        productId: items[idx].product_id,
        quantity: items[idx].quantity,
        error: result.reason?.message,
      });
    } else if (result.value?.data?.success === false) {
      logger.warn('Stock decrement returned non-success', {
        productId: items[idx].product_id,
        response: result.value?.data?.error?.message,
      });
    }
  });
}

// Shipping cost tiers (INR)
const SHIPPING_TIERS = [
  { minSubtotal: 0,     maxSubtotal: 499,  cost: 79 },
  { minSubtotal: 500,   maxSubtotal: 999,  cost: 49 },
  { minSubtotal: 1000,  maxSubtotal: Infinity, cost: 0 }, // free shipping
];

function calculateShipping(subtotal) {
  const tier = SHIPPING_TIERS.find((t) => subtotal >= t.minSubtotal && subtotal <= t.maxSubtotal);
  return tier ? tier.cost : 0;
}

function calculateTax(subtotal) {
  return parseFloat((subtotal * 0.18).toFixed(2)); // 18% GST
}

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WB-${ts}-${rand}`;
}

async function createOrder(userId, userEmail, data) {
  // 1. Fetch cart snapshot from cart-svc
  const cartUrl = `${CART_SVC_URL}/api/cart/internal/snapshot/${userId}`;
  assertTrustedOrigin(cartUrl);
  let cartData;
  try {
    const resp = await axios.get(cartUrl, {
      timeout: 5000,
      headers: { 'X-Internal-Secret': INTERNAL_SECRET },
    });
    cartData = resp.data.data;
  } catch {
    throw new AppError('Failed to retrieve cart. Please try again.', 502, 'CART_UNAVAILABLE');
  }

  if (!cartData.items || cartData.items.length === 0) {
    throw new AppError('Your cart is empty', 400, 'EMPTY_CART');
  }

  const subtotal = cartData.subtotal;
  const shipping_amount = calculateShipping(subtotal);
  const tax_amount = calculateTax(subtotal);
  const total_amount = parseFloat((subtotal + shipping_amount + tax_amount).toFixed(2));
  const order_number = generateOrderNumber();

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders
         (order_number, user_id, user_email, subtotal, shipping_amount, tax_amount, total_amount, shipping_address, billing_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        order_number,
        userId,
        userEmail,
        subtotal,
        shipping_amount,
        tax_amount,
        total_amount,
        JSON.stringify(data.shipping_address),
        JSON.stringify(data.billing_address || data.shipping_address),
        data.notes || null,
      ]
    );

    const order = orderResult.rows[0];

    // Insert line items
    for (const item of cartData.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, variant, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          order.id,
          item.product_id,
          item.name,
          item.image || null,
          item.variant ? JSON.stringify(item.variant) : null,
          item.price,
          item.quantity,
          parseFloat((item.price * item.quantity).toFixed(2)),
        ]
      );
    }

    // Record initial status history
    await client.query(
      `INSERT INTO order_status_history (order_id, to_status, changed_by, note)
       VALUES ($1,'pending','system','Order created')`,
      [order.id]
    );

    await client.query('COMMIT');

    // Publish order.placed event for notification-svc (non-blocking)
    await publisher.publish('order.placed', {
      order_id: order.id,
      order_number: order.order_number,
      user_id: userId,
      user_email: userEmail,
      total_amount,
      currency: order.currency,
      items: cartData.items,
    });

    // Decrement product stock (non-blocking, non-fatal)
    decrementStock(cartData.items).catch((err) => {
      logger.error('Unexpected error in decrementStock', { error: err.message });
    });

    logger.info('Order created', { orderId: order.id, orderNumber: order_number, userId });

    return await getOrderById(order.id, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrders(userId, { page = 1, limit = 10, status } = {}) {
  const offset = (page - 1) * limit;
  const params = [userId];
  let statusClause = '';

  if (status) {
    params.push(status);
    statusClause = `AND o.status = $${params.length}`;
  }

  const [ordersResult, countResult] = await Promise.all([
    query(
      `SELECT o.id, o.order_number, o.status, o.total_amount, o.currency,
              o.shipping_address, o.created_at,
              json_agg(json_build_object(
                'product_id', oi.product_id,
                'product_name', oi.product_name,
                'product_image', oi.product_image,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total,
                'variant', oi.variant
              )) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1 ${statusClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM orders WHERE user_id = $1 ${statusClause}`,
      params
    ),
  ]);

  return {
    orders: ordersResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

async function getOrderById(orderId, userId) {
  const result = await query(
    `SELECT o.*,
            json_agg(json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'product_image', oi.product_image,
              'variant', oi.variant,
              'unit_price', oi.unit_price,
              'quantity', oi.quantity,
              'line_total', oi.line_total
            ) ORDER BY oi.id) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orderId]
  );

  if (result.rowCount === 0) { throw new NotFoundError('Order'); }

  const order = result.rows[0];

  // Non-admin users can only view their own orders
  if (userId && order.user_id !== userId) {
    throw new ForbiddenError('Access denied');
  }

  return order;
}

async function updateOrderStatus(orderId, newStatus, changedBy = 'system', note = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status, user_id, user_email, order_number FROM orders WHERE id = $1', [orderId]);
    if (current.rowCount === 0) { throw new NotFoundError('Order'); }

    const order = current.rows[0];
    const fromStatus = order.status;

    await client.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [orderId, fromStatus, newStatus, changedBy, note]
    );

    await client.query('COMMIT');

    // Publish status change event
    const eventMap = {
      confirmed: 'order.confirmed',
      shipped: 'order.shipped',
      delivered: 'order.delivered',
      cancelled: 'order.cancelled',
    };

    if (eventMap[newStatus]) {
      await publisher.publish(eventMap[newStatus], {
        order_id: orderId,
        order_number: order.order_number,
        user_id: order.user_id,
        user_email: order.user_email,
        from_status: fromStatus,
        to_status: newStatus,
      });
    }

    logger.info('Order status updated', { orderId, fromStatus, newStatus });
    return getOrderById(orderId, null);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelOrder(orderId, userId) {
  const order = await getOrderById(orderId, userId);

  const cancellable = ['pending', 'confirmed'];
  if (!cancellable.includes(order.status)) {
    throw new AppError(
      `Order cannot be cancelled in '${order.status}' status`,
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  return updateOrderStatus(orderId, 'cancelled', userId, 'Cancelled by customer');
}

async function getStatusHistory(orderId, userId) {
  // Verify ownership first
  await getOrderById(orderId, userId);

  const result = await query(
    'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  return result.rows;
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getStatusHistory,
};
