/**
 * routes/reportRoutes.js
 */
'use strict';

const { Router }          = require('express');
const ctrl                = require('../controllers/reportController');
const { authenticate }    = require('../middleware/adminAuth');

const router = Router();
router.use(authenticate);

router.get('/summary',    ctrl.summary);
router.get('/by-country', ctrl.byCountry);
router.get('/by-status',  ctrl.byStatus);
router.get('/by-period',  ctrl.byPeriod);
router.get('/gender',     ctrl.byGender);
router.get('/education',  ctrl.byEducation);
router.get('/export',     ctrl.exportCsv);
router.get('/activity',   ctrl.activityLog);

module.exports = router;