const db = require('../config/db.config');
const vendorService = require('./vendor.service');

class PcBuilderCategoryVendorService {
  // Vendors valid for a category. Falls back to every vendor when the
  // category has no configured restriction yet.
  async getVendorsForCategory(categoryId) {
    const result = await db.query(
      `SELECT v.id, v.vendor_name, v.created_at, v.updated_at
       FROM pc_builder_category_vendors pcv
       JOIN vendors v ON v.id = pcv.vendor_id
       WHERE pcv.category_id = $1
       ORDER BY pcv.display_order ASC`,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return vendorService.getAllVendors();
    }

    return result.rows;
  }

  // Admin view: every category with its configured vendor ids (empty = unrestricted)
  async getAllAssociations() {
    const result = await db.query(
      `SELECT category_id, vendor_id, display_order
       FROM pc_builder_category_vendors
       ORDER BY category_id, display_order ASC`
    );

    return result.rows;
  }

  async replaceForCategory(categoryId, vendorIds = []) {
    if (!Array.isArray(vendorIds)) {
      throw new Error('vendor_ids must be an array');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM pc_builder_category_vendors WHERE category_id = $1', [categoryId]);

      for (let i = 0; i < vendorIds.length; i++) {
        await client.query(
          `INSERT INTO pc_builder_category_vendors (category_id, vendor_id, display_order, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [categoryId, vendorIds[i], i]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getVendorsForCategory(categoryId);
  }
}

module.exports = new PcBuilderCategoryVendorService();
