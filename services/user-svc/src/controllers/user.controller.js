'use strict';

const userService = require('../services/user.service');
const { success } = require('@Adithya-Meda/wisebiz-shared');

// ─── Profile ──────────────────────────────────────────────────────────────────

async function getProfile(req, res, next) {
  try {
    const profile = await userService.getProfile(req.headers['x-user-id']);
    return success(res, { profile });
  } catch (err) { next(err); }
}

async function createProfile(req, res, next) {
  try {
    const profile = await userService.createProfile(req.body);
    return success(res, { profile }, 'Profile created', 201);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await userService.updateProfile(req.headers['x-user-id'], req.body);
    return success(res, { profile }, 'Profile updated');
  } catch (err) { next(err); }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }
    const result = await userService.uploadAvatar(req.headers['x-user-id'], req.file);
    return success(res, result, 'Avatar updated');
  } catch (err) { next(err); }
}

// ─── Addresses ───────────────────────────────────────────────────────────────

async function getAddresses(req, res, next) {
  try {
    const addresses = await userService.getAddresses(req.headers['x-user-id']);
    return success(res, { addresses });
  } catch (err) { next(err); }
}

async function getAddress(req, res, next) {
  try {
    const address = await userService.getAddress(req.headers['x-user-id'], req.params.id);
    return success(res, { address });
  } catch (err) { next(err); }
}

async function createAddress(req, res, next) {
  try {
    const address = await userService.createAddress(req.headers['x-user-id'], req.body);
    return success(res, { address }, 'Address added', 201);
  } catch (err) { next(err); }
}

async function updateAddress(req, res, next) {
  try {
    const address = await userService.updateAddress(
      req.headers['x-user-id'],
      req.params.id,
      req.body
    );
    return success(res, { address }, 'Address updated');
  } catch (err) { next(err); }
}

async function deleteAddress(req, res, next) {
  try {
    await userService.deleteAddress(req.headers['x-user-id'], req.params.id);
    return success(res, {}, 'Address removed');
  } catch (err) { next(err); }
}

async function setDefaultAddress(req, res, next) {
  try {
    const address = await userService.setDefaultAddress(
      req.headers['x-user-id'],
      req.params.id
    );
    return success(res, { address }, 'Default address updated');
  } catch (err) { next(err); }
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

async function getWishlist(req, res, next) {
  try {
    const items = await userService.getWishlist(req.headers['x-user-id']);
    return success(res, { items });
  } catch (err) { next(err); }
}

async function addToWishlist(req, res, next) {
  try {
    const item = await userService.addToWishlist(req.headers['x-user-id'], req.body);
    return success(res, { item }, 'Added to wishlist', 201);
  } catch (err) { next(err); }
}

async function removeFromWishlist(req, res, next) {
  try {
    await userService.removeFromWishlist(req.headers['x-user-id'], req.params.productId);
    return success(res, {}, 'Removed from wishlist');
  } catch (err) { next(err); }
}

module.exports = {
  getProfile, createProfile, updateProfile, uploadAvatar,
  getAddresses, getAddress, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getWishlist, addToWishlist, removeFromWishlist,
};
