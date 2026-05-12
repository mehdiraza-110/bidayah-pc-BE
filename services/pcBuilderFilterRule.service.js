const db = require('../config/db.config');

class PcBuilderFilterRuleService {
  normalizeSpecTerms(specMatchTerms) {
    if (specMatchTerms === undefined) {
      return undefined;
    }

    if (Array.isArray(specMatchTerms)) {
      return specMatchTerms.map(term => String(term).trim()).filter(Boolean);
    }

    if (typeof specMatchTerms === 'string') {
      try {
        const parsed = JSON.parse(specMatchTerms);
        if (Array.isArray(parsed)) {
          return parsed.map(term => String(term).trim()).filter(Boolean);
        }
      } catch (error) {
        return specMatchTerms.split(',').map(term => term.trim()).filter(Boolean);
      }
    }

    return [];
  }

  async createRule(ruleData) {
    const result = await db.query(
      `INSERT INTO pc_builder_filter_rules (
        rule_name, selected_category_id, selected_vendor_id, result_category_id,
        result_vendor_id, spec_match_terms, spec_match_mode, priority, is_active,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        ruleData.rule_name,
        ruleData.selected_category_id,
        ruleData.selected_vendor_id || null,
        ruleData.result_category_id,
        ruleData.result_vendor_id || null,
        ruleData.spec_match_terms || [],
        ruleData.spec_match_mode || 'any',
        ruleData.priority || 0,
        ruleData.is_active !== undefined ? ruleData.is_active : true
      ]
    );

    return this.getRuleById(result.rows[0].id);
  }

  async getAllRules(filters = {}) {
    let query = `
      SELECT
        r.*,
        selected_category.category_name AS selected_category_name,
        selected_vendor.vendor_name AS selected_vendor_name,
        result_category.category_name AS result_category_name,
        result_vendor.vendor_name AS result_vendor_name
      FROM pc_builder_filter_rules r
      LEFT JOIN categories selected_category ON r.selected_category_id = selected_category.id
      LEFT JOIN vendors selected_vendor ON r.selected_vendor_id = selected_vendor.id
      LEFT JOIN categories result_category ON r.result_category_id = result_category.id
      LEFT JOIN vendors result_vendor ON r.result_vendor_id = result_vendor.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.selected_category_id) {
      query += ` AND r.selected_category_id = $${paramCount++}`;
      params.push(filters.selected_category_id);
    }

    if (filters.selected_vendor_id) {
      query += ` AND r.selected_vendor_id = $${paramCount++}`;
      params.push(filters.selected_vendor_id);
    }

    if (filters.result_category_id) {
      query += ` AND r.result_category_id = $${paramCount++}`;
      params.push(filters.result_category_id);
    }

    if (filters.result_vendor_id) {
      query += ` AND r.result_vendor_id = $${paramCount++}`;
      params.push(filters.result_vendor_id);
    }

    if (filters.is_active !== undefined) {
      query += ` AND r.is_active = $${paramCount++}`;
      params.push(filters.is_active);
    }

    query += ` ORDER BY r.priority DESC, r.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  async getRuleById(ruleId) {
    const result = await db.query(
      `SELECT
        r.*,
        selected_category.category_name AS selected_category_name,
        selected_vendor.vendor_name AS selected_vendor_name,
        result_category.category_name AS result_category_name,
        result_vendor.vendor_name AS result_vendor_name
      FROM pc_builder_filter_rules r
      LEFT JOIN categories selected_category ON r.selected_category_id = selected_category.id
      LEFT JOIN vendors selected_vendor ON r.selected_vendor_id = selected_vendor.id
      LEFT JOIN categories result_category ON r.result_category_id = result_category.id
      LEFT JOIN vendors result_vendor ON r.result_vendor_id = result_vendor.id
      WHERE r.id = $1`,
      [ruleId]
    );

    return result.rows[0] || null;
  }

  async updateRule(ruleId, ruleData) {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'rule_name',
      'selected_category_id',
      'selected_vendor_id',
      'result_category_id',
      'result_vendor_id',
      'spec_match_terms',
      'spec_match_mode',
      'priority',
      'is_active'
    ];

    allowedFields.forEach(field => {
      if (ruleData[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(ruleData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(ruleId);

    const result = await db.query(
      `UPDATE pc_builder_filter_rules
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Rule not found');
    }

