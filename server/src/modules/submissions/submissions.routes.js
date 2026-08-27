const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const lockCheck = require('../../middleware/lockCheck');
const controller = require('./submissions.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/history', controller.history);

router.post('/', authorize('recruiter', 'admin'), controller.create);
router.patch('/:id', authorize('recruiter', 'admin'), lockCheck('submissions'), controller.update);
router.post('/:id/stage', authorize('recruiter', 'admin'), lockCheck('submissions'), controller.changeStage);
router.post('/:id/interview-rounds', authorize('recruiter', 'sales', 'admin'), controller.addRound);

module.exports = router;
