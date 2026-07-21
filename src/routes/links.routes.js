const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/links.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.listLinks));
router.post('/', asyncHandler(controller.createLink));
router.get('/:id', asyncHandler(controller.getLink));
router.patch('/:id', asyncHandler(controller.updateLink));
router.delete('/:id', asyncHandler(controller.deleteLink));

router.post('/:id/check', asyncHandler(controller.checkLinkNow));
router.post('/:id/screenshot', asyncHandler(controller.requestScreenshot));
router.get('/:id/history', asyncHandler(controller.getLinkHistory));
router.post('/:id/dismiss', asyncHandler(controller.dismissLinkChanges));

module.exports = router;
