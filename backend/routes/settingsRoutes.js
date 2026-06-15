/**
 * routes/settingsRoutes.js
 */
'use strict';

const { Router }                  = require('express');
const ctrl                        = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

router.get('/',        ctrl.getAll);
router.get('/:key',    ctrl.getOne);
router.put('/',        authorize('super_admin', 'admin'), ctrl.bulkUpdate);
router.put('/:key',    authorize('super_admin', 'admin'), ctrl.updateOne);

module.exports = router;