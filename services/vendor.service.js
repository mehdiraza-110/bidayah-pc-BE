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
  
  // Get all vendors
  async getAllVendors() {
    const result = await db.query(
      `SELECT id, vendor_name, created_at, updated_at
       FROM vendors
       ORDER BY created_at DESC`
    );
    
    return result.rows;
  }
  
  // Get vendor by ID
  async getVendorById(vendorId) {
    const result = await db.query(
      `SELECT id, vendor_name, created_at, updated_at
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
