'use strict';

const slugify = require('slugify');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { NotFoundError, ConflictError, AppError, createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('product-svc:service');

// ─── Categories ───────────────────────────────────────────────────────────────

async function getAllCategories() {
  return Category.find({ is_active: true }).sort({ sort_order: 1, name: 1 }).lean();
}

async function createCategory(data) {
  const slug = slugify(data.name, { lower: true, strict: true });
  const existing = await Category.findOne({ slug });
  if (existing) { throw new ConflictError('Category with this name already exists'); }
  return Category.create({ ...data, slug });
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function getProducts(query) {
  const {
    page, limit, category, brand, min_price,
    max_price, sort, search, featured, new_arrival,
  } = query;

  const filter = { is_active: true };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) { filter.category_id = cat._id; }
  }
  if (brand) { filter.brand = new RegExp(brand, 'i'); }
  if (min_price !== undefined || max_price !== undefined) {
    filter.base_price = {};
    if (min_price !== undefined) { filter.base_price.$gte = min_price; }
    if (max_price !== undefined) { filter.base_price.$lte = max_price; }
  }
  if (featured !== undefined) { filter.is_featured = featured; }
  if (new_arrival !== undefined) { filter.is_new_arrival = new_arrival; }

  if (search) {
    filter.$text = { $search: search };
  }

  const sortMap = {
    price_asc: { base_price: 1 },
    price_desc: { base_price: -1 },
    rating: { rating_avg: -1 },
    newest: { createdAt: -1 },
    popular: { sold_count: -1 },
  };

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('-reviews -__v')
      .populate('category_id', 'name slug')
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
}

async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug, is_active: true })
    .populate('category_id', 'name slug')
    .lean({ virtuals: true });
  if (!product) { throw new NotFoundError('Product'); }
  return product;
}

async function getProductById(id) {
  const product = await Product.findById(id)
    .populate('category_id', 'name slug')
    .lean({ virtuals: true });
  if (!product) { throw new NotFoundError('Product'); }
  return product;
}

async function createProduct(data) {
  const slug = slugify(data.name, { lower: true, strict: true });
  const existing = await Product.findOne({ $or: [{ slug }, { sku: data.sku.toUpperCase() }] });
  if (existing) { throw new ConflictError('A product with this name or SKU already exists'); }

  const product = await Product.create({ ...data, slug, sku: data.sku.toUpperCase() });
  logger.info('Product created', { productId: product._id });
  return product.toObject({ virtuals: true });
}

async function updateProduct(id, data) {
  if (data.name) {
    data.slug = slugify(data.name, { lower: true, strict: true });
  }
  const product = await Product.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean({ virtuals: true });

  if (!product) { throw new NotFoundError('Product'); }
  logger.info('Product updated', { productId: id });
  return product;
}

async function deleteProduct(id) {
  const result = await Product.findByIdAndUpdate(id, { is_active: false }, { new: true });
  if (!result) { throw new NotFoundError('Product'); }
  logger.info('Product deactivated', { productId: id });
}

async function updateStock(id, delta) {
  const product = await Product.findById(id);
  if (!product) { throw new NotFoundError('Product'); }

  const newStock = product.stock + delta;
  if (newStock < 0) {
    throw new AppError(`Insufficient stock. Available: ${product.stock}`, 409, 'INSUFFICIENT_STOCK');
  }

  product.stock = newStock;
  if (delta < 0) { product.sold_count += Math.abs(delta); }
  await product.save();
  return { stock: product.stock };
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function addReview(productId, userId, userName, reviewData) {
  const product = await Product.findById(productId);
  if (!product) { throw new NotFoundError('Product'); }

  const alreadyReviewed = product.reviews.some((r) => r.user_id === userId);
  if (alreadyReviewed) {
    throw new ConflictError('You have already reviewed this product');
  }

  product.reviews.push({
    user_id: userId,
    user_name: userName,
    ...reviewData,
  });

  // Recalculate rating average
  const total = product.reviews.reduce((sum, r) => sum + r.rating, 0);
  product.rating_avg = parseFloat((total / product.reviews.length).toFixed(1));
  product.rating_count = product.reviews.length;

  await product.save();
  logger.info('Review added', { productId, userId });

  return product.reviews[product.reviews.length - 1];
}

async function getFeaturedProducts(limit = 8) {
  return Product.find({ is_active: true, is_featured: true })
    .select('-reviews -__v')
    .populate('category_id', 'name slug')
    .sort({ sold_count: -1 })
    .limit(limit)
    .lean({ virtuals: true });
}

async function getNewArrivals(limit = 8) {
  return Product.find({ is_active: true, is_new_arrival: true })
    .select('-reviews -__v')
    .populate('category_id', 'name slug')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean({ virtuals: true });
}

async function getRelatedProducts(productId, limit = 6) {
  const product = await Product.findById(productId).select('category_id tags');
  if (!product) { return []; }

  return Product.find({
    _id: { $ne: productId },
    is_active: true,
    $or: [
      { category_id: product.category_id },
      { tags: { $in: product.tags } },
    ],
  })
    .select('-reviews -__v')
    .limit(limit)
    .lean({ virtuals: true });
}

module.exports = {
  getAllCategories,
  createCategory,
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  addReview,
  getFeaturedProducts,
  getNewArrivals,
  getRelatedProducts,
};
