const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const controller = require('./users.controller');

const router = express.Router();

router.use(authenticate);

router.get('/me', controller.me);
router.get('/', authorize('admin', 'sales', 'bda'), controller.list);
router.post('/', authorize('admin'), controller.create);
router.patch('/:id', authorize('admin'), controller.update);

module.exports = router;