    return this.getRuleById(ruleId);
  }

  async deleteRule(ruleId) {
    const result = await db.query(
      `DELETE FROM pc_builder_filter_rules WHERE id = $1 RETURNING id, rule_name`,
      [ruleId]
    );

    if (result.rows.length === 0) {
      throw new Error('Rule not found');
    }

    return {
      message: 'PC builder filter rule deleted successfully',
      id: result.rows[0].id,
      rule_name: result.rows[0].rule_name
    };
  }

  async getMatchingProducts(ruleId, filters = {}) {
    const rule = await this.getRuleById(ruleId);

    if (!rule) {
      throw new Error('Rule not found');
    }

    return this.getProductsForRule(rule, filters);
  }

  async getProductsForSelection(filters = {}) {
    let ruleQuery = `
      SELECT
        r.*,
        selected_category.category_name AS selected_category_name,
        selected_vendor.vendor_name AS selected_vendor_name,
        result_category.category_name AS result_category_name,
        result_vendor.vendor_name AS result_vendor_name
      FROM pc_builder_filter_rules r
      LEFT JOIN categories selected_category ON r.selected_category_id = selected_category.id
      LEFT JOIN vendors selected_vendor ON r.selected_vendor_id = selected_vendor.id
      LEFT JOIN categories result_category ON r.result_category_id = result_category.id
      LEFT JOIN vendors result_vendor ON r.result_vendor_id = result_vendor.id
      WHERE r.is_active = true
        AND r.selected_category_id = $1
    `;

    const ruleParams = [filters.selected_category_id];
    let ruleParamCount = 2;

    if (filters.selected_vendor_id) {
      ruleQuery += ` AND (r.selected_vendor_id IS NULL OR r.selected_vendor_id = $${ruleParamCount++})`;
      ruleParams.push(filters.selected_vendor_id);
    } else {
      ruleQuery += ` AND r.selected_vendor_id IS NULL`;
    }

    if (filters.result_category_id) {
      ruleQuery += ` AND r.result_category_id = $${ruleParamCount++}`;
      ruleParams.push(filters.result_category_id);
    }

    ruleQuery += ` ORDER BY r.priority DESC, r.created_at DESC`;

    const ruleResult = await db.query(ruleQuery, ruleParams);
    const selectedRules = ruleResult.rows;

    if (selectedRules.length === 0) {
      return { rules: [], products: [] };
    }

    const productsById = new Map();

    for (const rule of selectedRules) {
      const products = await this.getProductsForRule(rule, filters);
      products.forEach(product => productsById.set(product.id, product));
    }

    return {
      rules: selectedRules,
      products: Array.from(productsById.values())
    };
  }

  async getProductsForRule(rule, filters = {}) {
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
        ) AS vendors,
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
        ) AS media,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ps.id,
              'spec_text', ps.spec_text,
              'display_order', ps.display_order
            )
          ) FILTER (WHERE ps.id IS NOT NULL),
          '[]'::json
        ) AS specs
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_vendors pv ON p.id = pv.product_id
      LEFT JOIN vendors v ON pv.vendor_id = v.id
      LEFT JOIN product_media pm ON p.id = pm.product_id
      LEFT JOIN product_specs ps ON p.id = ps.product_id
      WHERE p.category_id = $1
    `;

    const params = [rule.result_category_id];
    let paramCount = 2;

    if (rule.result_vendor_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM product_vendors result_pv
        WHERE result_pv.product_id = p.id AND result_pv.vendor_id = $${paramCount++}
      )`;
      params.push(rule.result_vendor_id);
    }

    if (filters.status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(filters.status);
    }

    if (filters.in_stock !== undefined) {
      query += ` AND p.in_stock = $${paramCount++}`;
      params.push(filters.in_stock);
    }

    if (rule.spec_match_terms && rule.spec_match_terms.length > 0) {
      if (rule.spec_match_mode === 'all') {
        query += ` AND NOT EXISTS (
          SELECT 1 FROM unnest($${paramCount++}::text[]) AS required_term(term)
          WHERE NOT EXISTS (
            SELECT 1 FROM product_specs term_specs
            WHERE term_specs.product_id = p.id
              AND term_specs.spec_text ILIKE '%' || required_term.term || '%'
          )
        )`;
      } else {
        query += ` AND EXISTS (
          SELECT 1 FROM product_specs term_specs
          WHERE term_specs.product_id = p.id
            AND EXISTS (
              SELECT 1 FROM unnest($${paramCount++}::text[]) AS required_term(term)
              WHERE term_specs.spec_text ILIKE '%' || required_term.term || '%'
            )
        )`;
      }

      params.push(rule.spec_match_terms);
    }

    query += ` GROUP BY p.id, c.category_name ORDER BY p.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = new PcBuilderFilterRuleService();
