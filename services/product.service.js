const db = require('../config/db.config');
const keyFeatureService = require('./keyFeature.service');
const { generateUniqueProductSlug } = require('../utils/slug.util');

class ProductService {
  // A product can never be 'published' while its category or any of its
  // vendors is unpublished — this closes the create/update path so the same
  // rule enforced for storefront visibility (see isPubliclyVisible /
  // getAllProducts' public_only filter) also holds for the product's own
  // status, instead of silently relying on hidden-but-marked-"published".
  // Pass the client mid-transaction so this reads consistently with the rest
  // of the create/update.
  async resolvePublishableStatus(client, requestedStatus, categoryId, vendorIds) {
    if (requestedStatus === 'draft') {
      return 'draft';
    }

    if (categoryId) {
      const categoryResult = await client.query(
        'SELECT is_published FROM categories WHERE id = $1',
        [categoryId]
      );
      if (categoryResult.rows.length > 0 && categoryResult.rows[0].is_published === false) {
        return 'draft';
      }
    }

    if (vendorIds && vendorIds.length > 0) {
      const vendorResult = await client.query(
        'SELECT 1 FROM vendors WHERE id = ANY($1::uuid[]) AND is_published = false LIMIT 1',
        [vendorIds]
      );
      if (vendorResult.rows.length > 0) {
        return 'draft';
      }
    }

    return requestedStatus || 'published';
  }

