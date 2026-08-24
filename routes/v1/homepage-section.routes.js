const express = require('express');
const router = express.Router();
const homepageSectionController = require('../../controllers/homepageSection.controller');
const { upload } = require('../../config/multer.config');

// A section can carry one optional tile photo, uploaded as multipart alongside
// its other fields.
const sectionImageUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

// Get all homepage sections (admin view, includes inactive)
router.get('/', homepageSectionController.getAll.bind(homepageSectionController));

// Create a new homepage section (with optional image upload)
router.post('/', sectionImageUpload, homepageSectionController.create.bind(homepageSectionController));

// Bulk-persist a new display order — must be registered before /:id so
// "reorder" isn't swallowed by the :id param route.
router.put('/reorder', homepageSectionController.reorder.bind(homepageSectionController));

// Update a homepage section (with optional image upload)
router.put('/:id', sectionImageUpload, homepageSectionController.update.bind(homepageSectionController));

// Delete a homepage section
router.delete('/:id', homepageSectionController.remove.bind(homepageSectionController));

module.exports = router;
