const express = require('express');
const { authenticate, authorize, loadSuperadminFlag } = require('../../middleware/auth');
const controller = require('./users.controller');

const router = express.Router();

router.use(authenticate);

router.get('/me', controller.me);
router.get('/', authorize('admin', 'sales', 'bda'), controller.list);
router.get('/:id', authorize('admin'), controller.getOne);
router.post('/', authorize('admin'), controller.create);
router.patch('/:id', authorize('admin'), loadSuperadminFlag, controller.update);

module.exports = router;
