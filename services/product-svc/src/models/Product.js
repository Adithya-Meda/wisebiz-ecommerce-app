'use strict';

const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },      // e.g. "Size", "Color"
  options: [
    {
      value: { type: String, required: true }, // e.g. "XL", "Blue"
      sku: { type: String, required: true, unique: true },
      price_modifier: { type: Number, default: 0 },
      stock: { type: Number, required: true, min: 0, default: 0 },
    },
  ],
});

const reviewSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 200 },
    body: { type: String, maxlength: 2000 },
    verified_purchase: { type: Boolean, default: false },
    helpful_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 5000 },
    short_description: { type: String, maxlength: 500 },
    sku: { type: String, required: true, unique: true, uppercase: true },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    brand: { type: String, trim: true, maxlength: 100 },
    base_price: { type: Number, required: true, min: 0 },
    discount_percent: { type: Number, default: 0, min: 0, max: 100 },
    currency: { type: String, default: 'INR', maxlength: 3 },
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
        is_primary: { type: Boolean, default: false },
      },
    ],
    variants: [variantSchema],
    tags: [{ type: String, lowercase: true, trim: true }],
    attributes: { type: Map, of: String }, // flexible key-value e.g. { material: "Cotton" }
    stock: { type: Number, required: true, min: 0, default: 0 },
    low_stock_threshold: { type: Number, default: 10 },
    weight_grams: { type: Number },
    dimensions: {
      length_cm: Number,
      width_cm: Number,
      height_cm: Number,
    },
    reviews: [reviewSchema],
    rating_avg: { type: Number, default: 0, min: 0, max: 5 },
    rating_count: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    is_featured: { type: Boolean, default: false },
    is_new_arrival: { type: Boolean, default: false },
    sold_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Text search index for product search
productSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
productSchema.index({ slug: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ base_price: 1 });
productSchema.index({ rating_avg: -1 });
productSchema.index({ is_featured: 1 });
productSchema.index({ is_active: 1 });

// Virtual: final selling price after discount
productSchema.virtual('sale_price').get(function () {
  if (this.discount_percent > 0) {
    return parseFloat((this.base_price * (1 - this.discount_percent / 100)).toFixed(2));
  }
  return this.base_price;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
