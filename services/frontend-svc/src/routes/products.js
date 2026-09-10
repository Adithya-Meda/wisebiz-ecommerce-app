'use strict';

const { Router } = require('express');
const { publicClient } = require('../lib/api');

const router = Router();

// ── Listing ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 16, category, brand, min_price, max_price, sort, search } = req.query;

    const params = new URLSearchParams({
      page, limit,
      ...(category  && { category }),
      ...(brand     && { brand }),
      ...(min_price && { min_price }),
      ...(max_price && { max_price }),
      ...(sort      && { sort }),
      ...(search    && { search }),
    });

    const [productsRes, categoriesRes] = await Promise.all([
      publicClient.get(`/api/products?${params}`),
      publicClient.get('/api/products/categories'),
    ]);

    const { data: pData, pagination } = productsRes.data;

    return res.render('products/index', {
      title: search ? `Search: "${search}" — WiseBiz` : 'Shop All Products — WiseBiz',
      products:   pData?.products   || [],
      categories: categoriesRes.data?.data?.categories || [],
      pagination: pagination || {},
      query: req.query,
    });
  } catch (err) { next(err); }
});

// ── Detail ────────────────────────────────────────────────────────────────────
router.get('/:slug', async (req, res, next) => {
  try {
    const [productRes, categoriesRes] = await Promise.all([
      publicClient.get(`/api/products/${req.params.slug}`),
      publicClient.get('/api/products/categories'),
    ]);

    if (productRes.status === 404) {
      return res.status(404).render('error', {
        title: 'Product Not Found', code: 404, message: 'This product no longer exists.',
      });
    }

    const product = productRes.data?.data?.product;

    // Fetch related products
    let related = [];
    try {
      const relRes = await publicClient.get(`/api/products/${product._id}/related`);
      related = relRes.data?.data?.products || [];
    } catch { /* non-critical */ }

    return res.render('products/detail', {
      title:      `${product.name} — WiseBiz`,
      product,
      related,
      categories: categoriesRes.data?.data?.categories || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
