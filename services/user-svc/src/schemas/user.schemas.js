'use strict';

const Joi = require('joi');

const updateProfileSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100),
  last_name: Joi.string().trim().min(1).max(100),
  phone: Joi.string()
    .pattern(/^\+?[\d\s\-().]{7,20}$/)
    .allow(null, ''),
  date_of_birth: Joi.date().iso().max('now').allow(null),
  gender: Joi.string().valid('male', 'female', 'non-binary', 'prefer_not_to_say').allow(null, ''),
  bio: Joi.string().max(500).allow(null, ''),
});

const createAddressSchema = Joi.object({
  label: Joi.string().valid('home', 'work', 'other').default('home'),
  full_name: Joi.string().trim().min(2).max(200).required(),
  line1: Joi.string().trim().min(5).max(255).required(),
  line2: Joi.string().trim().max(255).allow('', null),
  city: Joi.string().trim().min(2).max(100).required(),
  state: Joi.string().trim().min(2).max(100).required(),
  postal_code: Joi.string().trim().min(3).max(20).required(),
  country: Joi.string().trim().max(100).default('India'),
  phone: Joi.string()
    .pattern(/^\+?[\d\s\-().]{7,20}$/)
    .allow(null, ''),
  is_default: Joi.boolean().default(false),
});

const updateAddressSchema = createAddressSchema.fork(
  ['full_name', 'line1', 'city', 'state', 'postal_code'],
  (field) => field.optional()
);

const wishlistSchema = Joi.object({
  product_id: Joi.string().required(),
  product_name: Joi.string().max(255).required(),
  product_price: Joi.number().positive().precision(2),
  product_image: Joi.string().uri().allow(null, ''),
});

module.exports = {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  wishlistSchema,
};
