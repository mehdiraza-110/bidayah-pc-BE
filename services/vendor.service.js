const db = require('../config/db.config');

class VendorService {
  // Create a new vendor
  async createVendor(vendorData) {
    const result = await db.query(
      `INSERT INTO vendors (vendor_name, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, vendor_name, created_at, updated_at`,
      [vendorData.vendor_name]
    );
    
    return result.rows[0];
  }
  
  // Get all vendors. Pass { is_published: true } (set by the public route
  // middleware) to hide unpublished vendors from the storefront; admin calls
  // this with no filter so it sees everything, including unpublished vendors.
  async getAllVendors(filters = {}) {
    let query = `SELECT id, vendor_name, is_published, created_at, updated_at FROM vendors`;
    const params = [];

    if (filters.is_published !== undefined) {
      params.push(filters.is_published);
      query += ` WHERE is_published = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  // Get vendor by ID
  async getVendorById(vendorId) {
    const result = await db.query(
      `SELECT id, vendor_name, is_published, created_at, updated_at
       FROM vendors
       WHERE id = $1`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
  
  // Get vendor by name
  async getVendorByName(vendorName) {
    const result = await db.query(
      `SELECT id, vendor_name, created_at, updated_at
       FROM vendors
       WHERE vendor_name = $1`,
      [vendorName]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
  
  // Update vendor
  async updateVendor(vendorId, vendorData) {
    const result = await db.query(
      `UPDATE vendors 
       SET vendor_name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, vendor_name, created_at, updated_at`,
      [vendorData.vendor_name, vendorId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Vendor not found');
    }
    
    return result.rows[0];
  }
  
  // How many currently-published products would be unpublished if this
  // vendor were unpublished right now. Read-only — safe to call repeatedly
  // for a confirmation prompt.
  async getUnpublishImpact(vendorId) {
    const result = await db.query(
      `SELECT COUNT(*)::int AS product_count
       FROM products
       WHERE status = 'published'
         AND id IN (SELECT product_id FROM product_vendors WHERE vendor_id = $1)`,
      [vendorId]
    );

    return { productCount: result.rows[0].product_count };
  }

  // Publish/unpublish a vendor. Unpublishing cascades to every currently-
  // published product carrying this vendor (single bulk UPDATE, not a
  // per-row loop). Publishing a vendor back does NOT resurrect its
  // products — that's a deliberate, separate admin action.
  async setPublished(vendorId, isPublished) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const vendorResult = await client.query(
        `UPDATE vendors
         SET is_published = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, vendor_name, is_published, created_at, updated_at`,
        [isPublished, vendorId]
      );

      if (vendorResult.rows.length === 0) {
        throw new Error('Vendor not found');
      }

      let unpublishedProductCount = 0;

      if (!isPublished) {
        const productsResult = await client.query(
          `UPDATE products
           SET status = 'draft', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'published'
             AND id IN (SELECT product_id FROM product_vendors WHERE vendor_id = $1)
           RETURNING id`,
          [vendorId]
        );
        unpublishedProductCount = productsResult.rows.length;
      }

      await client.query('COMMIT');
      return { vendor: vendorResult.rows[0], unpublishedProductCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete vendor
  async deleteVendor(vendorId) {
    const result = await db.query(
      `DELETE FROM vendors WHERE id = $1 RETURNING id, vendor_name`,
      [vendorId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Vendor not found');
    }
    
    return { message: 'Vendor deleted successfully', id: result.rows[0].id, vendor_name: result.rows[0].vendor_name };
  }
}

module.exports = new VendorService();
