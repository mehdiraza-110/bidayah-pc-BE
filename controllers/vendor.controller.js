const vendorService = require('../services/vendor.service');

class VendorController {
  // Create a new vendor
  async createVendor(req, res) {
    try {
      const { vendor_name } = req.body;
      
      // Validation
      if (!vendor_name) {
        return res.status(400).json({
          success: false,
          message: 'Vendor name is required'
        });
      }
      
      // Check if vendor already exists
      const existingVendor = await vendorService.getVendorByName(vendor_name);
      if (existingVendor) {
        return res.status(409).json({
          success: false,
          message: 'Vendor with this name already exists'
        });
      }
      
      const vendorData = { vendor_name };
      const newVendor = await vendorService.createVendor(vendorData);
      
      res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        data: newVendor
      });
    } catch (error) {
      console.error('Error creating vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating vendor',
        error: error.message
      });
    }
  }
  
  // Get all vendors
  async getAllVendors(req, res) {
    try {
      const vendors = await vendorService.getAllVendors();
      
      res.status(200).json({
        success: true,
        message: 'Vendors retrieved successfully',
        data: vendors,
        count: vendors.length
      });
    } catch (error) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching vendors',
        error: error.message
      });
    }
  }
  
  // Get vendor by ID
  async getVendorById(req, res) {
    try {
      const { id } = req.params;
      const vendor = await vendorService.getVendorById(id);
      
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Vendor retrieved successfully',
        data: vendor
      });
    } catch (error) {
      console.error('Error fetching vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching vendor',
        error: error.message
      });
    }
  }
  
  // Update vendor
  async updateVendor(req, res) {
    try {
      const { id } = req.params;
      const { vendor_name } = req.body;
      
      if (!vendor_name) {
        return res.status(400).json({
          success: false,
          message: 'Vendor name is required'
        });
      }
      
      // Check if vendor name is already taken by another vendor
      const existingVendor = await vendorService.getVendorByName(vendor_name);
      if (existingVendor && existingVendor.id !== id) {
        return res.status(409).json({
          success: false,
          message: 'Vendor name is already taken by another vendor'
        });
      }
      
      const vendorData = { vendor_name };
      const updatedVendor = await vendorService.updateVendor(id, vendorData);
      
      res.status(200).json({
        success: true,
        message: 'Vendor updated successfully',
        data: updatedVendor
      });
    } catch (error) {
      console.error('Error updating vendor:', error);
      
      if (error.message === 'Vendor not found') {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating vendor',
        error: error.message
      });
    }
  }
  
  // Delete vendor
  async deleteVendor(req, res) {
    try {
      const { id } = req.params;
      const result = await vendorService.deleteVendor(id);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id, vendor_name: result.vendor_name }
      });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      
      if (error.message === 'Vendor not found') {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting vendor',
        error: error.message
      });
    }
  }
}

module.exports = new VendorController();
