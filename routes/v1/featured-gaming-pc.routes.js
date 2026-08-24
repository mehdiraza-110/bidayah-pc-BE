const express = require('express');
const router = express.Router();
const featuredGamingPcController = require('../../controllers/featuredGamingPc.controller');
const { upload } = require('../../config/multer.config');

// Up to 5 gallery photos per build, uploaded as multipart alongside its other fields.
const gamingPcImageUpload = upload.fields([{ name: 'images', maxCount: 5 }]);

// Get all featured gaming PCs (admin view, includes inactive)
router.get('/', featuredGamingPcController.getAll.bind(featuredGamingPcController));

// Get one featured gaming PC (admin edit form)
router.get('/:id', featuredGamingPcController.getById.bind(featuredGamingPcController));

// Create a new featured gaming PC (with image upload)
router.post('/', gamingPcImageUpload, featuredGamingPcController.create.bind(featuredGamingPcController));

// Bulk-persist a new display order — must be registered before /:id so
// "reorder" isn't swallowed by the :id param route.
router.put('/reorder', featuredGamingPcController.reorder.bind(featuredGamingPcController));

// Update a featured gaming PC (with optional image re-upload)
router.put('/:id', gamingPcImageUpload, featuredGamingPcController.update.bind(featuredGamingPcController));

// Delete a featured gaming PC
router.delete('/:id', featuredGamingPcController.remove.bind(featuredGamingPcController));

module.exports = router;
