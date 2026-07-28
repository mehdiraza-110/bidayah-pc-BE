const siteSettingsService = require('../services/siteSettings.service');

class SiteSettingsController {
  // Get site settings (public)
  async getSiteSettings(req, res) {
    try {
      const settings = await siteSettingsService.getSiteSettings();

      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching site settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching site settings',
        error: error.message
      });
    }
  }

  // Create or update site settings (admin)
  async upsertSiteSettings(req, res) {
    try {
      const { whatsapp_number } = req.body;

      const settings = await siteSettingsService.upsertSiteSettings({ whatsapp_number });

      res.status(200).json({
        success: true,
        message: 'Settings updated',
        data: settings
      });
    } catch (error) {
      console.error('Error updating site settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating site settings',
        error: error.message
      });
    }
  }
}

module.exports = new SiteSettingsController();
