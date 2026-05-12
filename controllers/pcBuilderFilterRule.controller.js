const pcBuilderFilterRuleService = require('../services/pcBuilderFilterRule.service');

class PcBuilderFilterRuleController {
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

  buildRuleData(body, partial = false) {
    const specMatchTerms = pcBuilderFilterRuleService.normalizeSpecTerms(body.spec_match_terms);
    const isActive = this.parseBoolean(body.is_active);

    const ruleData = {};

    [
      'rule_name',
      'selected_category_id',
      'selected_vendor_id',
      'result_category_id',
      'result_vendor_id',
      'spec_match_mode'
    ].forEach(field => {
      if (body[field] !== undefined) {
        ruleData[field] = body[field] || null;
      }
    });

    if (specMatchTerms !== undefined) {
      ruleData.spec_match_terms = specMatchTerms;
    }

    if (body.priority !== undefined) {
      ruleData.priority = this.parseInteger(body.priority, 0);
    }

    if (isActive !== undefined) {
      ruleData.is_active = isActive;
    }

    if (!partial) {
      ruleData.spec_match_terms = ruleData.spec_match_terms || [];
      ruleData.spec_match_mode = ruleData.spec_match_mode || 'any';
      ruleData.priority = ruleData.priority || 0;
      ruleData.is_active = ruleData.is_active !== undefined ? ruleData.is_active : true;
    }

    return ruleData;
  }

  validateRuleData(ruleData, partial = false) {
    const requiredFields = ['rule_name', 'selected_category_id', 'result_category_id'];

    if (!partial) {
      for (const field of requiredFields) {
        if (!ruleData[field]) {
          return `${field} is required`;
        }
      }
    }

    if (
      ruleData.spec_match_mode !== undefined &&
      !['any', 'all'].includes(ruleData.spec_match_mode)
    ) {
      return 'spec_match_mode must be either any or all';
    }

    if (
      ruleData.priority !== undefined &&
      (Number.isNaN(ruleData.priority) || ruleData.priority < 0)
    ) {
      return 'priority must be a non-negative number';
    }

    return null;
  }

  async createRule(req, res) {
    try {
      const ruleData = this.buildRuleData(req.body);
      const validationError = this.validateRuleData(ruleData);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const newRule = await pcBuilderFilterRuleService.createRule(ruleData);

      res.status(201).json({
        success: true,
        message: 'PC builder filter rule created successfully',
        data: newRule
      });
    } catch (error) {
      console.error('Error creating PC builder filter rule:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating PC builder filter rule',
        error: error.message
      });
    }
  }

  async getAllRules(req, res) {
    try {
      const filters = {
        selected_category_id: req.query.selected_category_id,
        selected_vendor_id: req.query.selected_vendor_id,
        result_category_id: req.query.result_category_id,
        result_vendor_id: req.query.result_vendor_id,
        is_active: this.parseBoolean(req.query.is_active)
      };

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const rules = await pcBuilderFilterRuleService.getAllRules(filters);

      res.status(200).json({
        success: true,
        message: 'PC builder filter rules retrieved successfully',
        data: rules,
        count: rules.length
      });
    } catch (error) {
      console.error('Error fetching PC builder filter rules:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder filter rules',
        error: error.message
      });
    }
  }

  async getRuleById(req, res) {
    try {
      const rule = await pcBuilderFilterRuleService.getRuleById(req.params.id);

      if (!rule) {
        return res.status(404).json({
          success: false,
          message: 'PC builder filter rule not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'PC builder filter rule retrieved successfully',
        data: rule
      });
    } catch (error) {
      console.error('Error fetching PC builder filter rule:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching PC builder filter rule',
        error: error.message
      });
    }
  }

  async updateRule(req, res) {
    try {
      const ruleData = this.buildRuleData(req.body, true);
      const validationError = this.validateRuleData(ruleData, true);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      if (Object.keys(ruleData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      const updatedRule = await pcBuilderFilterRuleService.updateRule(req.params.id, ruleData);

      res.status(200).json({
        success: true,
        message: 'PC builder filter rule updated successfully',
        data: updatedRule
      });
    } catch (error) {
      console.error('Error updating PC builder filter rule:', error);

      if (error.message === 'Rule not found') {
        return res.status(404).json({
          success: false,
          message: 'PC builder filter rule not found'
        });
      }

      if (error.message === 'No fields to update') {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating PC builder filter rule',
        error: error.message
      });
    }
  }

  async deleteRule(req, res) {
    try {
      const result = await pcBuilderFilterRuleService.deleteRule(req.params.id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          id: result.id,
          rule_name: result.rule_name
        }
      });
    } catch (error) {
      console.error('Error deleting PC builder filter rule:', error);

      if (error.message === 'Rule not found') {
        return res.status(404).json({
          success: false,
          message: 'PC builder filter rule not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting PC builder filter rule',
        error: error.message
      });
    }
  }

  async previewRule(req, res) {
    try {
      const filters = {
        status: req.query.status,
        in_stock: this.parseBoolean(req.query.in_stock)
      };

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const products = await pcBuilderFilterRuleService.getMatchingProducts(req.params.id, filters);

      res.status(200).json({
        success: true,
        message: 'Matching products retrieved successfully',
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error previewing PC builder filter rule:', error);

      if (error.message === 'Rule not found') {
        return res.status(404).json({
          success: false,
          message: 'PC builder filter rule not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error previewing PC builder filter rule',
        error: error.message
      });
    }
  }

  async previewSelection(req, res) {
    try {
      const filters = {
        selected_category_id: req.query.selected_category_id,
        selected_vendor_id: req.query.selected_vendor_id,
        result_category_id: req.query.result_category_id,
        status: req.query.status,
        in_stock: this.parseBoolean(req.query.in_stock)
      };

      if (!filters.selected_category_id) {
        return res.status(400).json({
          success: false,
          message: 'selected_category_id is required'
        });
      }

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const result = await pcBuilderFilterRuleService.getProductsForSelection(filters);

      res.status(200).json({
        success: true,
        message: 'Matching PC builder products retrieved successfully',
        data: result.products,
        rules: result.rules,
        count: result.products.length
      });
    } catch (error) {
      console.error('Error previewing PC builder selection:', error);
      res.status(500).json({
        success: false,
        message: 'Error previewing PC builder selection',
        error: error.message
      });
    }
  }
}

module.exports = new PcBuilderFilterRuleController();
