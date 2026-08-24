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
      const { whatsapp_number, featured_gaming_pcs_limit } = req.body;
      const updatePayload = {};
      if (whatsapp_number !== undefined) updatePayload.whatsapp_number = whatsapp_number;
      if (featured_gaming_pcs_limit !== undefined) {
        const parsedLimit = parseInt(featured_gaming_pcs_limit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
          return res.status(400).json({ success: false, message: 'featured_gaming_pcs_limit must be a non-negative integer' });
        }
        updatePayload.featured_gaming_pcs_limit = parsedLimit;
      }

      const settings = await siteSettingsService.upsertSiteSettings(updatePayload);

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
