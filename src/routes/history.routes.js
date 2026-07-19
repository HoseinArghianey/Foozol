const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/history.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.listAllHistory));

module.exports = router;
