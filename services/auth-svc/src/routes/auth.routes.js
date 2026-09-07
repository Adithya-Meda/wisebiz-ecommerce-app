'use strict';

const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { validate } = require('@Adithya-Meda/wisebiz-shared');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../schemas/auth.schemas');

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

// Protected routes (X-User-ID injected by gateway)
router.post('/logout', controller.logout);
router.post('/logout-all', controller.logoutAll);
router.put('/change-password', validate(changePasswordSchema), controller.changePassword);
router.get('/me', controller.me);

module.exports = router;
