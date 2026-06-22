'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/adminAuth');

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  ctrl.login
);

router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;