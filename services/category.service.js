const db = require('../config/db.config');

class CategoryService {
  // Create a new category
  async createCategory(categoryData) {
    const result = await db.query(
      `INSERT INTO categories (category_name, image, hero_image, hero_tagline, hero_description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, category_name, image, hero_image, hero_tagline, hero_description, created_at, updated_at`,
      [
        categoryData.category_name,
        categoryData.image || null,
        categoryData.hero_image || null,
        categoryData.hero_tagline || null,
        categoryData.hero_description || null,
      ]
    );

    return result.rows[0];
  }
  
  // Get all categories. Pass { is_published: true } (set by the public route
  // middleware) to hide unpublished categories from the storefront; admin
  // calls this with no filter so it sees everything.
  async getAllCategories(filters = {}) {
    let query = `SELECT id, category_name, image, is_published, hero_image, hero_tagline, hero_description, created_at, updated_at FROM categories`;
    const params = [];

    if (filters.is_published !== undefined) {
      params.push(filters.is_published);
      query += ` WHERE is_published = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  // Get category by ID
  async getCategoryById(categoryId) {
    const result = await db.query(
      `SELECT id, category_name, image, is_published, hero_image, hero_tagline, hero_description, created_at, updated_at
       FROM categories
       WHERE id = $1`,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
  
  // Get category by name
  async getCategoryByName(categoryName) {
    const result = await db.query(
      `SELECT id, category_name, image, hero_image, hero_tagline, hero_description, created_at, updated_at
       FROM categories
       WHERE category_name = $1`,
      [categoryName]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // Vendors that actually have at least one published product in this category —
  // e.g. picking "Ram" only ever offers Corsair/Samsung/Kingston/XPG, never GPU-only
  // brands like NVIDIA. Real-data-driven, same spirit as getCategoryFilters below;
  // deliberately independent of pc_builder_category_vendors, which is an admin-curated
  // allow-list for the PC Builder flow specifically, not the general storefront.
  async getCategoryVendors(categoryId) {
    const result = await db.query(
      `SELECT DISTINCT v.id, v.vendor_name
       FROM vendors v
       JOIN product_vendors pv ON pv.vendor_id = v.id
       JOIN products p ON p.id = pv.product_id
       WHERE p.category_id = $1 AND p.status = 'published' AND v.is_published = true
       ORDER BY v.vendor_name`,
      [categoryId]
    );

    return result.rows;
  }

  // Dynamic filters for a category's product-listing page: every active
  // category_key_feature that at least one published product in this category
  // actually has a value for (with the distinct values in use), plus the vendors
  // that actually sell in this category. A category with no products/specs yet
  // simply returns empty arrays — no dead/empty filter groups.
  //
  // When `vendorId` is given, the Specifications values are narrowed to only what
  // THAT vendor's products in this category actually have — e.g. selecting AMD
  // under CPU should stop offering "Intel" as a CPU Brand value or LGA1700/LGA1851
  // as Socket Type options, since no AMD product has those values. The vendor list
  // itself stays category-wide (not further narrowed by vendorId) — it's the set of
  // choices being picked FROM, not a result of the current pick.
  async getCategoryFilters(categoryId, vendorId = null) {
    const keyFeatureParams = [categoryId];
    let vendorClause = '';
    if (vendorId) {
      keyFeatureParams.push(vendorId);
      vendorClause = ` AND EXISTS (
        SELECT 1 FROM product_vendors pv
        WHERE pv.product_id = p.id AND pv.vendor_id = $${keyFeatureParams.length}
      )`;
    }

    const [keyFeatureResult, vendors] = await Promise.all([
      db.query(
        `SELECT ckf.id, ckf.feature_key, ckf.display_order,
                array_agg(DISTINCT pkf.feature_value ORDER BY pkf.feature_value) AS values
         FROM category_key_features ckf
         JOIN product_key_features pkf ON pkf.category_key_feature_id = ckf.id
         JOIN products p ON p.id = pkf.product_id AND p.status = 'published'
         WHERE ckf.category_id = $1 AND ckf.is_active = true${vendorClause}
         GROUP BY ckf.id, ckf.feature_key, ckf.display_order
         ORDER BY ckf.display_order`,
        keyFeatureParams
      ),
      this.getCategoryVendors(categoryId),
    ]);

    return { key_features: keyFeatureResult.rows, vendors };
  }

  // Update category
  async updateCategory(categoryId, categoryData) {
    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (categoryData.category_name !== undefined) {
      updateFields.push(`category_name = $${paramCount++}`);
      values.push(categoryData.category_name);
    }
    if (categoryData.image !== undefined) {
      updateFields.push(`image = $${paramCount++}`);
      values.push(categoryData.image);
    }
    if (categoryData.hero_image !== undefined) {
      updateFields.push(`hero_image = $${paramCount++}`);
      values.push(categoryData.hero_image);
    }
    if (categoryData.hero_tagline !== undefined) {
      updateFields.push(`hero_tagline = $${paramCount++}`);
      values.push(categoryData.hero_tagline);
    }
    if (categoryData.hero_description !== undefined) {
      updateFields.push(`hero_description = $${paramCount++}`);
      values.push(categoryData.hero_description);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(categoryId);

    const updateQuery = `
      UPDATE categories
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, category_name, image, hero_image, hero_tagline, hero_description, created_at, updated_at
    `;
    
    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      throw new Error('Category not found');
    }
    
    return result.rows[0];
  }
  
  // Currently-published vendors selling in this category — the set that
  // would be unpublished (and whose products would cascade-unpublish) if
  // this category were unpublished right now.
  async getAffectedVendorIds(categoryId) {
    const vendorsResult = await db.query(
      `SELECT DISTINCT pv.vendor_id
       FROM product_vendors pv
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id = pv.vendor_id
       WHERE p.category_id = $1 AND v.is_published = true`,
      [categoryId]
    );
    return vendorsResult.rows.map((row) => row.vendor_id);
  }

  // How many currently-published vendors (and, transitively, their
  // currently-published products) would be unpublished if this category
  // were unpublished right now. Read-only — safe for a confirmation prompt.
  async getUnpublishImpact(categoryId) {
    const vendorIds = await this.getAffectedVendorIds(categoryId);

    if (vendorIds.length === 0) {
      return { vendorCount: 0, productCount: 0 };
    }

    const productsResult = await db.query(
      `SELECT COUNT(DISTINCT p.id)::int AS product_count
       FROM products p
       JOIN product_vendors pv ON pv.product_id = p.id
       WHERE pv.vendor_id = ANY($1::uuid[]) AND p.status = 'published'`,
      [vendorIds]
    );

    return { vendorCount: vendorIds.length, productCount: productsResult.rows[0].product_count };
  }

  // Paginated list of the actual currently-published products that would be
  // unpublished (same product set as getUnpublishImpact, but the rows
  // instead of a count) — lets the admin see exactly what's affected before
  // confirming. A product can carry more than one affected vendor, so the
  // de-dup happens in a subquery before pagination is applied.
  async getUnpublishImpactProducts(categoryId, { limit = 7, offset = 0 } = {}) {
    const vendorIds = await this.getAffectedVendorIds(categoryId);

    if (vendorIds.length === 0) {
      return { products: [], hasMore: false };
    }

    const result = await db.query(
      `SELECT sub.id, sub.name, sub.price, sub.category_name, sub.vendor_name
       FROM (
         SELECT DISTINCT ON (p.id) p.id, p.name, p.price, c.category_name, v.vendor_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         JOIN product_vendors pv ON pv.product_id = p.id
         JOIN vendors v ON v.id = pv.vendor_id
         WHERE pv.vendor_id = ANY($1::uuid[]) AND p.status = 'published'
         ORDER BY p.id, v.vendor_name
       ) sub
       ORDER BY sub.name ASC
       LIMIT $2 OFFSET $3`,
      [vendorIds, limit + 1, offset]
    );

    const hasMore = result.rows.length > limit;
    const products = hasMore ? result.rows.slice(0, limit) : result.rows;
    return { products, hasMore };
  }

  // Publish/unpublish a category. Unpublishing cascades: every currently-
  // published vendor selling in this category is unpublished, which in turn
  // unpublishes every currently-published product of those vendors (same
  // rule as VendorService#setPublished) — all via bulk UPDATEs in one
  // transaction, not per-row loops. Publishing a category back does NOT
  // resurrect vendors/products — that's a deliberate, separate admin action.
  async setPublished(categoryId, isPublished) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const categoryResult = await client.query(
        `UPDATE categories
         SET is_published = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, category_name, image, is_published, hero_image, hero_tagline, hero_description, created_at, updated_at`,
        [isPublished, categoryId]
      );

      if (categoryResult.rows.length === 0) {
        throw new Error('Category not found');
      }

      let unpublishedVendorCount = 0;
      let unpublishedProductCount = 0;

      if (!isPublished) {
        const vendorsResult = await client.query(
          `UPDATE vendors
           SET is_published = false, updated_at = CURRENT_TIMESTAMP
           WHERE is_published = true
             AND id IN (
               SELECT DISTINCT pv.vendor_id
               FROM product_vendors pv
               JOIN products p ON p.id = pv.product_id
               WHERE p.category_id = $1
             )
           RETURNING id`,
          [categoryId]
        );
        unpublishedVendorCount = vendorsResult.rows.length;
        const vendorIds = vendorsResult.rows.map((row) => row.id);

        if (vendorIds.length > 0) {
          const productsResult = await client.query(
            `UPDATE products
             SET status = 'draft', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'published'
               AND id IN (SELECT product_id FROM product_vendors WHERE vendor_id = ANY($1::uuid[]))
             RETURNING id`,
            [vendorIds]
          );
          unpublishedProductCount = productsResult.rows.length;
        }
      }

      await client.query('COMMIT');
      return {
        category: categoryResult.rows[0],
        unpublishedVendorCount,
        unpublishedProductCount,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete category
  async deleteCategory(categoryId) {
    // Get category first to get image URL for deletion from S3
    const category = await this.getCategoryById(categoryId);
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    const result = await db.query(
      `DELETE FROM categories WHERE id = $1 RETURNING id, category_name, image, hero_image`,
      [categoryId]
    );

    return {
      message: 'Category deleted successfully',
      id: result.rows[0].id,
      category_name: result.rows[0].category_name,
      image: result.rows[0].image, // Return image URL so controller can delete from S3
      hero_image: result.rows[0].hero_image // Return hero image URL so controller can delete from S3
    };
  }
}

module.exports = new CategoryService();
