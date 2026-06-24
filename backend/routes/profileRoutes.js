/**
 * routes/profileRoutes.js
 * Mounted at: /api/profile
 */

'use strict';

const { Router }             = require('express');
const { authenticate }       = require('../middleware/adminAuth');
const { handleAvatarUpload } = require('../middleware/upload');
const { getProfile, updateProfile } = require('../controllers/profileController');

const router = Router();

// All profile routes require a valid admin JWT
router.use(authenticate);

router.get('/', getProfile);
router.put('/', handleAvatarUpload, updateProfile);

module.exports = router;