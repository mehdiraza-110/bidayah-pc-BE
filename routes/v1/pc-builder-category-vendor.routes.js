const express = require('express');
const router = express.Router();
const pcBuilderCategoryVendorController = require('../../controllers/pcBuilderCategoryVendor.controller');

// Get all categories + vendors + current associations (admin UI)
router.get('/', pcBuilderCategoryVendorController.getConfig.bind(pcBuilderCategoryVendorController));

// Replace the valid vendor list for a single category
router.put('/:categoryId', pcBuilderCategoryVendorController.updateForCategory.bind(pcBuilderCategoryVendorController));

module.exports = router;