  // Create a new product with media and specs
  async createProduct(productData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const effectiveStatus = await this.resolvePublishableStatus(
        client,
        productData.status,
        productData.category_id || null,
        productData.vendor_ids || []
      );

      // Slugified name, used for clean storefront URLs (/product/<category>/<slug>)
      // instead of the raw id — deduped against existing products' slugs.
      const slug = await generateUniqueProductSlug(productData.name, { client });

      // Insert product
      const productResult = await client.query(
        `INSERT INTO products (
          name, slug, category_id, price, original_price, image, description,
          stock, status, featured, new_product, rating, reviews_count,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          productData.name,
          slug,
          productData.category_id || null,
          productData.price,
          productData.original_price || null,
          productData.image,
          productData.description || null,
          productData.stock || 0,
          effectiveStatus,
          productData.featured || false,
          productData.new_product || false,
          productData.rating || 0.00,
          productData.reviews_count || 0
        ]
      );

      const newProduct = productResult.rows[0];

      // Insert product vendors if provided
      if (productData.vendor_ids && productData.vendor_ids.length > 0) {
        for (const vendorId of productData.vendor_ids) {
          await client.query(
            `INSERT INTO product_vendors (product_id, vendor_id) VALUES ($1, $2)`,
            [newProduct.id, vendorId]
          );
        }
      }

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

      if (productData.key_features && productData.key_features.length > 0) {
        await keyFeatureService.replaceProductKeyFeatures(
          client,
          newProduct.id,
          newProduct.category_id,
          productData.key_features
        );
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
    // Build the shared WHERE clause once so the count query and the main
    // query never drift apart.
    const buildWhere = () => {
      let clause = ' WHERE 1=1';
      const whereParams = [];
      let paramCount = 1;

      if (filters.status) {
        clause += ` AND p.status = $${paramCount++}`;
        whereParams.push(filters.status);
      }

      if (filters.category_id) {
        clause += ` AND p.category_id = $${paramCount++}`;
        whereParams.push(filters.category_id);
      }

      if (filters.vendor_id) {
        clause += ` AND EXISTS (SELECT 1 FROM product_vendors pv2 WHERE pv2.product_id = p.id AND pv2.vendor_id = $${paramCount++})`;
        whereParams.push(filters.vendor_id);
      }

      // Storefront-only defense-in-depth: even if a product's own status is
      // still 'published', hide it when its category or any of its vendors
      // has since been unpublished (covers products added/edited after a
      // category/vendor was unpublished, not just the cascade at the moment
      // of unpublishing). Self-contained subqueries so this works whether
      // buildWhere() is used against a bare `FROM products p` (count query)
      // or the fully-joined main query.
      if (filters.public_only) {
        clause += ` AND (p.category_id IS NULL OR EXISTS (
          SELECT 1 FROM categories pc_cat WHERE pc_cat.id = p.category_id AND pc_cat.is_published = true
        ))`;
        clause += ` AND NOT EXISTS (
          SELECT 1 FROM product_vendors ppv
          JOIN vendors pv_v ON pv_v.id = ppv.vendor_id
          WHERE ppv.product_id = p.id AND pv_v.is_published = false
        )`;
      }

      if (filters.featured !== undefined) {
        clause += ` AND p.featured = $${paramCount++}`;
        whereParams.push(filters.featured);
      }

      if (filters.in_stock !== undefined) {
        clause += ` AND p.in_stock = $${paramCount++}`;
        whereParams.push(filters.in_stock);
      }

      if (filters.search) {
        clause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
        whereParams.push(`%${filters.search}%`);
        paramCount++;
      }

      // Dynamic "Specifications" filters — one EXISTS check per selected
      // category_key_feature, ANDed together, so picking values from two
      // different spec rows (e.g. RAM = 16GB AND Socket = AM5) narrows
      // correctly instead of matching either.
      if (Array.isArray(filters.key_features)) {
        filters.key_features.forEach((kf) => {
          if (!kf || !kf.id || !Array.isArray(kf.values) || kf.values.length === 0) return;
          clause += ` AND EXISTS (
            SELECT 1 FROM product_key_features pkf2
            WHERE pkf2.product_id = p.id
              AND pkf2.category_key_feature_id = $${paramCount++}
              AND pkf2.feature_value = ANY($${paramCount++})
          )`;
          whereParams.push(kf.id, kf.values);
        });
      }

      return { clause, whereParams };
    };

    const { clause: whereClause, whereParams } = buildWhere();

    // Pagination is opt-in via page/limit so existing callers that expect
    // the full list back (e.g. admin dashboard) keep working unchanged.
    const page = filters.page ? parseInt(filters.page, 10) : null;
    const limit = filters.limit ? parseInt(filters.limit, 10) : null;
    const isPaginated = page !== null || limit !== null;
    const effectivePage = page && page > 0 ? page : 1;
    const effectiveLimit = limit && limit > 0 ? limit : 24;

    let total = null;
    if (isPaginated) {
      const countResult = await db.query(
        `SELECT COUNT(*) FROM products p${whereClause}`,
        whereParams
      );
      total = parseInt(countResult.rows[0].count, 10);
    }

    // Every ordering ends with p.id as a tiebreaker so LIMIT/OFFSET pagination
    // is stable even when many rows share the same created_at/price/rating
    // (e.g. a bulk import where CURRENT_TIMESTAMP is frozen for the whole transaction).
    const sortOrderBy = {
      newest: 'p.created_at DESC, p.id',
      'price-low': 'p.price ASC, p.id',
      'price-high': 'p.price DESC, p.id',
      rating: 'p.rating DESC, p.id',
      featured: 'p.featured DESC, p.created_at DESC, p.id',
    }[filters.sort] || 'p.featured DESC, p.created_at DESC, p.id';

    let query = `
      SELECT
        p.*,
        c.category_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', v.id,
              'vendor_name', v.vendor_name
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) as vendors,
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
        ) as specs,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pkf.id,
              'key_feature_id', ckf.id,
              'feature_key', ckf.feature_key,
              'feature_value', pkf.feature_value,
              'display_order', pkf.display_order
            )
          ) FILTER (WHERE pkf.id IS NOT NULL),
          '[]'::json
        ) as key_features
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_vendors pv ON p.id = pv.product_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      LEFT JOIN product_key_features pkf ON p.id = pkf.product_id
      LEFT JOIN category_key_features ckf ON pkf.category_key_feature_id = ckf.id
      ${whereClause}
      GROUP BY p.id, c.category_name
      ORDER BY ${sortOrderBy}
    `;

    const params = [...whereParams];

    if (isPaginated) {
      const offset = (effectivePage - 1) * effectiveLimit;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(effectiveLimit, offset);
    }

    const result = await db.query(query, params);

    if (isPaginated) {
      return {
        rows: result.rows,
        pagination: {
          page: effectivePage,
          limit: effectiveLimit,
          total,
          totalPages: Math.ceil(total / effectiveLimit),
        },
      };
    }

    return { rows: result.rows, pagination: null };
  }
  
  // Get product by ID
  async getProductById(productId) {
    const result = await db.query(
      `SELECT
        p.*,
        c.category_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', v.id,
              'vendor_name', v.vendor_name
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) as vendors,
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
        ) as specs,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pkf.id,
              'key_feature_id', ckf.id,
              'feature_key', ckf.feature_key,
              'feature_value', pkf.feature_value,
              'display_order', pkf.display_order
            )
          ) FILTER (WHERE pkf.id IS NOT NULL),
          '[]'::json
        ) as key_features
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_vendors pv ON p.id = pv.product_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      LEFT JOIN product_key_features pkf ON p.id = pkf.product_id
      LEFT JOIN category_key_features ckf ON pkf.category_key_feature_id = ckf.id
      WHERE p.id = $1
      GROUP BY p.id, c.category_name`,
      [productId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // Same as getProductById, but looked up by its slug — used by the
  // storefront's clean product URLs (/product/<category>/<slug>).
  async getProductBySlug(slug) {
    const result = await db.query(
      `SELECT
        p.*,
        c.category_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', v.id,
              'vendor_name', v.vendor_name
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) as vendors,
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
        ) as specs,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pkf.id,
              'key_feature_id', ckf.id,
              'feature_key', ckf.feature_key,
              'feature_value', pkf.feature_value,
              'display_order', pkf.display_order
            )
          ) FILTER (WHERE pkf.id IS NOT NULL),
          '[]'::json
        ) as key_features
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_vendors pv ON p.id = pv.product_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      LEFT JOIN product_key_features pkf ON p.id = pkf.product_id
      LEFT JOIN category_key_features ckf ON pkf.category_key_feature_id = ckf.id
      WHERE p.slug = $1
      GROUP BY p.id, c.category_name`,
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // Lightweight check for the public single-product route: is this product
  // actually visible on the storefront right now? Checks its own status plus
  // whether its category or any of its vendors has since been unpublished —
  // much cheaper than pulling the full getProductById() payload just to
  // inspect .status.
  async isPubliclyVisible(productId) {
    const result = await db.query(
      `SELECT
        p.status,
        (p.category_id IS NULL OR c.is_published = true) AS category_ok,
        NOT EXISTS (
          SELECT 1 FROM product_vendors pv
          JOIN vendors v ON v.id = pv.vendor_id
          WHERE pv.product_id = p.id AND v.is_published = false
        ) AS vendor_ok
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const row = result.rows[0];
    return row.status === 'published' && row.category_ok && row.vendor_ok;
  }

  // Same as isPubliclyVisible, but looked up by slug — used by the public
  // get-by-slug route.
  async isPubliclyVisibleBySlug(slug) {
    const result = await db.query(
      `SELECT
        p.id,
        p.status,
        (p.category_id IS NULL OR c.is_published = true) AS category_ok,
        NOT EXISTS (
          SELECT 1 FROM product_vendors pv
          JOIN vendors v ON v.id = pv.vendor_id
          WHERE pv.product_id = p.id AND v.is_published = false
        ) AS vendor_ok
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const row = result.rows[0];
    return row.status === 'published' && row.category_ok && row.vendor_ok;
  }

  // Update product
  async updateProduct(productId, productData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Re-resolve publishability whenever status, category, or vendor
      // assignment changes — never let an update leave the product
      // 'published' under an unpublished category/vendor. If status wasn't
      // explicitly touched, this preserves whatever the product's current
      // status already was (an existing 'draft' stays 'draft' — changing a
      // product's category doesn't silently republish it).
      const needsPublishabilityCheck =
        productData.status !== undefined ||
        productData.category_id !== undefined ||
        productData.vendor_ids !== undefined;

      if (needsPublishabilityCheck) {
        const currentResult = await client.query(
          'SELECT category_id, status FROM products WHERE id = $1',
          [productId]
        );

        if (currentResult.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('Product not found');
        }

        const current = currentResult.rows[0];
        const effectiveCategoryId = productData.category_id !== undefined ? productData.category_id : current.category_id;

        let effectiveVendorIds = productData.vendor_ids;
        if (effectiveVendorIds === undefined) {
          const currentVendorsResult = await client.query(
            'SELECT vendor_id FROM product_vendors WHERE product_id = $1',
            [productId]
          );
          effectiveVendorIds = currentVendorsResult.rows.map((row) => row.vendor_id);
        }

        const requestedStatus = productData.status !== undefined ? productData.status : current.status;
        productData.status = await this.resolvePublishableStatus(client, requestedStatus, effectiveCategoryId, effectiveVendorIds);
      }

      // Renaming a product regenerates its slug (unless the caller explicitly
      // set one) so the storefront URL stays in sync with the new name — the
      // id is still what's actually looked up on old links, so this never
      // breaks anything, it just keeps new links readable.
      if (productData.name !== undefined && productData.slug === undefined) {
        productData.slug = await generateUniqueProductSlug(productData.name, { client, excludeProductId: productId });
      }

      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = [
        'name', 'slug', 'category_id', 'price', 'original_price', 'image', 'description',
        'stock', 'status', 'featured', 'new_product', 'rating', 'reviews_count'
      ];
      
      allowedFields.forEach(field => {
        if (productData[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount++}`);
          values.push(productData[field]);
        }
      });
      
      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(productId);

        const updateQuery = `
          UPDATE products
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;

        const result = await client.query(updateQuery, values);

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('Product not found');
        }
      }

      if (
        updateFields.length === 0 &&
        productData.vendor_ids === undefined &&
        productData.media === undefined &&
        productData.specs === undefined &&
        productData.key_features === undefined
      ) {
        await client.query('ROLLBACK');
        throw new Error('No fields to update');
      }
      
      // Update vendors if provided
      if (productData.vendor_ids !== undefined) {
        await client.query('DELETE FROM product_vendors WHERE product_id = $1', [productId]);
        for (const vendorId of productData.vendor_ids) {
          await client.query(
            `INSERT INTO product_vendors (product_id, vendor_id) VALUES ($1, $2)`,
            [productId, vendorId]
          );
        }
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

      if (productData.key_features !== undefined) {
        const productResult = await client.query(
          'SELECT category_id FROM products WHERE id = $1',
          [productId]
        );

        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('Product not found');
        }

        await keyFeatureService.replaceProductKeyFeatures(
          client,
          productId,
          productResult.rows[0].category_id,
          productData.key_features
        );
      } else if (productData.category_id !== undefined) {
        await client.query('DELETE FROM product_key_features WHERE product_id = $1', [productId]);
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

  // Bulk delete products
  async bulkDeleteProducts(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('No product IDs provided');
    }

    // Find which of the requested ids actually exist first, so we can
    // report skipped ids and still fetch their media for S3 cleanup.
    const existingResult = await db.query(
      `SELECT id, name, image FROM products WHERE id = ANY($1::uuid[])`,
      [productIds]
    );

    const foundIds = existingResult.rows.map((row) => row.id);
    const notFound = productIds.filter((id) => !foundIds.includes(id));

    if (foundIds.length === 0) {
      return { deleted: [], notFound };
    }

    const mediaResult = await db.query(
      `SELECT product_id, url FROM product_media WHERE product_id = ANY($1::uuid[])`,
      [foundIds]
    );
    const mediaByProduct = {};
    mediaResult.rows.forEach((row) => {
      if (!mediaByProduct[row.product_id]) mediaByProduct[row.product_id] = [];
      mediaByProduct[row.product_id].push(row.url);
    });

    // FK constraints on product_vendors/product_media/product_specs/
    // product_key_features are ON DELETE CASCADE, same as single deleteProduct.
    const deleteResult = await db.query(
      `DELETE FROM products WHERE id = ANY($1::uuid[]) RETURNING id, name, image`,
      [foundIds]
    );

    const deleted = deleteResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      image: row.image,
      media: mediaByProduct[row.id] || []
    }));

    return { deleted, notFound };
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
