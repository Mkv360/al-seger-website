'use strict';

const express = require('express');
const router = express.Router();

const { createApplication, getMyApplications } = require('../controllers/applicationController');
const { authenticateUser } = require('../middleware/userAuth');
const { uploadDocuments } = require('../config/multer');

// CREATE APPLICATION (with files)
router.post(
  '/create',
  authenticateUser,
  uploadDocuments,
  createApplication
);

// GET USER APPLICATIONS
router.get('/my', authenticateUser, getMyApplications);

module.exports = router;