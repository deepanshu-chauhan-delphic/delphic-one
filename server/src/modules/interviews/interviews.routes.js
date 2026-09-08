const express = require('express');
const { authenticate } = require('../../middleware/auth');
const controller = require('./interviews.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.post('/:id/feedback', controller.submitFeedback);
router.post('/:id/cancel', controller.cancel);

module.exports = router;
