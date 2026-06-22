'use strict';

const express = require('express');
const router  = express.Router();

const {
  getAll, getOne, assignDetails, approveApplication, rejectApplication, deleteApplication,
} = require('../controllers/onlineApplicationController');

const { authenticate } = require('../middleware/adminAuth');
// const { requireRole } = require('../middleware/rbac'); // plug in once shared — e.g. requireRole('admin')

router.use(authenticate);

router.get('/',              getAll);
router.get('/:id',            getOne);
router.patch('/:id/assign',   assignDetails);
router.patch('/:id/approve',  approveApplication);
router.patch('/:id/reject',   rejectApplication);
router.delete('/:id',         deleteApplication);

module.exports = router;