const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const controller = require('./profiles.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('recruiter', 'sales', 'admin'), controller.list);
router.get('/:id', authorize('recruiter', 'sales', 'admin'), controller.getOne);
router.get('/:id/submissions', authorize('recruiter', 'sales', 'admin'), controller.submissions);
router.post('/', authorize('recruiter', 'admin'), controller.create);
router.patch('/:id', authorize('recruiter', 'admin'), controller.update);

module.exports = router;
