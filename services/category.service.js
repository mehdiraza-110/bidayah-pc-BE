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
  
  // Get all categories
  async getAllCategories() {
    const result = await db.query(
      `SELECT id, category_name, image, created_at, updated_at
       FROM categories
       ORDER BY created_at DESC`
    );
    
    return result.rows;
  }
  
  // Get category by ID
  async getCategoryById(categoryId) {
    const result = await db.query(
      `SELECT id, category_name, image, created_at, updated_at
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
