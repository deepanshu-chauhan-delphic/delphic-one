const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const controller = require('./admin.controller');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.post('/:entity_type/:entity_id/unlock', controller.unlock);

module.exports = router;
