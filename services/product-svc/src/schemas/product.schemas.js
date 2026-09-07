'use strict';

const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).required(),
  description: Joi.string().min(10).max(5000).required(),
  short_description: Joi.string().max(500).allow('', null),
  sku: Joi.string().trim().uppercase().max(100).required(),
  category_id: Joi.string().required(),
  brand: Joi.string().trim().max(100).allow('', null),
  base_price: Joi.number().positive().precision(2).required(),
  discount_percent: Joi.number().min(0).max(100).default(0),
  currency: Joi.string().length(3).uppercase().default('INR'),
  stock: Joi.number().integer().min(0).required(),
  low_stock_threshold: Joi.number().integer().min(0).default(10),
  weight_grams: Joi.number().positive().allow(null),
  tags: Joi.array().items(Joi.string().trim().lowercase()).max(20).default([]),
  attributes: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  is_featured: Joi.boolean().default(false),
  is_new_arrival: Joi.boolean().default(true),
});

const updateProductSchema = createProductSchema.fork(
  ['name', 'description', 'sku', 'category_id', 'base_price', 'stock'],
  (field) => field.optional()
);

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  image_url: Joi.string().uri().allow('', null),
  parent_id: Joi.string().allow(null).default(null),
  sort_order: Joi.number().integer().default(0),
});

const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(200).allow('', null),
  body: Joi.string().trim().max(2000).allow('', null),
});

const productQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().allow('', null),
  brand: Joi.string().allow('', null),
  min_price: Joi.number().min(0).allow(null),
  max_price: Joi.number().min(0).allow(null),
  sort: Joi.string()
    .valid('price_asc', 'price_desc', 'rating', 'newest', 'popular')
    .default('newest'),
  search: Joi.string().trim().max(200).allow('', null),
  featured: Joi.boolean().allow(null),
  new_arrival: Joi.boolean().allow(null),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  reviewSchema,
  productQuerySchema,
};
