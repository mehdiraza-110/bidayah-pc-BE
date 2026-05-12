const express = require('express');
const router = express.Router();
const pcBuilderFilterRuleController = require('../../controllers/pcBuilderFilterRule.controller');

// Preview matching products for a selected category/vendor combination
router.get('/preview', pcBuilderFilterRuleController.previewSelection.bind(pcBuilderFilterRuleController));

// Create a new PC builder filter rule
router.post('/', pcBuilderFilterRuleController.createRule.bind(pcBuilderFilterRuleController));

// Get all PC builder filter rules
router.get('/', pcBuilderFilterRuleController.getAllRules.bind(pcBuilderFilterRuleController));

// Preview matching products for a single rule
router.get('/:id/preview', pcBuilderFilterRuleController.previewRule.bind(pcBuilderFilterRuleController));

// Get PC builder filter rule by ID
router.get('/:id', pcBuilderFilterRuleController.getRuleById.bind(pcBuilderFilterRuleController));

// Update PC builder filter rule
router.put('/:id', pcBuilderFilterRuleController.updateRule.bind(pcBuilderFilterRuleController));
router.patch('/:id', pcBuilderFilterRuleController.updateRule.bind(pcBuilderFilterRuleController));

// Delete PC builder filter rule
router.delete('/:id', pcBuilderFilterRuleController.deleteRule.bind(pcBuilderFilterRuleController));

module.exports = router;
