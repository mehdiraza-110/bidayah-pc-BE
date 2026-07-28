const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');
const vendorController = require('../../controllers/vendor.controller');
const categoryController = require('../../controllers/category.controller');
const billingController = require('../../controllers/billing.controller');
const customizationController = require('../../controllers/customization.controller');
const publicPcBuilderController = require('../../controllers/publicPcBuilder.controller');
const siteSettingsController = require('../../controllers/siteSettings.controller');
const storeLocationController = require('../../controllers/storeLocation.controller');

// Middleware to check if product is published (for public routes)
const checkPublishedProduct = async (req, res, next) => {
  const productService = require('../../services/product.service');
  const { id } = req.params;
  
  try {
    const product = await productService.getProductById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (product.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Product is published, continue to controller
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking product status',
      error: error.message
    });
  }
};

// Public Products Routes (only GET, only published products)
router.get('/products/featured', productController.getFeaturedProducts.bind(productController));

router.get('/products', (req, res, next) => {
  // Force status filter to 'published' for public endpoints
  req.query.status = 'published';
  next();
}, productController.getAllProducts.bind(productController));

router.get('/products/:id', checkPublishedProduct, productController.getProductById.bind(productController));

// Public PC Builder Routes (only GET, only published products)
router.get('/pc-builder/options', publicPcBuilderController.getOptions.bind(publicPcBuilderController));
router.get('/pc-builder/products', publicPcBuilderController.getProducts.bind(publicPcBuilderController));
router.get('/pc-builder/vendors', publicPcBuilderController.getVendorsForCategory.bind(publicPcBuilderController));

// Public Vendors Routes (only GET)
router.get('/vendors', vendorController.getAllVendors.bind(vendorController));
router.get('/vendors/:id', vendorController.getVendorById.bind(vendorController));

// Public Store Locations Route (only GET, only active locations)
router.get('/store-locations', (req, res, next) => {
  // Force active_only filter for public endpoints
  req.query.active_only = 'true';
  next();
}, storeLocationController.getAllStoreLocations.bind(storeLocationController));

// Public Categories Routes (only GET)
router.get('/categories', categoryController.getAllCategories.bind(categoryController));
router.get('/categories/:id', categoryController.getCategoryById.bind(categoryController));

// Public Billing Information Route (only GET)
router.get('/billing', billingController.getBillingInfo.bind(billingController));

// Public Hero Media Route (only GET)
router.get('/hero-media', customizationController.getHeroMedia.bind(customizationController));

// Public Hero Content Route (only GET)
router.get('/hero-content', customizationController.getHeroContent.bind(customizationController));

// Public Site Settings Route (only GET)
router.get('/site-settings', siteSettingsController.getSiteSettings.bind(siteSettingsController));

module.exports = router;
