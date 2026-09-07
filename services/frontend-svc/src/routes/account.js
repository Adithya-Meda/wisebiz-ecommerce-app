'use strict';

const { Router } = require('express');
const { buildClient, extractError } = require('../lib/api');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const client = buildClient(req.session.accessToken);
    const [profileRes, addressRes, wishlistRes] = await Promise.all([
      client.get('/api/users/me'),
      client.get('/api/users/me/addresses'),
      client.get('/api/users/me/wishlist'),
    ]);
    return res.render('account', {
      title: 'My Account — WiseBiz',
      profile:   profileRes.data?.data?.profile  || {},
      addresses: addressRes.data?.data?.addresses || [],
      wishlist:  wishlistRes.data?.data?.items    || [],
      error: null,
      success: null,
    });
  } catch (err) { next(err); }
});

router.post('/profile', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const client = buildClient(req.session.accessToken);
    const response = await client.put('/api/users/me', req.body);
    const [addressRes, wishlistRes] = await Promise.all([
      client.get('/api/users/me/addresses'),
      client.get('/api/users/me/wishlist'),
    ]);
    return res.render('account', {
      title: 'My Account — WiseBiz',
      profile:   response.data?.data?.profile  || {},
      addresses: addressRes.data?.data?.addresses || [],
      wishlist:  wishlistRes.data?.data?.items    || [],
      error:   response.status !== 200 ? extractError(response) : null,
      success: response.status === 200 ? 'Profile updated successfully.' : null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
