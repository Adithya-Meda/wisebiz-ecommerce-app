'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/order.controller');
const { validate } = require('@Adithya-Meda/wisebiz-shared');
const Joi = require('joi');

const addressSchema = Joi.object({
  full_name: Joi.string().min(2).max(200).required(),
  line1: Joi.string().min(5).max(255).required(),
  line2: Joi.string().max(255).allow('', null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  postal_code: Joi.string().min(3).max(20).required(),
  country: Joi.string().max(100).default('India'),
  phone: Joi.string().pattern(/^\+?[\d\s\-().]{7,20}$/).allow(null, ''),
});

const createOrderSchema = Joi.object({
  shipping_address: addressSchema.required(),
  billing_address: addressSchema.allow(null),
  notes: Joi.string().max(500).allow('', null),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
    .required(),
  note: Joi.string().max(500).allow('', null),
});

const router = Router();

router.post('/', validate(createOrderSchema), ctrl.createOrder);
router.get('/', ctrl.getOrders);
router.get('/:id', ctrl.getOrder);
router.post('/:id/cancel', ctrl.cancelOrder);
router.get('/:id/history', ctrl.getStatusHistory);

// Admin route (role check delegated to gateway)
router.patch('/:id/status', validate(updateStatusSchema), ctrl.updateStatus);

module.exports = router;
