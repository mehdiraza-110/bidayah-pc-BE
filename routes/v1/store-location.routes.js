const express = require('express');
const router = express.Router();
const storeLocationController = require('../../controllers/storeLocation.controller');

// Create a new store location
router.post('/', storeLocationController.createStoreLocation.bind(storeLocationController));

// Get all store locations
router.get('/', storeLocationController.getAllStoreLocations.bind(storeLocationController));

// Get store location by ID
router.get('/:id', storeLocationController.getStoreLocationById.bind(storeLocationController));

// Update store location
router.put('/:id', storeLocationController.updateStoreLocation.bind(storeLocationController));
router.patch('/:id', storeLocationController.updateStoreLocation.bind(storeLocationController));

// Delete store location
router.delete('/:id', storeLocationController.deleteStoreLocation.bind(storeLocationController));

module.exports = router;
