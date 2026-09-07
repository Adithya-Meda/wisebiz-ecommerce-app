'use strict';

const service = require('../services/product.service');
const { success, paginated } = require('@Adithya-Meda/wisebiz-shared');

// ─── Categories ───────────────────────────────────────────────────────────────

async function getCategories(req, res, next) {
  try {
    const categories = await service.getAllCategories();
    return success(res, { categories });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const category = await service.createCategory(req.body);
    return success(res, { category }, 'Category created', 201);
  } catch (err) { next(err); }
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function getProducts(req, res, next) {
  try {
    const { products, total, page, limit } = await service.getProducts(req.query);
    return paginated(res, products, total, page, limit);
  } catch (err) { next(err); }
}

async function getProductBySlug(req, res, next) {
  try {
    const product = await service.getProductBySlug(req.params.slug);
    return success(res, { product });
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    const product = await service.createProduct(req.body);
    return success(res, { product }, 'Product created', 201);
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    const product = await service.updateProduct(req.params.id, req.body);
    return success(res, { product }, 'Product updated');
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    await service.deleteProduct(req.params.id);
    return success(res, {}, 'Product removed');
  } catch (err) { next(err); }
}

async function updateStock(req, res, next) {
  try {
    const { delta } = req.body;
    const result = await service.updateStock(req.params.id, delta);
    return success(res, result, 'Stock updated');
  } catch (err) { next(err); }
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function addReview(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    const userName = req.headers['x-user-email'] || 'Anonymous';
    const review = await service.addReview(req.params.id, userId, userName, req.body);
    return success(res, { review }, 'Review submitted', 201);
  } catch (err) { next(err); }
}

// ─── Specials ─────────────────────────────────────────────────────────────────

async function getFeatured(req, res, next) {
  try {
    const products = await service.getFeaturedProducts(parseInt(req.query.limit || '8', 10));
    return success(res, { products });
  } catch (err) { next(err); }
}

async function getNewArrivals(req, res, next) {
  try {
    const products = await service.getNewArrivals(parseInt(req.query.limit || '8', 10));
    return success(res, { products });
  } catch (err) { next(err); }
}

async function getRelated(req, res, next) {
  try {
    const products = await service.getRelatedProducts(req.params.id);
    return success(res, { products });
  } catch (err) { next(err); }
}

module.exports = {
  getCategories, createCategory,
  getProducts, getProductBySlug, createProduct, updateProduct, deleteProduct, updateStock,
  addReview, getFeatured, getNewArrivals, getRelated,
};
