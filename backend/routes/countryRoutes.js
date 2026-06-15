/**
 * routes/countryRoutes.js
 */
'use strict';

const { Router }                  = require('express');
const { body, param }             = require('express-validator');
const ctrl                        = require('../controllers/countryController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.getAll);
router.get('/:id', param('id').isInt().toInt(), ctrl.getOne);

router.post('/',
  authorize('super_admin', 'admin'),
  [
    body('name').notEmpty().trim().isLength({ max: 120 }),
    body('code').notEmpty().trim().isLength({ min: 2, max: 5 }),
    body('quota').optional().isInt({ min: 0 }),
    body('region').optional().trim(),
    body('flag_emoji').optional().trim(),
  ],
  ctrl.create
);

router.put('/:id',
  authorize('super_admin', 'admin'),
  param('id').isInt().toInt(),
  [
    body('name').optional().trim().isLength({ max: 120 }),
    body('code').optional().trim().isLength({ min: 2, max: 5 }),
    body('quota').optional().isInt({ min: 0 }),
    body('is_active').optional().isBoolean(),
  ],
  ctrl.update
);

router.delete('/:id',
  authorize('super_admin'),
  param('id').isInt().toInt(),
  ctrl.remove
);

module.exports = router;