const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');
const { upload } = require('../../config/multer.config');

// Create a new product
// main_image: single file (required)
// media: up to 5 files (optional)
router.post(
  '/',
  upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'media', maxCount: 5 }
  ]),
  productController.createProduct.bind(productController)
);

// Get all products (with optional query filters)
router.get('/', productController.getAllProducts.bind(productController));

// Toggle featured status
router.patch('/:id/featured', productController.toggleFeatured.bind(productController));
router.put('/:id/featured', productController.toggleFeatured.bind(productController));

// Get product by ID
router.get('/:id', productController.getProductById.bind(productController));

// Update product
// main_image: single file (optional)
// media: up to 5 files (optional)
router.put(
  '/:id',
  upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'media', maxCount: 5 }
  ]),
  productController.updateProduct.bind(productController)
);

router.patch(
  '/:id',
  upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'media', maxCount: 5 }
  ]),
  productController.updateProduct.bind(productController)
);

// Delete product
router.delete('/:id', productController.deleteProduct.bind(productController));

module.exports = router;
