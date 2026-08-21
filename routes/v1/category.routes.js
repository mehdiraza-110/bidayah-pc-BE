const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/category.controller');
const { upload } = require('../../config/multer.config');

// A category can carry its own thumbnail (`image`) and, separately, a wide
// banner photo for its product-listing hero (`hero_image`) — both optional,
// both uploaded in the same multipart request.
const categoryImageUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'hero_image', maxCount: 1 },
]);

// Create a new category (with optional image + hero image upload)
router.post('/', categoryImageUpload, categoryController.createCategory.bind(categoryController));

// Get all categories
router.get('/', categoryController.getAllCategories.bind(categoryController));

// Get category by ID
router.get('/:id', categoryController.getCategoryById.bind(categoryController));

// Dynamic "Specifications" filters for this category (feature keys + the
// distinct values actually used by its published products)
router.get('/:id/filters', categoryController.getCategoryFilters.bind(categoryController));

// Update category (with optional image + hero image upload)
router.put('/:id', categoryImageUpload, categoryController.updateCategory.bind(categoryController));
router.patch('/:id', categoryImageUpload, categoryController.updateCategory.bind(categoryController));

// Preview cascade impact of unpublishing this category
router.get('/:id/unpublish-impact', categoryController.getUnpublishImpact.bind(categoryController));
router.get('/:id/unpublish-impact/products', categoryController.getUnpublishImpactProducts.bind(categoryController));

// Publish/unpublish (cascades to the category's vendors, then their products, when unpublishing)
router.patch('/:id/publish-status', categoryController.setPublishStatus.bind(categoryController));

// Delete category
router.delete('/:id', categoryController.deleteCategory.bind(categoryController));

module.exports = router;
