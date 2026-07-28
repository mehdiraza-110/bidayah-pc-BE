const db = require('../config/db.config');

class StoreLocationService {
  // Create a new store location
  async createStoreLocation(locationData) {
    const isActive = locationData.is_active === undefined ? true : locationData.is_active;

    const result = await db.query(
      `INSERT INTO store_locations (name, address, city, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [locationData.name, locationData.address, locationData.city, isActive]
    );

    return result.rows[0];
  }

  // Get all store locations
  async getAllStoreLocations(filters = {}) {
    let query = `SELECT * FROM store_locations`;

    if (filters.activeOnly) {
      query += ` WHERE is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query);

    return result.rows;
  }

  // Get store location by ID
  async getStoreLocationById(locationId) {
    const result = await db.query(
      `SELECT * FROM store_locations WHERE id = $1`,
      [locationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // Update store location
  async updateStoreLocation(locationId, locationData) {
    const result = await db.query(
      `UPDATE store_locations
       SET name = $1, address = $2, city = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [locationData.name, locationData.address, locationData.city, locationData.is_active, locationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Store location not found');
    }

    return result.rows[0];
  }

  // Delete store location
  async deleteStoreLocation(locationId) {
    const result = await db.query(
      `DELETE FROM store_locations WHERE id = $1 RETURNING id, name`,
      [locationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Store location not found');
    }

    return { message: 'Store location deleted successfully', id: result.rows[0].id, name: result.rows[0].name };
  }
}

module.exports = new StoreLocationService();
