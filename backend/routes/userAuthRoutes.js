'use strict';

const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/userAuthController');
const { authenticateUser } = require('../middleware/userAuth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateUser, getMe);

module.exports = router;