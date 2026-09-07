'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/payment.controller');
const { validate } = require('@Adithya-Meda/wisebiz-shared');
const Joi = require('joi');

const createIntentSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().default('INR'),
  payment_method: Joi.object({
    type: Joi.string().valid('card', 'upi', 'netbanking', 'wallet').required(),
    card_last4: Joi.when('type', {
      is: 'card',
      then: Joi.string().length(4).pattern(/^\d{4}$/).required(),
      otherwise: Joi.string().allow('', null),
    }),
    upi_id: Joi.when('type', {
      is: 'upi',
      then: Joi.string().pattern(/^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i).required(),
      otherwise: Joi.string().allow('', null),
    }),
    wallet: Joi.when('type', {
      is: 'wallet',
      then: Joi.string().valid('paytm', 'phonepe', 'googlepay', 'amazonpay').required(),
      otherwise: Joi.string().allow('', null),
    }),
  }).required(),
});

const refundSchema = Joi.object({
  amount: Joi.number().positive().precision(2).allow(null),
  reason: Joi.string().max(500).allow('', null),
});

const router = Router();

router.post('/intents', validate(createIntentSchema), ctrl.createIntent);
router.post('/intents/:id/confirm', ctrl.confirmPayment);
router.get('/intents/:id', ctrl.getIntent);
router.get('/by-order/:orderId', ctrl.getByOrder);
router.post('/intents/:id/refund', validate(refundSchema), ctrl.createRefund);

module.exports = router;
