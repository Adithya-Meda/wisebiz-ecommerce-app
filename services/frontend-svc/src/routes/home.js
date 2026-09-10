'use strict';

const { Router } = require('express');
const { publicClient } = require('../lib/api');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [featuredRes, newArrivalsRes, categoriesRes] = await Promise.all([
      publicClient.get('/api/products/featured?limit=8'),
      publicClient.get('/api/products/new-arrivals?limit=8'),
      publicClient.get('/api/products/categories'),
    ]);

    return res.render('home', {
      title: 'WiseBiz — Shop Smart, Live Better',
      featured:    featuredRes.data?.data?.products   || [],
      newArrivals: newArrivalsRes.data?.data?.products || [],
      categories:  categoriesRes.data?.data?.categories || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
