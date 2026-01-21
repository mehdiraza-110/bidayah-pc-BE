const db = require('../config/db.config');

class ProductService {
  // Create a new product with media and specs
  async createProduct(productData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Insert product
      const productResult = await client.query(
        `INSERT INTO products (
          name, category_id, price, original_price, image, description, 
          stock, vendor_id, status, featured, new_product, rating, reviews_count,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          productData.name,
          productData.category_id || null,
          productData.price,
          productData.original_price || null,
          productData.image,
          productData.description || null,
          productData.stock || 0,
          productData.vendor_id || null,
          productData.status || 'published',
          productData.featured || false,
          productData.new_product || false,
          productData.rating || 0.00,
          productData.reviews_count || 0
        ]
      );
      
      const newProduct = productResult.rows[0];
      
      // Insert product media if provided
      if (productData.media && productData.media.length > 0) {
        for (let i = 0; i < Math.min(productData.media.length, 5); i++) {
          const media = productData.media[i];
          await client.query(
            `INSERT INTO product_media (product_id, url, type, display_order, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [newProduct.id, media.url, media.type || 'image', i]
          );
        }
      }
      
      // Insert product specs if provided
      if (productData.specs && productData.specs.length > 0) {
        for (let i = 0; i < productData.specs.length; i++) {
          const spec = productData.specs[i];
          await client.query(
            `INSERT INTO product_specs (product_id, spec_text, display_order, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [newProduct.id, spec, i]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Get product with relations
      const productWithRelations = await this.getProductById(newProduct.id);
      
      return productWithRelations;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get all products with optional filters
  async getAllProducts(filters = {}) {
    let query = `
      SELECT 
        p.*,
        c.category_name,
        v.vendor_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pm.id,
              'url', pm.url,
              'type', pm.type,
              'display_order', pm.display_order
            )
          ) FILTER (WHERE pm.id IS NOT NULL),
          '[]'::json
        ) as media,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ps.id,
              'spec_text', ps.spec_text,
              'display_order', ps.display_order
            )
          ) FILTER (WHERE ps.id IS NOT NULL),
          '[]'::json
        ) as specs
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(filters.status);
    }
    
    if (filters.category_id) {
      query += ` AND p.category_id = $${paramCount++}`;
      params.push(filters.category_id);
    }
    
    if (filters.vendor_id) {
      query += ` AND p.vendor_id = $${paramCount++}`;
      params.push(filters.vendor_id);
    }
    
    if (filters.featured !== undefined) {
      query += ` AND p.featured = $${paramCount++}`;
      params.push(filters.featured);
    }
    
    if (filters.in_stock !== undefined) {
      query += ` AND p.in_stock = $${paramCount++}`;
      params.push(filters.in_stock);
    }
    
    if (filters.search) {
      query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    
    query += ` GROUP BY p.id, c.category_name, v.vendor_name ORDER BY p.created_at DESC`;
    
    const result = await db.query(query, params);
    
    return result.rows;
  }
  
  // Get product by ID
  async getProductById(productId) {
    const result = await db.query(
      `SELECT 
        p.*,
        c.category_name,
        v.vendor_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pm.id,
              'url', pm.url,
              'type', pm.type,
              'display_order', pm.display_order
            )
          ) FILTER (WHERE pm.id IS NOT NULL),
          '[]'::json
        ) as media,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ps.id,
              'spec_text', ps.spec_text,
              'display_order', ps.display_order
            )
          ) FILTER (WHERE ps.id IS NOT NULL),
          '[]'::json
        ) as specs
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      WHERE p.id = $1
      GROUP BY p.id, c.category_name, v.vendor_name`,
      [productId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
  
  // Update product
  async updateProduct(productId, productData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      const allowedFields = [
        'name', 'category_id', 'price', 'original_price', 'image', 'description',
        'stock', 'vendor_id', 'status', 'featured', 'new_product', 'rating', 'reviews_count'
      ];
      
      allowedFields.forEach(field => {
        if (productData[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount++}`);
          values.push(productData[field]);
        }
      });
      
      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('No fields to update');
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(productId);
      
      const updateQuery = `
        UPDATE products 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await db.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Product not found');
      }
      
      // Update media if provided
      if (productData.media !== undefined) {
        // Delete existing media
        await client.query('DELETE FROM product_media WHERE product_id = $1', [productId]);
        
        // Insert new media
        if (productData.media.length > 0) {
          for (let i = 0; i < Math.min(productData.media.length, 5); i++) {
            const media = productData.media[i];
            await client.query(
              `INSERT INTO product_media (product_id, url, type, display_order, created_at)
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
              [productId, media.url, media.type || 'image', i]
            );
          }
        }
      }
      
      // Update specs if provided
      if (productData.specs !== undefined) {
        // Delete existing specs
        await client.query('DELETE FROM product_specs WHERE product_id = $1', [productId]);
        
        // Insert new specs
        if (productData.specs.length > 0) {
          for (let i = 0; i < productData.specs.length; i++) {
            const spec = productData.specs[i];
            await client.query(
              `INSERT INTO product_specs (product_id, spec_text, display_order, created_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
              [productId, spec, i]
            );
          }
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated product with relations
      const updatedProduct = await this.getProductById(productId);
      
      return updatedProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Delete product
  async deleteProduct(productId) {
    // Get product first to get media URLs for deletion from S3
    const product = await this.getProductById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const result = await db.query(
      `DELETE FROM products WHERE id = $1 RETURNING id, name, image`,
      [productId]
    );
    
    return {
      message: 'Product deleted successfully',
      id: result.rows[0].id,
      name: result.rows[0].name,
      image: result.rows[0].image,
      media: product.media || []
    };
  }
  
  // Get product media by product ID
  async getProductMedia(productId) {
    const result = await db.query(
      `SELECT id, product_id, url, type, display_order, created_at
       FROM product_media
       WHERE product_id = $1
       ORDER BY display_order ASC`,
      [productId]
    );
    
    return result.rows;
  }
  
  // Get product specs by product ID
  async getProductSpecs(productId) {
    const result = await db.query(
      `SELECT id, product_id, spec_text, display_order, created_at
       FROM product_specs
       WHERE product_id = $1
       ORDER BY display_order ASC`,
      [productId]
    );
    
    return result.rows;
  }
  
  // Toggle featured status
  async toggleFeatured(productId, featured) {
    const result = await db.query(
      `UPDATE products 
       SET featured = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, featured`,
      [featured, productId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    // Get updated product with relations
    const updatedProduct = await this.getProductById(productId);
    
    return updatedProduct;
  }
}

module.exports = new ProductService();
