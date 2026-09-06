const db = require('../config/db.config');
const { generateUniqueSlug } = require('../utils/slug.util');
const featuredGamingPcService = require('./featuredGamingPc.service');

// Shared deep-fetch: given one or more already-fetched series rows, attaches
// their full types -> gaming_pcs tree in a small fixed number of queries (not
// N+1 per series). A type's "gaming_pcs" are featured_gaming_pcs rows with
// series_type_id set to it — grouped/color-switched client-side by their
// tier_name/color_name. `activeOnly` filters both levels to is_active = true
// — used by the public landing endpoint; the admin workbench always passes
// false so inactive rows stay editable instead of disappearing.
const attachSeriesTree = async (seriesRows, activeOnly) => {
  if (seriesRows.length === 0) return seriesRows;

  const seriesIds = seriesRows.map(s => s.id);
  const activeClause = activeOnly ? 'AND is_active = true' : '';

  const typesResult = await db.query(
    `SELECT * FROM pc_series_types WHERE series_id = ANY($1::uuid[]) ${activeClause}
     ORDER BY series_id, display_order ASC`,
    [seriesIds]
  );
  const typeIds = typesResult.rows.map(t => t.id);

  const gamingPcsResult = typeIds.length
    ? await db.query(
        `SELECT * FROM featured_gaming_pcs WHERE series_type_id = ANY($1::uuid[]) ${activeClause}
         ORDER BY series_type_id, tier_name NULLS FIRST, display_order ASC`,
        [typeIds]
      )
    : { rows: [] };
  // Reuses featuredGamingPcService's own images/products join so this list
  // comes back in exactly the same shape as the Featured Gaming PCs module.
  const gamingPcs = await featuredGamingPcService.attachRelations(gamingPcsResult.rows);

  const gamingPcsByType = new Map();
  for (const pc of gamingPcs) {
    if (!gamingPcsByType.has(pc.series_type_id)) gamingPcsByType.set(pc.series_type_id, []);
    gamingPcsByType.get(pc.series_type_id).push(pc);
  }

  const typesBySeries = new Map();
  for (const row of typesResult.rows) {
    if (!typesBySeries.has(row.series_id)) typesBySeries.set(row.series_id, []);
    typesBySeries.get(row.series_id).push({ ...row, gaming_pcs: gamingPcsByType.get(row.id) || [] });
  }

  return seriesRows.map(series => ({ ...series, types: typesBySeries.get(series.id) || [] }));
};

// ==================== SERIES ====================

