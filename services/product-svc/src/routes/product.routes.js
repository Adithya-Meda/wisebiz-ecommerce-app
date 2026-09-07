'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/product.controller');
const { validate, internalAuth } = require('@Adithya-Meda/wisebiz-shared');
const {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  reviewSchema,
  productQuerySchema,
} = require('../schemas/product.schemas');

const router = Router();

// ─── Category routes ──────────────────────────────────────────────────────────
router.get('/categories', ctrl.getCategories);
router.post('/categories', validate(createCategorySchema), ctrl.createCategory);

// ─── Special collections ──────────────────────────────────────────────────────
router.get('/featured', ctrl.getFeatured);
router.get('/new-arrivals', ctrl.getNewArrivals);

// ─── Product CRUD ─────────────────────────────────────────────────────────────
router.get('/', validate(productQuerySchema, 'query'), ctrl.getProducts);
router.post('/', validate(createProductSchema), ctrl.createProduct);

router.get('/:slug', ctrl.getProductBySlug);
router.put('/:id', validate(updateProductSchema), ctrl.updateProduct);
router.delete('/:id', ctrl.deleteProduct);

// ─── Stock (internal — called by order-svc, guarded by shared secret) ─────────
router.patch('/:id/stock', internalAuth, ctrl.updateStock);

// ─── Reviews (protected via gateway) ─────────────────────────────────────────
router.post('/:id/reviews', validate(reviewSchema), ctrl.addReview);

// ─── Related products ─────────────────────────────────────────────────────────
router.get('/:id/related', ctrl.getRelated);

module.exports = router;
