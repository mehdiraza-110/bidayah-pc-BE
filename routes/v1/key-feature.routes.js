const express = require('express');
const router = express.Router();
const keyFeatureController = require('../../controllers/keyFeature.controller');

// Create a new reusable key feature for a category
router.post('/', keyFeatureController.createKeyFeature.bind(keyFeatureController));

// Get key features, optionally filtered by category
router.get('/', keyFeatureController.getAllKeyFeatures.bind(keyFeatureController));

// Get key feature by ID
router.get('/:id', keyFeatureController.getKeyFeatureById.bind(keyFeatureController));

// Update key feature
router.put('/:id', keyFeatureController.updateKeyFeature.bind(keyFeatureController));
router.patch('/:id', keyFeatureController.updateKeyFeature.bind(keyFeatureController));

// Delete key feature
router.delete('/:id', keyFeatureController.deleteKeyFeature.bind(keyFeatureController));

module.exports = router;
