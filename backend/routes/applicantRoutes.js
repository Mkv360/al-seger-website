/**
 * routes/applicantRoutes.js
 * All applicant-related endpoints.
 */

'use strict';

const { Router }                     = require('express');
const { body, param }                = require('express-validator');
const ctrl                           = require('../controllers/applicantController');
const { authenticate, authorize }    = require('../middleware/auth');
const { handleDocumentUploads }      = require('../middleware/upload');

const router = Router();

// All applicant routes require authentication
router.use(authenticate);

const VALID_STATUSES = ['pending', 'processing', 'interview', 'approved', 'rejected', 'deployed'];

// Common validators
const applicantValidators = [
  body('first_name').notEmpty().trim().isLength({ max: 100 }).withMessage('First name is required (max 100).'),
  body('last_name').notEmpty().trim().isLength({ max: 100 }).withMessage('Last name is required (max 100).'),
  body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female.'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('date_of_birth').optional({ checkFalsy: true }).isDate().withMessage('Invalid date of birth.'),
  body('passport_expiry').optional({ checkFalsy: true }).isDate().withMessage('Invalid passport expiry.'),
  body('destination_country_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('origin_country_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('education').optional().isIn(['none','primary','secondary','diploma','bachelor','master','phd']),
  body('experience_years').optional().isInt({ min: 0, max: 50 }),
];

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/applicants/stats       — must be before /:id
router.get('/stats', ctrl.getStats);

// GET /api/applicants
router.get('/', ctrl.getAll);

// GET /api/applicants/:id
router.get('/:id', param('id').isInt().toInt(), ctrl.getOne);

// POST /api/applicants  (with optional documents)
router.post('/',
  authorize('super_admin', 'admin'),
  handleDocumentUploads,
  applicantValidators,
  ctrl.create
);

// PUT /api/applicants/:id
router.put('/:id',
  authorize('super_admin', 'admin'),
  param('id').isInt().toInt(),
  applicantValidators,
  ctrl.update
);

// PATCH /api/applicants/:id/status
router.patch('/:id/status',
  authorize('super_admin', 'admin'),
  [
    param('id').isInt().toInt(),
    body('status').isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
    body('admin_notes').optional().trim(),
    body('rejected_reason').optional().trim(),
  ],
  ctrl.updateStatus
);

// POST /api/applicants/:id/documents
router.post('/:id/documents',
  authorize('super_admin', 'admin'),
  handleDocumentUploads,
  ctrl.uploadDocuments
);

// DELETE /api/applicants/:id/documents/:type
router.delete('/:id/documents/:type',
  authorize('super_admin', 'admin'),
  ctrl.deleteDocument
);

// DELETE /api/applicants/:id
router.delete('/:id',
  authorize('super_admin'),
  param('id').isInt().toInt(),
  ctrl.remove
);

module.exports = router;