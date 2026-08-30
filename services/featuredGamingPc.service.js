const db = require('../config/db.config');
const { generateUniqueSlug } = require('../utils/slug.util');

class FeaturedGamingPcService {
  // Attaches images[] and products[] (with their own name/image/price) to a
  // set of already-fetched gaming PC rows — shared by getAll/getById/getActiveOrdered
  // so the "N+1 query" shape only has to be written once.
  async attachRelations(gamingPcs) {
    if (gamingPcs.length === 0) return gamingPcs;

    const ids = gamingPcs.map(pc => pc.id);

    const [imagesResult, productsResult] = await Promise.all([
      db.query(
        `SELECT gaming_pc_id, url, display_order
         FROM featured_gaming_pc_images
         WHERE gaming_pc_id = ANY($1::uuid[])
         ORDER BY gaming_pc_id, display_order ASC`,
        [ids]
      ),
      db.query(
        `SELECT fgp.gaming_pc_id, fgp.display_order, fgp.quantity, p.id, p.name, p.image, p.price, p.category_id, c.category_name
         FROM featured_gaming_pc_products fgp
         INNER JOIN products p ON p.id = fgp.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE fgp.gaming_pc_id = ANY($1::uuid[])
         ORDER BY fgp.gaming_pc_id, fgp.display_order ASC`,
        [ids]
      )
    ]);

    const imagesByPc = new Map();
    for (const row of imagesResult.rows) {
      if (!imagesByPc.has(row.gaming_pc_id)) imagesByPc.set(row.gaming_pc_id, []);
      imagesByPc.get(row.gaming_pc_id).push(row.url);
    }

    const productsByPc = new Map();
    for (const row of productsResult.rows) {
      if (!productsByPc.has(row.gaming_pc_id)) productsByPc.set(row.gaming_pc_id, []);
      productsByPc.get(row.gaming_pc_id).push({
        id: row.id,
        name: row.name,
        image: row.image,
        price: row.price,
        category_id: row.category_id,
        category_name: row.category_name,
        quantity: row.quantity
      });
    }

    return gamingPcs.map(pc => ({
      ...pc,
      images: imagesByPc.get(pc.id) || [],
      products: productsByPc.get(pc.id) || []
    }));
  }

  // Admin view: every build, however many are active/inactive.
  async getAll() {
    const result = await db.query(
      `SELECT * FROM featured_gaming_pcs ORDER BY display_order ASC, created_at ASC`
    );
    return this.attachRelations(result.rows);
  }

