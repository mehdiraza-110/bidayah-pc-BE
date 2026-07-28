const storeLocationService = require('../services/storeLocation.service');

class StoreLocationController {
  // Create a new store location
  async createStoreLocation(req, res) {
    try {
      const { name, address, city, is_active } = req.body;

      // Validation
      if (!name || !address) {
        return res.status(400).json({
          success: false,
          message: 'Name and address are required'
        });
      }

      const locationData = { name, address, city, is_active };
      const newLocation = await storeLocationService.createStoreLocation(locationData);

      res.status(201).json({
        success: true,
        message: 'Store location created successfully',
        data: newLocation
      });
    } catch (error) {
      console.error('Error creating store location:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating store location',
        error: error.message
      });
    }
  }

  // Get all store locations
  async getAllStoreLocations(req, res) {
    try {
      const filters = { activeOnly: req.query.active_only === 'true' };
      const locations = await storeLocationService.getAllStoreLocations(filters);

      res.status(200).json({
        success: true,
        message: 'Store locations retrieved successfully',
        data: locations,
        count: locations.length
      });
    } catch (error) {
      console.error('Error fetching store locations:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching store locations',
        error: error.message
      });
    }
  }

  // Get store location by ID
  async getStoreLocationById(req, res) {
    try {
      const { id } = req.params;
      const location = await storeLocationService.getStoreLocationById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Store location not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Store location retrieved successfully',
        data: location
      });
    } catch (error) {
      console.error('Error fetching store location:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching store location',
        error: error.message
      });
    }
  }

  // Update store location
  async updateStoreLocation(req, res) {
    try {
      const { id } = req.params;
      const { name, address, city, is_active } = req.body;

      if (!name || !address) {
        return res.status(400).json({
          success: false,
          message: 'Name and address are required'
        });
      }

      const locationData = { name, address, city, is_active: is_active === undefined ? true : is_active };
      const updatedLocation = await storeLocationService.updateStoreLocation(id, locationData);

      res.status(200).json({
        success: true,
        message: 'Store location updated successfully',
        data: updatedLocation
      });
    } catch (error) {
      console.error('Error updating store location:', error);

      if (error.message === 'Store location not found') {
        return res.status(404).json({
          success: false,
          message: 'Store location not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating store location',
        error: error.message
      });
    }
  }

  // Delete store location
  async deleteStoreLocation(req, res) {
    try {
      const { id } = req.params;
      const result = await storeLocationService.deleteStoreLocation(id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id, name: result.name }
      });
    } catch (error) {
      console.error('Error deleting store location:', error);

      if (error.message === 'Store location not found') {
        return res.status(404).json({
          success: false,
          message: 'Store location not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting store location',
        error: error.message
      });
    }
  }
}

module.exports = new StoreLocationController();
