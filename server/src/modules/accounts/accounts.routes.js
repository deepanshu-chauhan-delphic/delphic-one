const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const lockCheck = require('../../middleware/lockCheck');
const controller = require('./accounts.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/history', controller.history);
router.post('/', authorize('bda', 'admin'), controller.create);
router.patch('/:id', authorize('bda', 'admin'), lockCheck('accounts'), controller.update);
router.post('/:id/stage', authorize('bda', 'admin'), controller.changeStage);

module.exports = router;