const series = {
  // Admin list — every series, with a computed price range from its own
  // types' active Featured Gaming PCs.
  async getAll() {
    const result = await db.query(
      `SELECT s.*,
              (SELECT MIN(f.price) FROM featured_gaming_pcs f
                 INNER JOIN pc_series_types t ON t.id = f.series_type_id
                 WHERE t.series_id = s.id AND f.is_active = true) AS price_from,
              (SELECT MAX(f.price) FROM featured_gaming_pcs f
                 INNER JOIN pc_series_types t ON t.id = f.series_type_id
                 WHERE t.series_id = s.id AND f.is_active = true) AS price_to
       FROM pc_series s ORDER BY s.display_order ASC, s.created_at ASC`
    );
    return result.rows;
  },

  // Public homepage list — active series only, same computed price range.
  // The "Build your own" card (is_custom_build) always sorts last, regardless
  // of display_order — `false` sorts before `true` in Postgres, so ordering
  // by is_custom_build first pins it to the end without any special-casing.
  async getActiveOrdered() {
    const result = await db.query(
      `SELECT s.*,
              (SELECT MIN(f.price) FROM featured_gaming_pcs f
                 INNER JOIN pc_series_types t ON t.id = f.series_type_id
                 WHERE t.series_id = s.id AND f.is_active = true) AS price_from,
              (SELECT MAX(f.price) FROM featured_gaming_pcs f
                 INNER JOIN pc_series_types t ON t.id = f.series_type_id
                 WHERE t.series_id = s.id AND f.is_active = true) AS price_to
       FROM pc_series s WHERE s.is_active = true ORDER BY s.is_custom_build ASC, s.display_order ASC`
    );
    return series.attachCardImages(result.rows);
  },

  // Attaches `card_images` — the series' own card_image (if set) followed by
  // the cover photo of each of its active tier/color builds, deduped. Lets
  // the homepage series card cycle through spec-tier/color variants on
  // hover, the same way a product card cycles its gallery.
  async attachCardImages(seriesRows) {
    const candidateIds = seriesRows.filter(s => !s.is_custom_build).map(s => s.id);
    if (candidateIds.length === 0) {
      return seriesRows.map(s => ({ ...s, card_images: s.card_image ? [s.card_image] : [] }));
    }

    const buildsResult = await db.query(
      `SELECT f.id, t.series_id
       FROM featured_gaming_pcs f
       INNER JOIN pc_series_types t ON t.id = f.series_type_id
       WHERE t.series_id = ANY($1::uuid[]) AND f.is_active = true AND t.is_active = true
       ORDER BY t.series_id, f.tier_name NULLS FIRST, f.color_name NULLS FIRST, f.display_order ASC`,
      [candidateIds]
    );

    const pcIds = buildsResult.rows.map(r => r.id);
    const coversResult = pcIds.length
      ? await db.query(
          `SELECT gaming_pc_id, url FROM featured_gaming_pc_images
           WHERE gaming_pc_id = ANY($1::uuid[]) AND display_order = 0`,
          [pcIds]
        )
      : { rows: [] };
    const coverByPc = new Map(coversResult.rows.map(r => [r.gaming_pc_id, r.url]));

    const variantImagesBySeries = new Map();
    for (const row of buildsResult.rows) {
      const cover = coverByPc.get(row.id);
      if (!cover) continue;
      if (!variantImagesBySeries.has(row.series_id)) variantImagesBySeries.set(row.series_id, []);
      const images = variantImagesBySeries.get(row.series_id);
      if (!images.includes(cover)) images.push(cover);
    }

    return seriesRows.map(s => {
      const variantImages = variantImagesBySeries.get(s.id) || [];
      const images = s.card_image
        ? [s.card_image, ...variantImages.filter(url => url !== s.card_image)]
        : variantImages;
      return { ...s, card_images: images.slice(0, 6) };
    });
  },

  // Admin workbench / public landing page: full nested tree. `activeOnly`
  // controls whether inactive types/builds are included.
  async getById(id, activeOnly = false) {
    const result = await db.query(`SELECT * FROM pc_series WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    const [withTree] = await attachSeriesTree(result.rows, activeOnly);
    return withTree;
  },

  async getBySlug(slug, activeOnly = true) {
    const result = await db.query(`SELECT * FROM pc_series WHERE slug = $1`, [slug]);
    if (result.rows.length === 0) return null;
    const [withTree] = await attachSeriesTree(result.rows, activeOnly);
    return withTree;
  },

  async create(data) {
    const { name, action_button_text, badge_status, is_active, card_image, hero_video, card_description, starting_price, ending_price, is_custom_build } = data;
    if (!name || !name.trim()) throw new Error('name is required');

    const client = await db.getClient();
    let newId;
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order FROM pc_series`
      );
      const displayOrder = data.display_order ?? orderResult.rows[0].next_order;
      const slug = await generateUniqueSlug(name.trim(), 'pc_series', { client });

      const insertResult = await client.query(
        `INSERT INTO pc_series
           (name, slug, action_button_text, card_image, hero_video, badge_status, card_description, starting_price, ending_price, is_custom_build, is_active, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          name.trim(),
          slug,
          action_button_text?.trim() || 'Configurations and prices',
          card_image || null,
          hero_video || null,
          badge_status || 'in_stock',
          card_description || null,
          starting_price ?? null,
          ending_price ?? null,
          is_custom_build || false,
          is_active !== undefined ? is_active : true,
          displayOrder
        ]
      );
      newId = insertResult.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      // Partial unique index — only one series may be the "Build your own" card.
      if (error.code === '23505' && error.constraint === 'idx_pc_series_one_custom_build') {
        throw new Error('Another series is already set as the "Build your own" card — turn that one off first.');
      }
      throw error;
    } finally {
      client.release();
    }

    return series.getById(newId);
  },

  async update(id, data) {
    const existing = await db.query(`SELECT * FROM pc_series WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return null;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (data.name !== undefined && data.slug === undefined) {
        data.slug = await generateUniqueSlug(data.name.trim(), 'pc_series', { client, excludeId: id });
      }

      const fields = [];
      const values = [];
      let i = 1;
      const assignable = ['name', 'slug', 'action_button_text', 'card_image', 'hero_video', 'badge_status', 'card_description', 'starting_price', 'ending_price', 'is_custom_build', 'is_active', 'display_order'];
      for (const key of assignable) {
        if (data[key] !== undefined) {
          fields.push(`${key} = $${i}`);
          values.push(data[key]);
          i++;
        }
      }

      if (fields.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE pc_series SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i}`,
          values
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'idx_pc_series_one_custom_build') {
        throw new Error('Another series is already set as the "Build your own" card — turn that one off first.');
      }
      throw error;
    } finally {
      client.release();
    }

    return series.getById(id);
  },

  // Returns the deleted row (for S3 cleanup of card_image/hero_video) before
  // the cascade removes every type beneath it (Featured Gaming PCs assigned
  // to those types are only unlinked — ON DELETE SET NULL — never deleted).
  async delete(id) {
    const existing = await db.query(`SELECT * FROM pc_series WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return null;
    await db.query(`DELETE FROM pc_series WHERE id = $1`, [id]);
    return existing.rows[0];
  },

  async reorder(items = []) {
    if (!Array.isArray(items)) throw new Error('items must be an array');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id) throw new Error('Each item requires an id');
        await client.query(
          `UPDATE pc_series SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
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
    return series.getAll();
  }
};

// ==================== SERIES TYPES ====================

const types = {
  async create(data) {
    const { series_id, name, subtitle, is_active } = data;
    if (!series_id) throw new Error('series_id is required');
    if (!name || !name.trim()) throw new Error('name is required');

    const orderResult = await db.query(
      `SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order FROM pc_series_types WHERE series_id = $1`,
      [series_id]
    );
    const displayOrder = data.display_order ?? orderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO pc_series_types (series_id, name, subtitle, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [series_id, name.trim(), subtitle || null, is_active !== undefined ? is_active : true, displayOrder]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const assignable = ['name', 'subtitle', 'is_active', 'display_order'];
    for (const key of assignable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${i}`);
        values.push(data[key]);
        i++;
      }
    }
    if (fields.length === 0) throw new Error('No fields to update');

    values.push(id);
    const result = await db.query(
      `UPDATE pc_series_types SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  // Deleting a type only unlinks its Featured Gaming PCs (ON DELETE SET NULL
  // on featured_gaming_pcs.series_type_id) — the builds themselves stay put
  // in the Featured Gaming PCs module, just no longer shown on any series page.
  async delete(id) {
    const result = await db.query(`DELETE FROM pc_series_types WHERE id = $1 RETURNING *`, [id]);
    return result.rows[0] || null;
  },

  async reorder(items = []) {
    if (!Array.isArray(items)) throw new Error('items must be an array');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id) throw new Error('Each item requires an id');
        await client.query(
          `UPDATE pc_series_types SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
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
    return { success: true };
  },

  // Flat list of every type across every series, with its parent series name
  // — powers the "Series Type" picker on the Featured Gaming PC form without
  // that form having to fetch each series' full nested tree.
  async getAllFlat() {
    const result = await db.query(
      `SELECT t.*, s.name AS series_name
       FROM pc_series_types t
       INNER JOIN pc_series s ON s.id = t.series_id
       ORDER BY s.display_order ASC, t.display_order ASC`
    );
    return result.rows;
  }
};

module.exports = { series, types };
