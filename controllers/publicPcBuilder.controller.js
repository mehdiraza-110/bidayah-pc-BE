const vendorService = require('../services/vendor.service');
const pcBuilderFilterRuleService = require('../services/pcBuilderFilterRule.service');
const pcBuilderCategoryService = require('../services/pcBuilderCategory.service');

class PublicPcBuilderController {
  parseBoolean(value) {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === 'true';
  }

  parsePriorSelections(value) {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(item => item && item.category_id && item.vendor_id)
        .map(item => ({ category_id: item.category_id, vendor_id: item.vendor_id }));
    } catch (error) {
      return [];
    }
  }

  async getOptions(req, res) {
    try {
      const [categories, vendors] = await Promise.all([
        pcBuilderCategoryService.getActiveOrdered(),
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
      const priorSelections = this.parsePriorSelections(req.query.prior_selections);

      if (!selectedCategoryId) {
        return res.status(400).json({
          success: false,
          message: 'selected_category_id or category_id is required'
        });
      }

      const products = await pcBuilderFilterRuleService.getProductsForCategorySelection({
        categoryId: selectedCategoryId,
        vendorId: selectedVendorId,
        priorSelections,
        status: 'published',
        inStock: this.parseBoolean(req.query.in_stock)
      });

      res.status(200).json({
        success: true,
        message: 'Matching PC builder products retrieved successfully',
        data: products,
        count: products.length
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

  async getVendorsForCategory(req, res) {
    try {
      const categoryId = req.query.category_id;
      const priorSelections = this.parsePriorSelections(req.query.prior_selections);

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: 'category_id is required'
        });
      }

      const vendors = await pcBuilderFilterRuleService.getVendorsForSelection(categoryId, priorSelections);

      res.status(200).json({
        success: true,
        message: 'PC builder vendors retrieved successfully',
        data: vendors,
        count: vendors.length
      });
    } catch (error) {
      console.error('Error fetching public PC builder vendors:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder vendors',
        error: error.message
      });
    }
  }
}

module.exports = new PublicPcBuilderController();
