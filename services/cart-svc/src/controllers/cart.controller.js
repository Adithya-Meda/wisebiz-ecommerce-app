'use strict';

const cartService = require('../services/cart.service');
const { success } = require('@Adithya-Meda/wisebiz-shared');

async function getCart(req, res, next) {
  try {
    const cart = await cartService.getCart(req.headers['x-user-id']);
    return success(res, { cart });
  } catch (err) { next(err); }
}

async function addItem(req, res, next) {
  try {
    const item = await cartService.addItem(req.headers['x-user-id'], req.body);
    return success(res, { item }, 'Item added to cart', 201);
  } catch (err) { next(err); }
}

async function updateItem(req, res, next) {
  try {
    const item = await cartService.updateItem(
      req.headers['x-user-id'],
      req.params.productId,
      req.body.quantity
    );
    return success(res, { item }, 'Cart updated');
  } catch (err) { next(err); }
}

async function removeItem(req, res, next) {
  try {
    await cartService.removeItem(req.headers['x-user-id'], req.params.productId);
    return success(res, {}, 'Item removed from cart');
  } catch (err) { next(err); }
}

async function clearCart(req, res, next) {
  try {
    await cartService.clearCart(req.headers['x-user-id']);
    return success(res, {}, 'Cart cleared');
  } catch (err) { next(err); }
}

// Internal endpoint called by order-svc
async function getSnapshot(req, res, next) {
  try {
    const snapshot = await cartService.getCartSnapshot(req.params.userId);
    return success(res, snapshot);
  } catch (err) { next(err); }
}

// Internal endpoint called by payment-svc after successful payment
async function clearByUserId(req, res, next) {
  try {
    await cartService.clearCart(req.params.userId);
    return success(res, {}, 'Cart cleared');
  } catch (err) { next(err); }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, getSnapshot, clearByUserId };
