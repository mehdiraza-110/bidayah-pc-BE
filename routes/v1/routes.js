const express = require('express');
const router = express.Router();
const userRoutes = require('./user.routes');
const vendorRoutes = require('./vendor.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const billingRoutes = require('./billing.routes');
const orderRoutes = require('./order.routes');
const statisticsRoutes = require('./statistics.routes');
const publicRoutes = require('./public.routes');
const customizationRoutes = require('./customization.routes');
const pcBuilderFilterRuleRoutes = require('./pc-builder-filter-rule.routes');
const keyFeatureRoutes = require('./key-feature.routes');

// Public routes (read-only, no authentication required)
router.use('/public', publicRoutes);

// User routes
router.use('/users', userRoutes);

// Vendor routes
router.use('/vendors', vendorRoutes);

// Category routes
router.use('/categories', categoryRoutes);

// Product routes
router.use('/products', productRoutes);

// Key feature routes
router.use('/key-features', keyFeatureRoutes);

// Billing routes (admin only)
router.use('/billing', billingRoutes);

// Order routes (public checkout)
router.use('/orders', orderRoutes);

// Statistics routes
router.use('/statistics', statisticsRoutes);

// Customization routes (admin only)
router.use('/customization', customizationRoutes);

// PC builder filter rule routes (admin only)
router.use('/pc-builder-filter-rules', pcBuilderFilterRuleRoutes);

module.exports = router;
