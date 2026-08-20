const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const lockCheck = require('../../middleware/lockCheck');
const controller = require('./requirements.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/history', controller.history);
router.get('/:id/assignments', controller.assignments);
router.get('/:id/seats', controller.getSeats);

router.post('/', authorize('sales', 'admin'), controller.create);
router.patch('/:id', authorize('sales', 'admin'), lockCheck('requirements'), controller.update);
router.post('/:id/status', authorize('sales', 'admin'), controller.changeStatus);
router.post('/:id/assign', authorize('sales', 'admin'), controller.assign);
router.post('/:id/unassign', authorize('sales', 'admin'), controller.unassign);
router.post('/:id/seats', authorize('sales', 'admin'), controller.addSeat);

module.exports = router;
