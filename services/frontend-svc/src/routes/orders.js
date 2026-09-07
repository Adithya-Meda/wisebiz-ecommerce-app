'use strict';

const { Router } = require('express');
const { buildClient } = require('../lib/api');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, status } = req.query;
    const params = new URLSearchParams({ page, limit: 10, ...(status && { status }) });
    const response = await buildClient(req.session.accessToken).get(`/api/orders?${params}`);
    const { data, pagination } = response.data;

    return res.render('orders/index', {
      title: 'My Orders — WiseBiz',
      orders:     data || [],
      pagination: pagination || {},
      query:      req.query,
    });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const client = buildClient(req.session.accessToken);
    const [orderRes, historyRes] = await Promise.all([
      client.get(`/api/orders/${req.params.id}`),
      client.get(`/api/orders/${req.params.id}/history`),
    ]);

    if (orderRes.status === 404) {
      return res.status(404).render('error', { title: 'Order Not Found', code: 404, message: 'Order not found.' });
    }

    return res.render('orders/detail', {
      title:   `Order Details — WiseBiz`,
      order:   orderRes.data.data.order,
      history: historyRes.data?.data?.history || [],
    });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    await buildClient(req.session.accessToken).post(`/api/orders/${req.params.id}/cancel`);
    req.session.flash = { type: 'success', message: 'Order cancelled.' };
    return res.redirect(`/orders/${req.params.id}`);
  } catch (err) { next(err); }
});

module.exports = router;
