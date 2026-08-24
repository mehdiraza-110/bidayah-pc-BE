const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');
const blogController = require('../../controllers/blog.controller');
const vendorController = require('../../controllers/vendor.controller');
const categoryController = require('../../controllers/category.controller');
const billingController = require('../../controllers/billing.controller');
const customizationController = require('../../controllers/customization.controller');
const publicPcBuilderController = require('../../controllers/publicPcBuilder.controller');
const siteSettingsController = require('../../controllers/siteSettings.controller');
const storeLocationController = require('../../controllers/storeLocation.controller');
const homepageSectionController = require('../../controllers/homepageSection.controller');
const featuredGamingPcController = require('../../controllers/featuredGamingPc.controller');

// Middleware to check if a product is actually visible on the storefront
// (own status published, AND its category/vendors haven't since been
// unpublished — see ProductService#isPubliclyVisible).
const checkPublishedProduct = async (req, res, next) => {
  const productService = require('../../services/product.service');
  const { id } = req.params;

  try {
    const visible = await productService.isPubliclyVisible(id);

    if (!visible) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking product status',
      error: error.message
    });
  }
};

// Same as checkPublishedProduct, but for the slug-based lookup route.
const checkPublishedProductBySlug = async (req, res, next) => {
  const productService = require('../../services/product.service');
  const { slug } = req.params;

  try {
    const visible = await productService.isPubliclyVisibleBySlug(slug);

    if (!visible) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

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
  // Force status + published-category/vendor filters for public endpoints
  req.query.status = 'published';
  req.query.public_only = 'true';
  next();
}, productController.getAllProducts.bind(productController));

router.get('/products/slug/:slug', checkPublishedProductBySlug, productController.getProductBySlug.bind(productController));
router.get('/products/:id', checkPublishedProduct, productController.getProductById.bind(productController));

// Public PC Builder Routes (only GET, only published products)
router.get('/pc-builder/options', publicPcBuilderController.getOptions.bind(publicPcBuilderController));
router.get('/pc-builder/products', publicPcBuilderController.getProducts.bind(publicPcBuilderController));
router.get('/pc-builder/vendors', publicPcBuilderController.getVendorsForCategory.bind(publicPcBuilderController));

// Public Vendors Routes (only GET, only published vendors)
router.get('/vendors', (req, res, next) => {
  // Force is_published filter for public endpoints
  req.query.is_published = 'true';
  next();
}, vendorController.getAllVendors.bind(vendorController));
router.get('/vendors/:id', (req, res, next) => {
  req.query.public_only = 'true';
  next();
}, vendorController.getVendorById.bind(vendorController));

// Public Store Locations Route (only GET, only active locations)
router.get('/store-locations', (req, res, next) => {
  // Force active_only filter for public endpoints
  req.query.active_only = 'true';
  next();
}, storeLocationController.getAllStoreLocations.bind(storeLocationController));

// Public Categories Routes (only GET, only published categories)
router.get('/categories', (req, res, next) => {
  // Force is_published filter for public endpoints
  req.query.is_published = 'true';
  next();
}, categoryController.getAllCategories.bind(categoryController));
router.get('/categories/:id', (req, res, next) => {
  req.query.public_only = 'true';
  next();
}, categoryController.getCategoryById.bind(categoryController));

// Public "Specifications" filters for a category's product-listing page
router.get('/categories/:id/filters', categoryController.getCategoryFilters.bind(categoryController));

// Public Billing Information Route (only GET)
router.get('/billing', billingController.getBillingInfo.bind(billingController));

// Same as checkPublishedProduct/BySlug, but for blogs.
const checkPublishedBlogBySlug = async (req, res, next) => {
  const blogService = require('../../services/blog.service');
  const { slug } = req.params;

  try {
    const visible = await blogService.isPubliclyVisibleBySlug(slug);

    if (!visible) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking blog status',
      error: error.message
    });
  }
};

// Public Blogs Routes (only GET, only published posts)
router.get('/blogs', (req, res, next) => {
  req.query.status = 'published';
  next();
}, blogController.getAllBlogs.bind(blogController));
router.get('/blogs/slug/:slug', checkPublishedBlogBySlug, blogController.getBlogBySlug.bind(blogController));

// Public Hero Media Route (only GET)
router.get('/hero-media', customizationController.getHeroMedia.bind(customizationController));

// Public Hero Content Route (only GET)
router.get('/hero-content', customizationController.getHeroContent.bind(customizationController));

// Public Site Settings Route (only GET)
router.get('/site-settings', siteSettingsController.getSiteSettings.bind(siteSettingsController));

// Public Homepage Sections Route (only GET, only active sections w/ published category)
router.get('/homepage-sections', homepageSectionController.getActiveForPublic.bind(homepageSectionController));

// Public Featured Gaming PCs Routes (only GET, only active builds)
router.get('/featured-gaming-pcs', featuredGamingPcController.getActiveForPublic.bind(featuredGamingPcController));
// Must be registered before /:id so "slug" isn't swallowed by the :id param route.
router.get('/featured-gaming-pcs/slug/:slug', featuredGamingPcController.getBySlugForPublic.bind(featuredGamingPcController));
router.get('/featured-gaming-pcs/:id', featuredGamingPcController.getByIdForPublic.bind(featuredGamingPcController));

module.exports = router;
