'use strict';

const orderService = require('../services/order.service');
const { success, paginated } = require('@Adithya-Meda/wisebiz-shared');

async function createOrder(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];
    const order = await orderService.createOrder(userId, userEmail, req.body);
    return success(res, { order }, 'Order placed successfully', 201);
  } catch (err) { next(err); }
}

async function getOrders(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const { page = 1, limit = 10, status } = req.query;
    const result = await orderService.getOrders(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
    });
    return paginated(res, result.orders, result.total, result.page, result.limit);
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const order = await orderService.getOrderById(req.params.id, userId);
    return success(res, { order });
  } catch (err) { next(err); }
}

async function cancelOrder(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const order = await orderService.cancelOrder(req.params.id, userId);
    return success(res, { order }, 'Order cancelled');
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const changedBy = req.headers['x-user-email'] || 'admin';
    const order = await orderService.updateOrderStatus(req.params.id, status, changedBy, note);
    return success(res, { order }, 'Order status updated');
  } catch (err) { next(err); }
}

async function getStatusHistory(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const history = await orderService.getStatusHistory(req.params.id, userId);
    return success(res, { history });
  } catch (err) { next(err); }
}

module.exports = { createOrder, getOrders, getOrder, cancelOrder, updateStatus, getStatusHistory };
