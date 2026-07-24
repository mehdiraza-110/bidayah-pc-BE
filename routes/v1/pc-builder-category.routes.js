const express = require('express');
const router = express.Router();
const pcBuilderCategoryController = require('../../controllers/pcBuilderCategory.controller');

// Get all categories merged with their PC Builder config
router.get('/', pcBuilderCategoryController.getConfig.bind(pcBuilderCategoryController));

// Bulk save PC Builder category order + active state
router.put('/', pcBuilderCategoryController.updateConfig.bind(pcBuilderCategoryController));

module.exports = router;
