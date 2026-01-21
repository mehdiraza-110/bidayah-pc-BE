const express = require('express');
const router = express.Router();
const vendorController = require('../../controllers/vendor.controller');

// Create a new vendor
router.post('/', vendorController.createVendor.bind(vendorController));

// Get all vendors
router.get('/', vendorController.getAllVendors.bind(vendorController));

// Get vendor by ID
router.get('/:id', vendorController.getVendorById.bind(vendorController));

// Update vendor
router.put('/:id', vendorController.updateVendor.bind(vendorController));
router.patch('/:id', vendorController.updateVendor.bind(vendorController));

// Delete vendor
router.delete('/:id', vendorController.deleteVendor.bind(vendorController));

module.exports = router;
