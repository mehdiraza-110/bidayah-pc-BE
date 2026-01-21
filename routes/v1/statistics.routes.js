const express = require('express');
const router = express.Router();
const statisticsController = require('../../controllers/statistics.controller');

// Get dashboard statistics
router.get('/dashboard', statisticsController.getDashboardStats.bind(statisticsController));

// Get top products by sales
router.get('/top-products', statisticsController.getTopProductsBySales.bind(statisticsController));

// Get monthly sales for last 12 months
router.get('/monthly-sales', statisticsController.getMonthlySales.bind(statisticsController));

module.exports = router;
