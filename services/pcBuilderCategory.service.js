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
        COALESCE(pbc.is_active, false) AS is_active,
        COALESCE(pbc.max_quantity, 1) AS max_quantity,
        COALESCE(pbc.allow_duplicate_products, false) AS allow_duplicate_products
      FROM categories c
      LEFT JOIN pc_builder_categories pbc ON pbc.category_id = c.id
      ORDER BY COALESCE(pbc.is_active, false) DESC, COALESCE(pbc.display_order, 0) ASC, c.category_name ASC`
    );

    return result.rows;
  }

  // Categories included in the PC Builder, in admin-defined order (public consumption).
  // Requires both the PC Builder step itself AND the underlying category to be published —
  // unpublishing a category must hide it here too, not just from the main category listing.
  async getActiveOrdered() {
    const result = await db.query(
      `SELECT
        c.id, c.category_name, c.image, c.created_at, c.updated_at,
        pbc.max_quantity, pbc.allow_duplicate_products
      FROM categories c
      INNER JOIN pc_builder_categories pbc ON pbc.category_id = c.id
      WHERE pbc.is_active = true AND c.is_published = true
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

        const maxQuantity = Math.max(1, parseInt(item.max_quantity, 10) || 1);
        // Only meaningful when maxQuantity > 1 — a single-select step has
        // nothing to duplicate, so force it off rather than store a stale true.
        const allowDuplicateProducts = maxQuantity > 1 && Boolean(item.allow_duplicate_products);

        await client.query(
          `INSERT INTO pc_builder_categories (category_id, display_order, is_active, max_quantity, allow_duplicate_products, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (category_id)
           DO UPDATE SET
             display_order = EXCLUDED.display_order,
             is_active = EXCLUDED.is_active,
             max_quantity = EXCLUDED.max_quantity,
             allow_duplicate_products = EXCLUDED.allow_duplicate_products,
             updated_at = CURRENT_TIMESTAMP`,
          [
            item.category_id,
            item.display_order ?? i,
            item.is_active !== undefined ? item.is_active : false,
            maxQuantity,
            allowDuplicateProducts
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
