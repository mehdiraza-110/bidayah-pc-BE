const keyFeatureService = require('../services/keyFeature.service');

class KeyFeatureController {
  parseBoolean(value) {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === 'true';
  }

  parseInteger(value, fallback = undefined) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return parseInt(value, 10);
  }

  buildFeatureData(body, partial = false) {
    const featureData = {};

    ['category_id', 'feature_key'].forEach(field => {
      if (body[field] !== undefined) {
        featureData[field] = body[field];
      }
    });

    if (body.display_order !== undefined) {
      featureData.display_order = this.parseInteger(body.display_order, 0);
    }

    if (body.is_active !== undefined) {
      featureData.is_active = this.parseBoolean(body.is_active);
    }

    if (!partial) {
      featureData.display_order = featureData.display_order || 0;
      featureData.is_active = featureData.is_active !== undefined ? featureData.is_active : true;
    }

    return featureData;
  }

  validateFeatureData(featureData, partial = false) {
    if (!partial && !featureData.category_id) {
      return 'category_id is required';
    }

    if (!partial && !featureData.feature_key) {
      return 'feature_key is required';
    }

    if (featureData.feature_key !== undefined && !String(featureData.feature_key).trim()) {
      return 'feature_key cannot be empty';
    }

    if (
      featureData.display_order !== undefined &&
      (Number.isNaN(featureData.display_order) || featureData.display_order < 0)
    ) {
      return 'display_order must be a non-negative number';
    }

    return null;
  }

  async createKeyFeature(req, res) {
    try {
      const featureData = this.buildFeatureData(req.body);
      const validationError = this.validateFeatureData(featureData);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const newFeature = await keyFeatureService.createKeyFeature(featureData);

      res.status(201).json({
        success: true,
        message: 'Key feature created successfully',
        data: newFeature
      });
    } catch (error) {
      console.error('Error creating key feature:', error);

      if (error.message === 'Key feature already exists for this category') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error creating key feature',
        error: error.message
      });
    }
  }

  async getAllKeyFeatures(req, res) {
    try {
      const filters = {
        category_id: req.query.category_id,
        is_active: this.parseBoolean(req.query.is_active)
      };

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const features = await keyFeatureService.getAllKeyFeatures(filters);

      res.status(200).json({
        success: true,
        message: 'Key features retrieved successfully',
        data: features,
        count: features.length
      });
    } catch (error) {
      console.error('Error fetching key features:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching key features',
        error: error.message
      });
    }
  }

  async getKeyFeatureById(req, res) {
    try {
      const feature = await keyFeatureService.getKeyFeatureById(req.params.id);

      if (!feature) {
        return res.status(404).json({
          success: false,
          message: 'Key feature not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Key feature retrieved successfully',
        data: feature
      });
    } catch (error) {
      console.error('Error fetching key feature:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching key feature',
        error: error.message
      });
    }
  }

  async updateKeyFeature(req, res) {
    try {
      const featureData = this.buildFeatureData(req.body, true);
      const validationError = this.validateFeatureData(featureData, true);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      if (Object.keys(featureData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      const updatedFeature = await keyFeatureService.updateKeyFeature(req.params.id, featureData);

      res.status(200).json({
        success: true,
        message: 'Key feature updated successfully',
        data: updatedFeature
      });
    } catch (error) {
      console.error('Error updating key feature:', error);

      if (error.message === 'Key feature not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'Key feature already exists for this category') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'No fields to update') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating key feature',
        error: error.message
      });
    }
  }

  async deleteKeyFeature(req, res) {
    try {
      const result = await keyFeatureService.deleteKeyFeature(req.params.id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          id: result.id,
          feature_key: result.feature_key
        }
      });
    } catch (error) {
      console.error('Error deleting key feature:', error);

      if (error.message === 'Key feature not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting key feature',
        error: error.message
      });
    }
  }
}

module.exports = new KeyFeatureController();
