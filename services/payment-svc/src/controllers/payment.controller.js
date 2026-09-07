'use strict';

const paymentService = require('../services/payment.service');
const { success } = require('@Adithya-Meda/wisebiz-shared');

async function createIntent(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const intent = await paymentService.createPaymentIntent(userId, req.body);
    return success(res, { intent }, 'Payment intent created', 201);
  } catch (err) { next(err); }
}

async function confirmPayment(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const result = await paymentService.confirmPayment(req.params.id, userId);
    const message = result.status === 'succeeded' ? 'Payment successful' : 'Payment failed';
    return success(res, { payment: result }, message);
  } catch (err) { next(err); }
}

async function getIntent(req, res, next) {
  try {
    const intent = await paymentService.getPaymentIntent(req.params.id);
    return success(res, { intent });
  } catch (err) { next(err); }
}

async function getByOrder(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const payment = await paymentService.getPaymentByOrderId(req.params.orderId, userId);
    return success(res, { payment });
  } catch (err) { next(err); }
}

async function createRefund(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const refund = await paymentService.createRefund(req.params.id, userId, req.body);
    return success(res, { refund }, 'Refund initiated');
  } catch (err) { next(err); }
}

module.exports = { createIntent, confirmPayment, getIntent, getByOrder, createRefund };