  async getById(id) {
    const result = await db.query(`SELECT * FROM featured_gaming_pcs WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    const [withRelations] = await this.attachRelations(result.rows);
    return withRelations;
  }

  // Same as getById, but looked up by its slug — used by the storefront's
  // clean detail URL (/gaming-pc/<slug>).
  async getBySlug(slug) {
    const result = await db.query(`SELECT * FROM featured_gaming_pcs WHERE slug = $1`, [slug]);
    if (result.rows.length === 0) return null;
    const [withRelations] = await this.attachRelations(result.rows);
    return withRelations;
  }

  // Public homepage consumption: active builds, in admin order, capped at the
  // admin-configured `featured_gaming_pcs_limit` from site_settings.
  async getActiveOrdered(limit) {
    const result = await db.query(
      `SELECT * FROM featured_gaming_pcs WHERE is_active = true ORDER BY display_order ASC LIMIT $1`,
      [limit]
    );
    return this.attachRelations(result.rows);
  }

  async create(data) {
    const {
      name, description, price, key_features, is_active, images, products,
      series_type_id, tier_name, color_name, color_swatch_hex, fps_score, fps_settings_label
    } = data;

    if (!name || !name.trim()) throw new Error('name is required');
    if (price === undefined || price === null || isNaN(price) || price < 0) {
      throw new Error('price must be a non-negative number');
    }
    if (!images || images.length === 0) throw new Error('At least 1 image is required');

    const client = await db.getClient();
    let newId;

    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order FROM featured_gaming_pcs`
      );
      const displayOrder = data.display_order ?? orderResult.rows[0].next_order;
      const slug = await generateUniqueSlug(name.trim(), 'featured_gaming_pcs', { client });

      const insertResult = await client.query(
        `INSERT INTO featured_gaming_pcs
           (name, slug, description, price, key_features, is_active, display_order,
            series_type_id, tier_name, color_name, color_swatch_hex, fps_score, fps_settings_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          name.trim(),
          slug,
          description || null,
          price,
          key_features || [],
          is_active !== undefined ? is_active : true,
          displayOrder,
          series_type_id || null,
          tier_name || null,
          color_name || null,
          color_swatch_hex || null,
          fps_score ?? null,
          fps_settings_label || null
        ]
      );
      const gamingPc = insertResult.rows[0];
      newId = gamingPc.id;

      for (let i = 0; i < Math.min(images.length, 5); i++) {
        await client.query(
          `INSERT INTO featured_gaming_pc_images (gaming_pc_id, url, display_order) VALUES ($1, $2, $3)`,
          [gamingPc.id, images[i], i]
        );
      }

      if (products && products.length > 0) {
        for (let i = 0; i < products.length; i++) {
          const item = products[i];
          const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
          await client.query(
            `INSERT INTO featured_gaming_pc_products (gaming_pc_id, product_id, quantity, display_order) VALUES ($1, $2, $3, $4)`,
            [gamingPc.id, item.product_id, quantity, i]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getById(newId);
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) return null;

    if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
      throw new Error('price must be a non-negative number');
    }
    // Only reachable when the admin explicitly cleared every image without
    // uploading replacements — `images` is otherwise left undefined by the
    // controller to mean "keep the existing set".
    if (data.images !== undefined && data.images.length === 0) {
      throw new Error('At least 1 image is required');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Renaming a build regenerates its slug, same as products — keeps the
      // URL matching the name without the admin ever having to think about it.
      if (data.name !== undefined && data.slug === undefined) {
        data.slug = await generateUniqueSlug(data.name.trim(), 'featured_gaming_pcs', { client, excludeId: id });
      }

      const fields = [];
      const values = [];
      let i = 1;
      const assignable = [
        'name', 'slug', 'description', 'price', 'key_features', 'is_active', 'display_order',
        'series_type_id', 'tier_name', 'color_name', 'color_swatch_hex', 'fps_score', 'fps_settings_label'
      ];
      for (const key of assignable) {
        if (data[key] !== undefined) {
          fields.push(`${key} = $${i}`);
          values.push(data[key]);
          i++;
        }
      }

      let gamingPc = existing;
      if (fields.length > 0) {
        values.push(id);
        const updateResult = await client.query(
          `UPDATE featured_gaming_pcs SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
          values
        );
        gamingPc = updateResult.rows[0];
      }

      // Images fully replace the existing set — same "re-upload everything"
      // approach as products' `media` field. Untouched when not provided.
      if (data.images !== undefined) {
        await client.query(`DELETE FROM featured_gaming_pc_images WHERE gaming_pc_id = $1`, [id]);
        for (let idx = 0; idx < Math.min(data.images.length, 5); idx++) {
          await client.query(
            `INSERT INTO featured_gaming_pc_images (gaming_pc_id, url, display_order) VALUES ($1, $2, $3)`,
            [id, data.images[idx], idx]
          );
        }
      }

      if (data.products !== undefined) {
        await client.query(`DELETE FROM featured_gaming_pc_products WHERE gaming_pc_id = $1`, [id]);
        for (let idx = 0; idx < data.products.length; idx++) {
          const item = data.products[idx];
          const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
          await client.query(
            `INSERT INTO featured_gaming_pc_products (gaming_pc_id, product_id, quantity, display_order) VALUES ($1, $2, $3, $4)`,
            [id, item.product_id, quantity, idx]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getById(id);
  }

  // Returns the deleted row's images (so the controller can clean up S3)
  // before the DB row (and its FK-cascaded image rows) are actually gone.
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) return null;
    await db.query(`DELETE FROM featured_gaming_pcs WHERE id = $1`, [id]);
    return existing;
  }

  async reorder(items = []) {
    if (!Array.isArray(items)) throw new Error('items must be an array');

    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id) throw new Error('Each item requires an id');
        await client.query(
          `UPDATE featured_gaming_pcs SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
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

module.exports = new FeaturedGamingPcService();
