'use strict';

const redis = require('../db/redis');
const { AppError, NotFoundError, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('cart-svc:service');
const CART_TTL = parseInt(process.env.CART_TTL_SECONDS || '604800', 10); // 7 days

function cartKey(userId) {
  return `cart:${userId}`;
}

/**
 * Retrieve the full cart for a user.
 * Structure in Redis: Hash  field=productId  value=JSON(CartItem)
 */
async function getCart(userId) {
  const raw = await redis.hgetall(cartKey(userId));
  if (!raw || Object.keys(raw).length === 0) {
    return { items: [], subtotal: 0, item_count: 0 };
  }

  const items = Object.values(raw).map((v) => JSON.parse(v));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const item_count = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    subtotal: parseFloat(subtotal.toFixed(2)),
    item_count,
  };
}

/**
 * Add an item or increment its quantity.
 * If item already exists, quantity is incremented.
 */
async function addItem(userId, itemData) {
  const key = cartKey(userId);
  const { product_id, name, image, price, quantity = 1, variant } = itemData;

  if (quantity < 1 || quantity > 100) {
    throw new AppError('Quantity must be between 1 and 100', 400, 'INVALID_QUANTITY');
  }

  const existing = await redis.hget(key, product_id);
  let item;

  if (existing) {
    item = JSON.parse(existing);
    const newQty = item.quantity + quantity;
    if (newQty > 100) {
      throw new AppError('Maximum quantity per item is 100', 400, 'MAX_QUANTITY_EXCEEDED');
    }
    item.quantity = newQty;
  } else {
    item = { product_id, name, image: image || null, price, quantity, variant: variant || null };
  }

  await redis.hset(key, product_id, JSON.stringify(item));
  await redis.expire(key, CART_TTL);

  logger.info('Cart item added', { userId, product_id });
  return item;
}

/**
 * Update quantity of a specific item. quantity=0 removes it.
 */
async function updateItem(userId, productId, quantity) {
  const key = cartKey(userId);

  if (quantity < 0 || quantity > 100) {
    throw new AppError('Quantity must be between 0 and 100', 400, 'INVALID_QUANTITY');
  }

  if (quantity === 0) {
    return removeItem(userId, productId);
  }

  const existing = await redis.hget(key, productId);
  if (!existing) { throw new NotFoundError('Cart item'); }

  const item = JSON.parse(existing);
  item.quantity = quantity;

  await redis.hset(key, productId, JSON.stringify(item));
  await redis.expire(key, CART_TTL);

  return item;
}

async function removeItem(userId, productId) {
  const removed = await redis.hdel(cartKey(userId), productId);
  if (removed === 0) { throw new NotFoundError('Cart item'); }
  logger.info('Cart item removed', { userId, productId });
}

async function clearCart(userId) {
  await redis.del(cartKey(userId));
  logger.info('Cart cleared', { userId });
}

/**
 * Snapshot items for order creation — returns items and total.
 * Used by order-svc (internal call) and does NOT clear the cart.
 * Cart is cleared after successful payment by order-svc.
 */
async function getCartSnapshot(userId) {
  const cart = await getCart(userId);
  if (cart.items.length === 0) {
    throw new AppError('Cart is empty', 400, 'EMPTY_CART');
  }
  return cart;
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, getCartSnapshot };
