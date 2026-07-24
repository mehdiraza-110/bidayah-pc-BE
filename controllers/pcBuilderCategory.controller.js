const pcBuilderCategoryService = require('../services/pcBuilderCategory.service');

class PcBuilderCategoryController {
  async getConfig(req, res) {
    try {
      const categories = await pcBuilderCategoryService.getAllWithConfig();

      res.status(200).json({
        success: true,
        message: 'PC builder category config retrieved successfully',
        data: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Error fetching PC builder category config:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder category config',
        error: error.message
      });
    }
  }

  async updateConfig(req, res) {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories)) {
        return res.status(400).json({
          success: false,
          message: 'categories must be an array'
        });
      }

      const updated = await pcBuilderCategoryService.replaceConfig(categories);

      res.status(200).json({
        success: true,
        message: 'PC builder category config updated successfully',
        data: updated,
        count: updated.length
      });
    } catch (error) {
      console.error('Error updating PC builder category config:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error updating PC builder category config'
      });
    }
  }
}

module.exports = new PcBuilderCategoryController();
