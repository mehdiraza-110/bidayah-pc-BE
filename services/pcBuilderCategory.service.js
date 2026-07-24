const db = require('../config/db.config');

class PcBuilderCategoryService {
  // All site categories merged with their PC Builder config (admin view)
  async getAllWithConfig() {
    const result = await db.query(
      `SELECT
        c.id AS category_id,
        c.category_name,
        c.image,
        COALESCE(pbc.display_order, 0) AS display_order,
        COALESCE(pbc.is_active, false) AS is_active
      FROM categories c
      LEFT JOIN pc_builder_categories pbc ON pbc.category_id = c.id
      ORDER BY COALESCE(pbc.is_active, false) DESC, COALESCE(pbc.display_order, 0) ASC, c.category_name ASC`
    );

    return result.rows;
  }

  // Categories included in the PC Builder, in admin-defined order (public consumption)
  async getActiveOrdered() {
    const result = await db.query(
      `SELECT
        c.id, c.category_name, c.image, c.created_at, c.updated_at
      FROM categories c
      INNER JOIN pc_builder_categories pbc ON pbc.category_id = c.id
      WHERE pbc.is_active = true
      ORDER BY pbc.display_order ASC`
    );

    return result.rows;
  }

  async replaceConfig(items = []) {
    if (!Array.isArray(items)) {
      throw new Error('items must be an array');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (!item.category_id) {
          throw new Error('Each item requires a category_id');
        }

        await client.query(
          `INSERT INTO pc_builder_categories (category_id, display_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (category_id)
           DO UPDATE SET
             display_order = EXCLUDED.display_order,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP`,
          [
            item.category_id,
            item.display_order ?? i,
            item.is_active !== undefined ? item.is_active : false
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getAllWithConfig();
  }
}

module.exports = new PcBuilderCategoryService();
