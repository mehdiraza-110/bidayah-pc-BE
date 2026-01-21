const express = require('express');
const router = express.Router();
const customizationController = require('../../controllers/customization.controller');
const { upload } = require('../../config/multer.config');
const AuthGuard = require('../../middlewares/jwt.middleware');

// Admin route: Create or update hero media
// Accepts multipart/form-data with files named as media_0, media_1, etc.
router.post(
  '/hero-media',
  upload.fields([
    { name: 'media_0', maxCount: 1 },
    { name: 'media_1', maxCount: 1 },
    { name: 'media_2', maxCount: 1 },
    { name: 'media_3', maxCount: 1 },
    { name: 'media_4', maxCount: 1 },
    { name: 'media_5', maxCount: 1 },
    { name: 'media_6', maxCount: 1 }
  ]),
  customizationController.upsertHeroMedia.bind(customizationController)
);

module.exports = router;
