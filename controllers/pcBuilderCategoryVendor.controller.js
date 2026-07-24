const pcBuilderCategoryVendorService = require('../services/pcBuilderCategoryVendor.service');
const categoryService = require('../services/category.service');
const vendorService = require('../services/vendor.service');

class PcBuilderCategoryVendorController {
  // Everything the admin UI needs to build the per-category vendor picker in one call
  async getConfig(req, res) {
    try {
      const [categories, vendors, associations] = await Promise.all([
        categoryService.getAllCategories(),
        vendorService.getAllVendors(),
        pcBuilderCategoryVendorService.getAllAssociations(),
      ]);

      res.status(200).json({
        success: true,
        message: 'PC builder category vendor config retrieved successfully',
        data: {
          categories,
          vendors,
          associations,
        },
      });
    } catch (error) {
      console.error('Error fetching PC builder category vendor config:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder category vendor config',
        error: error.message
      });
    }
  }

  async updateForCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const { vendor_ids: vendorIds } = req.body;

      if (!Array.isArray(vendorIds)) {
        return res.status(400).json({
          success: false,
          message: 'vendor_ids must be an array'
        });
      }

      const vendors = await pcBuilderCategoryVendorService.replaceForCategory(categoryId, vendorIds);

      res.status(200).json({
        success: true,
        message: 'PC builder category vendors updated successfully',
        data: vendors
      });
    } catch (error) {
      console.error('Error updating PC builder category vendors:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error updating PC builder category vendors'
      });
    }
  }
}

module.exports = new PcBuilderCategoryVendorController();
