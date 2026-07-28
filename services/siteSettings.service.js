const db = require('../config/db.config');

class SiteSettingsService {
  // Get site settings — singleton row
  async getSiteSettings() {
    const result = await db.query(
      `SELECT * FROM site_settings ORDER BY created_at ASC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { whatsapp_number: null };
    }

    return result.rows[0];
  }

  // Create or update site settings — enforces a single row
  async upsertSiteSettings(settings) {
    const existing = await db.query('SELECT id FROM site_settings LIMIT 1');

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE site_settings SET
           whatsapp_number = $1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [settings.whatsapp_number, existing.rows[0].id]
      );

      return result.rows[0];
    }

    const result = await db.query(
      `INSERT INTO site_settings (whatsapp_number)
       VALUES ($1)
       RETURNING *`,
      [settings.whatsapp_number]
    );

    return result.rows[0];
  }
}

module.exports = new SiteSettingsService();
