'use strict';

const { Router } = require('express');
const controller = require('../controllers/user.controller');
const { validate, internalAuth } = require('@Adithya-Meda/wisebiz-shared');
const {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  wishlistSchema,
} = require('../schemas/user.schemas');
const { upload } = require('../middleware/upload');

const router = Router();

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/me', controller.getProfile);
router.put('/me', validate(updateProfileSchema), controller.updateProfile);
router.post('/me/avatar', upload.single('avatar'), controller.uploadAvatar);

// Internal route: called by auth-svc after registration — guarded by shared secret
router.post('/internal/create', internalAuth, controller.createProfile);

// ─── Addresses ───────────────────────────────────────────────────────────────
router.get('/me/addresses', controller.getAddresses);
router.get('/me/addresses/:id', controller.getAddress);
router.post('/me/addresses', validate(createAddressSchema), controller.createAddress);
router.put('/me/addresses/:id', validate(updateAddressSchema), controller.updateAddress);
router.delete('/me/addresses/:id', controller.deleteAddress);
router.patch('/me/addresses/:id/set-default', controller.setDefaultAddress);

// ─── Wishlist ─────────────────────────────────────────────────────────────────
router.get('/me/wishlist', controller.getWishlist);
router.post('/me/wishlist', validate(wishlistSchema), controller.addToWishlist);
router.delete('/me/wishlist/:productId', controller.removeFromWishlist);

module.exports = router;
