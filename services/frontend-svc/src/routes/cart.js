'use strict';

const { Router } = require('express');
const { buildClient, extractError } = require('../lib/api');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// View cart
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const response = await buildClient(req.session.accessToken).get('/api/cart');
    const cart = response.data?.data?.cart || { items: [], subtotal: 0, item_count: 0 };
    req.session.cartCount = cart.item_count;
    return res.render('cart', { title: 'Your Cart — WiseBiz', cart });
  } catch (err) { next(err); }
});

// Add item (AJAX)
router.post('/items', requireAuth, async (req, res) => {
  const response = await buildClient(req.session.accessToken).post('/api/cart/items', req.body);
  if (response.status === 201) {
    // Refresh cart count in session
    try {
      const cart = await buildClient(req.session.accessToken).get('/api/cart');
      req.session.cartCount = cart.data?.data?.cart?.item_count || 0;
    } catch { /* */ }
    return res.json({ success: true, message: 'Added to cart' });
  }
  return res.status(response.status).json({ success: false, message: extractError(response) });
});

// Update quantity (AJAX)
router.put('/items/:productId', requireAuth, async (req, res) => {
  const response = await buildClient(req.session.accessToken)
    .put(`/api/cart/items/${req.params.productId}`, req.body);
  return res.status(response.status).json(response.data);
});

// Remove item (AJAX)
router.delete('/items/:productId', requireAuth, async (req, res) => {
  const response = await buildClient(req.session.accessToken)
    .delete(`/api/cart/items/${req.params.productId}`);
  return res.status(response.status).json(response.data);
});

module.exports = router;
