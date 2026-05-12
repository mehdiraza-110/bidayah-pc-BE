const categoryService = require('../services/category.service');
const vendorService = require('../services/vendor.service');
const pcBuilderFilterRuleService = require('../services/pcBuilderFilterRule.service');

class PublicPcBuilderController {
  parseBoolean(value) {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === 'true';
  }

  async getOptions(req, res) {
    try {
      const [categories, vendors] = await Promise.all([
        categoryService.getAllCategories(),
        vendorService.getAllVendors()
      ]);

      res.status(200).json({
        success: true,
        message: 'PC builder options retrieved successfully',
        data: {
          categories,
          vendors
        },
        counts: {
          categories: categories.length,
          vendors: vendors.length
        }
      });
    } catch (error) {
      console.error('Error fetching public PC builder options:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder options',
        error: error.message
      });
    }
  }

  async getProducts(req, res) {
    try {
      const selectedCategoryId = req.query.selected_category_id || req.query.category_id;
      const selectedVendorId = req.query.selected_vendor_id || req.query.vendor_id;

      if (!selectedCategoryId) {
        return res.status(400).json({
          success: false,
          message: 'selected_category_id or category_id is required'
        });
      }

      const filters = {
        selected_category_id: selectedCategoryId,
        selected_vendor_id: selectedVendorId,
        result_category_id: req.query.result_category_id,
        status: 'published',
        in_stock: this.parseBoolean(req.query.in_stock)
      };

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const result = await pcBuilderFilterRuleService.getProductsForSelection(filters);

      res.status(200).json({
        success: true,
        message: 'Matching PC builder products retrieved successfully',
        data: result.products,
        applied_rules: result.rules.map(rule => ({
          id: rule.id,
          rule_name: rule.rule_name,
          selected_category_id: rule.selected_category_id,
          selected_vendor_id: rule.selected_vendor_id,
          result_category_id: rule.result_category_id,
          result_vendor_id: rule.result_vendor_id,
          priority: rule.priority
        })),
        count: result.products.length
      });
    } catch (error) {
      console.error('Error fetching public PC builder products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder products',
        error: error.message
      });
    }
  }
}

module.exports = new PublicPcBuilderController();
