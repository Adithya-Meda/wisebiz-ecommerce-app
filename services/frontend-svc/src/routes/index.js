'use strict';

const { Router } = require('express');
const router = Router();

router.use('/',          require('./home'));
router.use('/auth',      require('./auth'));
router.use('/products',  require('./products'));
router.use('/cart',      require('./cart'));
router.use('/checkout',  require('./checkout'));
router.use('/orders',    require('./orders'));
router.use('/account',   require('./account'));

module.exports = router;
