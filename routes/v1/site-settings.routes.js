const express = require('express');
const router = express.Router();
const siteSettingsController = require('../../controllers/siteSettings.controller');

router.get('/', siteSettingsController.getSiteSettings.bind(siteSettingsController));
router.put('/', siteSettingsController.upsertSiteSettings.bind(siteSettingsController));

module.exports = router;
