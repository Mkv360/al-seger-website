/**
 * routes/adminManagementRoutes.js
 * Mounted at: /api/admin-management
 * All routes: authenticate → super_admin only
 */

'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminManagementController');

const router = Router();

router.use(authenticate);
router.use(authorize('super_admin'));

router.get('/', ctrl.listAdmins);
router.post('/', ctrl.createAdmin);
router.put('/:id', ctrl.updateAdmin);
router.delete('/:id', ctrl.deleteAdmin);

module.exports = router;