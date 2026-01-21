const statisticsService = require('../services/statistics.service');

class StatisticsController {
  // Get dashboard statistics
  async getDashboardStats(req, res) {
    try {
      const stats = await statisticsService.getDashboardStats();
      
      res.status(200).json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  }
  
  // Get top products by sales
  async getTopProductsBySales(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }
      
      const topProducts = await statisticsService.getTopProductsBySales(limit);
      
      res.status(200).json({
        success: true,
        message: 'Top products by sales retrieved successfully',
        data: topProducts,
        count: topProducts.length
      });
    } catch (error) {
      console.error('Error fetching top products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching top products',
        error: error.message
      });
    }
  }
  
  // Get monthly sales for last 12 months
  async getMonthlySales(req, res) {
    try {
      const monthlySales = await statisticsService.getMonthlySales();
      
      res.status(200).json({
        success: true,
        message: 'Monthly sales retrieved successfully',
        data: monthlySales,
        count: monthlySales.length
      });
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching monthly sales',
        error: error.message
      });
    }
  }
}

module.exports = new StatisticsController();
