const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/cron.controller');

const router = express.Router();

router.post('/run-check', asyncHandler(controller.triggerCheckCycle));

module.exports = router;
