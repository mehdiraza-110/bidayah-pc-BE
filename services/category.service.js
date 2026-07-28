const db = require('../config/db.config');

class CategoryService {
  // Create a new category
  async createCategory(categoryData) {
    const result = await db.query(
      `INSERT INTO categories (category_name, image, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, category_name, image, created_at, updated_at`,
      [categoryData.category_name, categoryData.image || null]
    );
    
    return result.rows[0];
  }
  
  // Get all categories. Pass { is_published: true } (set by the public route
  // middleware) to hide unpublished categories from the storefront; admin
  // calls this with no filter so it sees everything.
  async getAllCategories(filters = {}) {
    let query = `SELECT id, category_name, image, is_published, created_at, updated_at FROM categories`;
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
      `SELECT id, category_name, image, is_published, created_at, updated_at
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
      `SELECT id, category_name, image, created_at, updated_at
       FROM categories
       WHERE category_name = $1`,
      [categoryName]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
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
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(categoryId);
    
    const updateQuery = `
      UPDATE categories 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, category_name, image, created_at, updated_at
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
         RETURNING id, category_name, image, is_published, created_at, updated_at`,
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
      `DELETE FROM categories WHERE id = $1 RETURNING id, category_name, image`,
      [categoryId]
    );
    
    return { 
      message: 'Category deleted successfully', 
      id: result.rows[0].id, 
      category_name: result.rows[0].category_name,
      image: result.rows[0].image // Return image URL so controller can delete from S3
    };
  }
}

module.exports = new CategoryService();
