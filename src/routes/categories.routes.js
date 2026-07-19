const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/categories.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.listCategories));

module.exports = router;
