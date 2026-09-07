'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/cart.controller');
const { validate, internalAuth } = require('@Adithya-Meda/wisebiz-shared');
const Joi = require('joi');

const addItemSchema = Joi.object({
  product_id: Joi.string().required(),
  name: Joi.string().max(300).required(),
  image: Joi.string().uri().allow('', null),
  price: Joi.number().positive().precision(2).required(),
  quantity: Joi.number().integer().min(1).max(100).default(1),
  variant: Joi.object({
    name: Joi.string(),
    value: Joi.string(),
  }).allow(null),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).max(100).required(),
});

const router = Router();

router.get('/', ctrl.getCart);
router.post('/items', validate(addItemSchema), ctrl.addItem);
router.put('/items/:productId', validate(updateItemSchema), ctrl.updateItem);
router.delete('/items/:productId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);

// ── Internal routes (service-to-service only — protected by X-Internal-Secret) ───
router.get('/internal/snapshot/:userId', internalAuth, ctrl.getSnapshot);
router.delete('/internal/clear/:userId', internalAuth, ctrl.clearByUserId);

module.exports = router;
