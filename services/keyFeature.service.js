const db = require('../config/db.config');

class KeyFeatureService {
  normalizeKeyFeatures(keyFeatures) {
    if (keyFeatures === undefined) {
      return undefined;
    }

    if (Array.isArray(keyFeatures)) {
      return keyFeatures;
    }

    if (typeof keyFeatures === 'string') {
      try {
        const parsed = JSON.parse(keyFeatures);
        if (!Array.isArray(parsed)) {
          throw new Error('key_features must be a valid JSON array');
        }

        return parsed;
      } catch (error) {
        throw new Error('key_features must be a valid JSON array');
      }
    }

    return [];
  }

  async createKeyFeature(featureData) {
    const existingFeature = await this.getKeyFeatureByName(
      featureData.category_id,
      featureData.feature_key
    );

    if (existingFeature) {
      throw new Error('Key feature already exists for this category');
    }

    const result = await db.query(
      `INSERT INTO category_key_features (
        category_id, feature_key, display_order, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        featureData.category_id,
        featureData.feature_key.trim(),
        featureData.display_order || 0,
        featureData.is_active !== undefined ? featureData.is_active : true
      ]
    );

    return this.getKeyFeatureById(result.rows[0].id);
  }

  async getAllKeyFeatures(filters = {}) {
    let query = `
      SELECT
        kf.*,
        c.category_name
      FROM category_key_features kf
      LEFT JOIN categories c ON kf.category_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.category_id) {
      query += ` AND kf.category_id = $${paramCount++}`;
      params.push(filters.category_id);
    }

    if (filters.is_active !== undefined) {
      query += ` AND kf.is_active = $${paramCount++}`;
      params.push(filters.is_active);
    }

    query += ` ORDER BY kf.display_order ASC, kf.feature_key ASC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  async getKeyFeatureById(featureId) {
    const result = await db.query(
      `SELECT
        kf.*,
        c.category_name
      FROM category_key_features kf
      LEFT JOIN categories c ON kf.category_id = c.id
      WHERE kf.id = $1`,
      [featureId]
    );

    return result.rows[0] || null;
  }

  async getKeyFeatureByName(categoryId, featureKey) {
    const result = await db.query(
      `SELECT
        kf.*,
        c.category_name
      FROM category_key_features kf
      LEFT JOIN categories c ON kf.category_id = c.id
      WHERE kf.category_id = $1 AND LOWER(kf.feature_key) = LOWER($2)`,
      [categoryId, featureKey.trim()]
    );

    return result.rows[0] || null;
  }

  async updateKeyFeature(featureId, featureData) {
    const currentFeature = await this.getKeyFeatureById(featureId);

    if (!currentFeature) {
      throw new Error('Key feature not found');
    }

    if (featureData.feature_key !== undefined) {
      const existingFeature = await this.getKeyFeatureByName(
        featureData.category_id || currentFeature.category_id,
        featureData.feature_key
      );

      if (existingFeature && existingFeature.id !== featureId) {
        throw new Error('Key feature already exists for this category');
      }
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    ['category_id', 'feature_key', 'display_order', 'is_active'].forEach(field => {
      if (featureData[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(field === 'feature_key' ? featureData[field].trim() : featureData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(featureId);

    const result = await db.query(
      `UPDATE category_key_features
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Key feature not found');
    }

    return this.getKeyFeatureById(featureId);
  }

  async deleteKeyFeature(featureId) {
    const result = await db.query(
      `DELETE FROM category_key_features
       WHERE id = $1
       RETURNING id, feature_key`,
      [featureId]
    );

    if (result.rows.length === 0) {
      throw new Error('Key feature not found');
    }

    return {
      message: 'Key feature deleted successfully',
      id: result.rows[0].id,
      feature_key: result.rows[0].feature_key
    };
  }

  async getOrCreateKeyFeature(client, categoryId, featureKey, displayOrder = 0) {
    const existingResult = await client.query(
      `SELECT *
       FROM category_key_features
       WHERE category_id = $1 AND LOWER(feature_key) = LOWER($2)
       LIMIT 1`,
      [categoryId, featureKey.trim()]
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0];
    }

    const result = await client.query(
      `INSERT INTO category_key_features (
        category_id, feature_key, display_order, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [categoryId, featureKey.trim(), displayOrder]
    );

    return result.rows[0];
  }

  async replaceProductKeyFeatures(client, productId, categoryId, keyFeatures = []) {
    await client.query('DELETE FROM product_key_features WHERE product_id = $1', [productId]);

    if (!keyFeatures.length) {
      return;
    }

    if (!categoryId) {
      throw new Error('Product category is required when saving key features');
    }

    for (let i = 0; i < keyFeatures.length; i++) {
      const feature = keyFeatures[i];
      const featureValue = feature.value !== undefined ? feature.value : feature.feature_value;

      if (featureValue === undefined || featureValue === null || !String(featureValue).trim()) {
        continue;
      }

      let keyFeatureId = feature.key_feature_id || feature.category_key_feature_id || feature.id;

      if (feature.feature_key && !keyFeatureId) {
        const keyFeature = await this.getOrCreateKeyFeature(
          client,
          categoryId,
          feature.feature_key,
          feature.display_order ?? i
        );
        keyFeatureId = keyFeature.id;
      }

      if (!keyFeatureId) {
        throw new Error('Each key feature requires key_feature_id or feature_key');
      }

      const keyFeatureResult = await client.query(
        `SELECT id
         FROM category_key_features
         WHERE id = $1 AND category_id = $2`,
        [keyFeatureId, categoryId]
      );

      if (keyFeatureResult.rows.length === 0) {
        throw new Error('Key feature does not belong to the selected category');
      }

      await client.query(
        `INSERT INTO product_key_features (
          product_id, category_key_feature_id, feature_value, display_order, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (product_id, category_key_feature_id)
        DO UPDATE SET
          feature_value = EXCLUDED.feature_value,
          display_order = EXCLUDED.display_order,
          updated_at = CURRENT_TIMESTAMP`,
        [productId, keyFeatureId, String(featureValue).trim(), feature.display_order ?? i]
      );
    }
  }
}

module.exports = new KeyFeatureService();
