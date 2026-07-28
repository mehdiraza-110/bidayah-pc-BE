const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/category.controller');
const { upload } = require('../../config/multer.config');

// Create a new category (with optional image upload)
router.post('/', upload.single('image'), categoryController.createCategory.bind(categoryController));

// Get all categories
router.get('/', categoryController.getAllCategories.bind(categoryController));

// Get category by ID
router.get('/:id', categoryController.getCategoryById.bind(categoryController));

// Update category (with optional image upload)
router.put('/:id', upload.single('image'), categoryController.updateCategory.bind(categoryController));
router.patch('/:id', upload.single('image'), categoryController.updateCategory.bind(categoryController));

// Preview cascade impact of unpublishing this category
router.get('/:id/unpublish-impact', categoryController.getUnpublishImpact.bind(categoryController));
router.get('/:id/unpublish-impact/products', categoryController.getUnpublishImpactProducts.bind(categoryController));

// Publish/unpublish (cascades to the category's vendors, then their products, when unpublishing)
router.patch('/:id/publish-status', categoryController.setPublishStatus.bind(categoryController));

// Delete category
router.delete('/:id', categoryController.deleteCategory.bind(categoryController));

module.exports = router;
