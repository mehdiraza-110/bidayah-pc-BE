const db = require('../config/db.config');

class HomepageSectionService {
  // Admin view: every configured section, its category info, and its own config.
  async getAll() {
    const result = await db.query(
      `SELECT
        hs.id, hs.category_id, hs.title, hs.display_order, hs.is_active,
        hs.product_limit, hs.bg_color_light, hs.bg_color_dark, hs.image,
        hs.created_at, hs.updated_at,
        c.category_name, c.image AS category_image, c.is_published AS category_is_published
      FROM homepage_sections hs
      INNER JOIN categories c ON c.id = hs.category_id
      ORDER BY hs.display_order ASC, hs.created_at ASC`
    );
    return result.rows;
  }

  async getById(id) {
    const result = await db.query(
      `SELECT
        hs.id, hs.category_id, hs.title, hs.display_order, hs.is_active,
        hs.product_limit, hs.bg_color_light, hs.bg_color_dark, hs.image,
        hs.created_at, hs.updated_at,
        c.category_name, c.image AS category_image, c.is_published AS category_is_published
      FROM homepage_sections hs
      INNER JOIN categories c ON c.id = hs.category_id
      WHERE hs.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Public consumption (storefront homepage): active sections whose category is
  // also published, in admin-defined order. Unpublishing a category must hide
  // its section too, not just remove it from the main category listing.
  async getActiveOrdered() {
    const result = await db.query(
      `SELECT
        hs.id, hs.category_id, hs.title, hs.product_limit,
        hs.bg_color_light, hs.bg_color_dark, hs.image,
        c.category_name
      FROM homepage_sections hs
      INNER JOIN categories c ON c.id = hs.category_id
      WHERE hs.is_active = true AND c.is_published = true
      ORDER BY hs.display_order ASC`
    );
    return result.rows;
  }

  async create(data) {
    const { category_id, title, product_limit, is_active, bg_color_light, bg_color_dark, image } = data;

    if (!category_id) throw new Error('category_id is required');
    if (!title) throw new Error('title is required');

    // Next-to-last slot by default so a newly-created section lands at the bottom.
    const orderResult = await db.query(
      `SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order FROM homepage_sections`
    );
    const displayOrder = data.display_order ?? orderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO homepage_sections
        (category_id, title, display_order, is_active, product_limit, bg_color_light, bg_color_dark, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        category_id,
        title,
        displayOrder,
        is_active !== undefined ? is_active : true,
        product_limit || 12,
        bg_color_light || null,
        bg_color_dark || null,
        image || null,
      ]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];
    let i = 1;

    const assignable = ['category_id', 'title', 'display_order', 'is_active', 'product_limit', 'bg_color_light', 'bg_color_dark', 'image'];
    for (const key of assignable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${i}`);
        values.push(data[key]);
        i++;
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const result = await db.query(
      `UPDATE homepage_sections SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id) {
    const result = await db.query(`DELETE FROM homepage_sections WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }

  // Bulk-persist a new order (and, incidentally, active state) in one transaction —
  // used by the admin's drag-to-reorder list so a partial failure never leaves
  // sections half-reordered.
  async reorder(items = []) {
    if (!Array.isArray(items)) {
      throw new Error('items must be an array');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id) throw new Error('Each item requires an id');

        await client.query(
          `UPDATE homepage_sections SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [item.display_order ?? i, item.id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getAll();
  }
}

module.exports = new HomepageSectionService();
