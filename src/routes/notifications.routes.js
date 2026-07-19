const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.listNotifications));
router.patch('/:id/read', asyncHandler(controller.markAsRead));
router.patch('/read-all', asyncHandler(controller.markAllAsRead));

module.exports = router;
