'use strict';

const { Router } = require('express');
const { buildClient, extractError } = require('../lib/api');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const router = Router();

// ── GET: Checkout page ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [cartRes, addressRes] = await Promise.all([
      buildClient(req.session.accessToken).get('/api/cart'),
      buildClient(req.session.accessToken).get('/api/users/me/addresses'),
    ]);

    const cart = cartRes.data?.data?.cart;
    if (!cart || cart.items.length === 0) {
      req.session.flash = { type: 'warning', message: 'Your cart is empty.' };
      return res.redirect('/cart');
    }

    return res.render('checkout', {
      title: 'Checkout — WiseBiz',
      cart,
      addresses: addressRes.data?.data?.addresses || [],
      error: null,
    });
  } catch (err) { next(err); }
});

// ── POST: Place order ─────────────────────────────────────────────────────────
router.post('/place-order', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const {
      shipping_address_id, full_name, line1, line2,
      city, state, postal_code, country, phone, notes,
    } = req.body;
    const client = buildClient(req.session.accessToken);

    let shippingAddress;
    if (shipping_address_id) {
      const addrRes = await client.get(`/api/users/me/addresses/${shipping_address_id}`);
      shippingAddress = addrRes.data?.data?.address;
    } else {
      shippingAddress = { full_name, line1, line2: line2 || null, city, state, postal_code, country: country || 'India', phone: phone || null };
    }

    const orderRes = await client.post('/api/orders', {
      shipping_address: shippingAddress,
      notes: notes || null,
    });

    if (orderRes.status !== 201) {
      const [cartRes, addressRes] = await Promise.all([
        client.get('/api/cart'),
        client.get('/api/users/me/addresses'),
      ]);
      return res.render('checkout', {
        title: 'Checkout — WiseBiz',
        cart:      cartRes.data?.data?.cart || {},
        addresses: addressRes.data?.data?.addresses || [],
        error:     extractError(orderRes),
      });
    }

    const order = orderRes.data.data.order;
    return res.redirect(`/checkout/payment/${order.id}`);
  } catch (err) { next(err); }
});

// ── GET: Payment page ─────────────────────────────────────────────────────────
router.get('/payment/:orderId', requireAuth, async (req, res, next) => {
  try {
    const orderRes = await buildClient(req.session.accessToken).get(`/api/orders/${req.params.orderId}`);
    if (orderRes.status !== 200) { return res.redirect('/orders'); }
    return res.render('checkout-payment', {
      title: 'Payment — WiseBiz',
      order: orderRes.data.data.order,
      error: null,
    });
  } catch (err) { next(err); }
});

// ── POST: Process payment ─────────────────────────────────────────────────────
router.post('/payment/:orderId/pay', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const client = buildClient(req.session.accessToken);
    const { payment_type, card_last4, upi_id, wallet } = req.body;

    const orderRes = await client.get(`/api/orders/${req.params.orderId}`);
    const order    = orderRes.data.data.order;

    const paymentMethod = { type: payment_type };
    if (payment_type === 'card')   { paymentMethod.card_last4 = card_last4; }
    if (payment_type === 'upi')    { paymentMethod.upi_id = upi_id; }
    if (payment_type === 'wallet') { paymentMethod.wallet = wallet; }

    const intentRes = await client.post('/api/payments/intents', {
      order_id:       req.params.orderId,
      amount:         order.total_amount,
      currency:       order.currency || 'INR',
      payment_method: paymentMethod,
    });

    if (intentRes.status !== 201) {
      return res.render('checkout-payment', {
        title: 'Payment — WiseBiz', order, error: extractError(intentRes),
      });
    }

    const confirmRes = await client.post(`/api/payments/intents/${intentRes.data.data.intent.id}/confirm`);
    const payment    = confirmRes.data.data.payment;

    if (payment.status === 'succeeded') {
      req.session.cartCount = 0;
      req.session.flash = { type: 'success', message: '🎉 Payment successful! Your order is confirmed.' };
      return res.redirect(`/orders/${order.id}`);
    }

    return res.render('checkout-payment', {
      title: 'Payment — WiseBiz',
      order,
      error: `Payment failed: ${payment.failure_reason || 'Please try another payment method.'}`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
