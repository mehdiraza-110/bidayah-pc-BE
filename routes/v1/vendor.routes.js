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

// Preview cascade impact of unpublishing this vendor
router.get('/:id/unpublish-impact', vendorController.getUnpublishImpact.bind(vendorController));
router.get('/:id/unpublish-impact/products', vendorController.getUnpublishImpactProducts.bind(vendorController));

// Publish/unpublish (cascades to the vendor's products when unpublishing)
router.patch('/:id/publish-status', vendorController.setPublishStatus.bind(vendorController));

// Delete vendor
router.delete('/:id', vendorController.deleteVendor.bind(vendorController));

module.exports = router;
