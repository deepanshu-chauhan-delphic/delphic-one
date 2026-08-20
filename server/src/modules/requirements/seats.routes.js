const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const lockCheck = require('../../middleware/lockCheck');
const controller = require('./requirements.controller');

const router = express.Router();

router.use(authenticate);

router.post('/:id/stage', authorize('recruiter', 'sales', 'admin'), lockCheck('requirement_seats'), controller.changeSeatStatus);

module.exports = router;
