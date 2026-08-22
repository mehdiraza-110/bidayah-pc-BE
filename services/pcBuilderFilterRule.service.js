const db = require('../config/db.config');
const pcBuilderCategoryVendorService = require('./pcBuilderCategoryVendor.service');

// Generic, admin-rule-free compatibility layer on top of `category_key_features` /
// `product_key_features` (the structured spec data every category was imported with —
// Socket Type, Memory Type, Recommended PSU, etc.). This runs ALONGSIDE the
// `pc_builder_filter_rules` mechanism below (both are AND'd together): a rule row is still
// the right tool for vendor-restriction UX (e.g. "only show ASUS/GIGABYTE GPUs"), but real
// hardware compatibility (a CPU's socket must match a motherboard's socket, a PSU must supply
// enough wattage for a GPU, ...) is driven directly off the actual selected product's own spec
// values here, so it doesn't need one hand-authored rule per CPU model.
//
// Each entry says: "if the selected product has `selectedKey`, and the result category has a
// key feature called `resultKey`, the candidate product's `resultKey` value must satisfy this
// relationship with the selected product's `selectedKey` value."
const KEY_FEATURE_MATCHERS = [
  // CPU <-> Motherboard: platform brand and physical socket must both agree.
  { selectedKey: 'CPU Brand', resultKey: 'CPU Brand', type: 'equals' },
  { selectedKey: 'Socket Type', resultKey: 'Socket Type', type: 'equals' },
  // CPU or Motherboard socket <-> CPU Cooler's supported-socket list.
  { selectedKey: 'Socket Type', resultKey: 'Compatible Sockets', type: 'result_list_contains_selected' },
  { selectedKey: 'Compatible Sockets', resultKey: 'Socket Type', type: 'selected_list_contains_result' },
  // RAM <-> Motherboard: DDR generation must match.
  { selectedKey: 'Memory Type', resultKey: 'Memory Type', type: 'equals' },
  // GPU <-> PSU: the PSU's wattage must meet or exceed the GPU's recommended wattage, in
  // whichever order the customer picks them.
  { selectedKey: 'Recommended PSU', resultKey: 'Wattage', type: 'result_numeric_gte_selected' },
  { selectedKey: 'Wattage', resultKey: 'Recommended PSU', type: 'result_numeric_lte_selected' },
];

class PcBuilderFilterRuleService {
  // feature_key -> feature_value for one product, e.g. { 'Socket Type': 'AM5', 'CPU Brand': 'AMD' }.
  async getProductKeyFeatures(productId) {
    const result = await db.query(
      `SELECT ckf.feature_key, pkf.feature_value
       FROM product_key_features pkf
       JOIN category_key_features ckf ON ckf.id = pkf.category_key_feature_id
       WHERE pkf.product_id = $1`,
      [productId]
    );

    const featuresByKey = {};
    for (const row of result.rows) {
      featuresByKey[row.feature_key] = row.feature_value;
    }
    return featuresByKey;
  }

  // Which feature_key names a category actually has defined (so we only build a clause for a
  // matcher when the result category could possibly have that feature).
  async getCategoryFeatureKeys(categoryId) {
    const result = await db.query(
      `SELECT feature_key FROM category_key_features WHERE category_id = $1 AND is_active = true`,
      [categoryId]
    );
    return new Set(result.rows.map(row => row.feature_key));
  }

  // Builds the SQL fragment(s) requiring a candidate product (aliased `p` in the caller's query)
  // to be spec-compatible with whatever real products were already picked in this build.
  // Returns { clauses, params } — clauses is an array of standalone boolean SQL fragments meant
  // to be AND'd together by the caller; params must be appended to the caller's param list in
  // order, starting at `startParamIndex`.
  async buildKeyFeatureConstraintClauses(resultCategoryId, priorSelections = [], startParamIndex) {
    const resultFeatureKeys = await this.getCategoryFeatureKeys(resultCategoryId);
    const clauses = [];
    const params = [];
    let paramCount = startParamIndex;

    if (resultFeatureKeys.size === 0) {
      return { clauses, params };
    }

    for (const selection of priorSelections) {
      if (!selection || !selection.product_id) continue;
      if (selection.category_id === resultCategoryId) continue;

      const selectedFeatures = await this.getProductKeyFeatures(selection.product_id);
      if (Object.keys(selectedFeatures).length === 0) continue;

      const perSelectionClauses = [];

      for (const matcher of KEY_FEATURE_MATCHERS) {
        if (!(matcher.selectedKey in selectedFeatures)) continue;
        if (!resultFeatureKeys.has(matcher.resultKey)) continue;

        const selectedValue = selectedFeatures[matcher.selectedKey];

        if (matcher.type === 'equals') {
          perSelectionClauses.push(`EXISTS (
            SELECT 1 FROM product_key_features mpkf
            JOIN category_key_features mckf ON mckf.id = mpkf.category_key_feature_id
            WHERE mpkf.product_id = p.id AND mckf.feature_key = $${paramCount++}
              AND LOWER(TRIM(mpkf.feature_value)) = LOWER(TRIM($${paramCount++}))
          )`);
          params.push(matcher.resultKey, selectedValue);
        } else if (matcher.type === 'result_list_contains_selected') {
          perSelectionClauses.push(`EXISTS (
            SELECT 1 FROM product_key_features mpkf
            JOIN category_key_features mckf ON mckf.id = mpkf.category_key_feature_id
            WHERE mpkf.product_id = p.id AND mckf.feature_key = $${paramCount++}
              AND EXISTS (
                SELECT 1 FROM unnest(string_to_array(mpkf.feature_value, ',')) AS item
                WHERE LOWER(TRIM(item)) = LOWER(TRIM($${paramCount++}))
              )
          )`);
          params.push(matcher.resultKey, selectedValue);
        } else if (matcher.type === 'selected_list_contains_result') {
          const selectedList = String(selectedValue)
            .split(',')
            .map(v => v.trim().toLowerCase())
            .filter(Boolean);
          if (selectedList.length === 0) continue;

          perSelectionClauses.push(`EXISTS (
            SELECT 1 FROM product_key_features mpkf
            JOIN category_key_features mckf ON mckf.id = mpkf.category_key_feature_id
            WHERE mpkf.product_id = p.id AND mckf.feature_key = $${paramCount++}
              AND LOWER(TRIM(mpkf.feature_value)) = ANY($${paramCount++}::text[])
          )`);
          params.push(matcher.resultKey, selectedList);
        } else if (matcher.type === 'result_numeric_gte_selected' || matcher.type === 'result_numeric_lte_selected') {
          const selectedNumeric = parseFloat(String(selectedValue).replace(/[^0-9.]/g, ''));
          if (Number.isNaN(selectedNumeric)) continue;
          const operator = matcher.type === 'result_numeric_gte_selected' ? '>=' : '<=';

          perSelectionClauses.push(`EXISTS (
            SELECT 1 FROM product_key_features mpkf
            JOIN category_key_features mckf ON mckf.id = mpkf.category_key_feature_id
            WHERE mpkf.product_id = p.id AND mckf.feature_key = $${paramCount++}
              AND NULLIF(regexp_replace(mpkf.feature_value, '[^0-9.]', '', 'g'), '')::numeric ${operator} $${paramCount++}
          )`);
          params.push(matcher.resultKey, selectedNumeric);
        }
      }

      if (perSelectionClauses.length > 0) {
        clauses.push(`(${perSelectionClauses.join(' AND ')})`);
      }
    }

    return { clauses, params };
  }

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

  // Active rules that fire when `vendorId` is chosen for `categoryId`, and
  // restrict/inform the browsing of `resultCategoryId`.
  async getRulesForTrigger({ categoryId, vendorId, resultCategoryId }) {
    const result = await db.query(
      `SELECT * FROM pc_builder_filter_rules
       WHERE is_active = true
         AND selected_category_id = $1
         AND (selected_vendor_id IS NULL OR selected_vendor_id = $2)
         AND result_category_id = $3
       ORDER BY priority DESC, created_at DESC`,
      [categoryId, vendorId, resultCategoryId]
    );

    return result.rows;
  }

  // Categories that actually drive a compatibility rule elsewhere (e.g. CPU
  // narrowing Motherboard by socket/vendor). Lets the builder UI only
  // auto-apply a vendor filter after a pick for categories where it's
  // meaningful — trivial categories (fans, keyboards, ...) shouldn't have
  // their own remaining choices narrowed down to whatever vendor was just
  // picked.
  async getActiveTriggerCategoryIds() {
    const result = await db.query(
      `SELECT DISTINCT selected_category_id FROM pc_builder_filter_rules WHERE is_active = true`
    );

    return result.rows.map(row => row.selected_category_id);
  }

  // One entry per prior selection (elsewhere in the build) that has at least
  // one active rule constraining `resultCategoryId`. Rules within one entry
  // are alternatives (OR); entries combine as requirements (AND).
  async getCompatibilityConstraints(resultCategoryId, priorSelections = []) {
    const constraintsPerTrigger = [];

    for (const selection of priorSelections) {
      if (!selection || !selection.category_id || !selection.vendor_id) continue;
      if (selection.category_id === resultCategoryId) continue;

      const rules = await this.getRulesForTrigger({
        categoryId: selection.category_id,
        vendorId: selection.vendor_id,
        resultCategoryId,
      });

      if (rules.length > 0) {
        constraintsPerTrigger.push(rules);
      }
    }

    return constraintsPerTrigger;
  }

  // Vendors valid for `categoryId`, narrowed by whatever compatibility rules
  // the customer's other selections (`priorSelections`) trigger.
  async getVendorsForSelection(categoryId, priorSelections = []) {
    const baseVendors = await pcBuilderCategoryVendorService.getVendorsForCategory(categoryId);
    const constraintsPerTrigger = await this.getCompatibilityConstraints(categoryId, priorSelections);

    let allowedVendorIds = null;

    for (const triggerRules of constraintsPerTrigger) {
      const vendorIdsForTrigger = triggerRules.map(rule => rule.result_vendor_id).filter(Boolean);
      if (vendorIdsForTrigger.length === 0) continue;

      const setForTrigger = new Set(vendorIdsForTrigger);
      allowedVendorIds = allowedVendorIds === null
        ? setForTrigger
        : new Set([...allowedVendorIds].filter(id => setForTrigger.has(id)));
    }

    const { clauses: kfClauses, params: kfParams } = await this.buildKeyFeatureConstraintClauses(categoryId, priorSelections, 2);
    if (kfClauses.length > 0) {
      const vendorResult = await db.query(
        `SELECT DISTINCT pv.vendor_id
         FROM products p
         JOIN product_vendors pv ON pv.product_id = p.id
         WHERE p.category_id = $1 AND ${kfClauses.join(' AND ')}`,
        [categoryId, ...kfParams]
      );
      const keyFeatureVendorIds = new Set(vendorResult.rows.map(row => row.vendor_id));
      allowedVendorIds = allowedVendorIds === null
        ? keyFeatureVendorIds
        : new Set([...allowedVendorIds].filter(id => keyFeatureVendorIds.has(id)));
    }

    if (allowedVendorIds === null) {
      return baseVendors;
    }

    return baseVendors.filter(vendor => allowedVendorIds.has(vendor.id));
  }

  // Products for a category + vendor selection, additionally constrained by
  // any compatibility rules the customer's other selections trigger. Works
  // even when no rules exist at all (plain category/vendor lookup).
  async getProductsForCategorySelection({ categoryId, vendorId, priorSelections = [], status, inStock, search, limit, offset }) {
    const constraintsPerTrigger = await this.getCompatibilityConstraints(categoryId, priorSelections);

    let query = `
      SELECT
        p.*,
        c.category_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', v.id, 'vendor_name', v.vendor_name)
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) AS vendors,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', pm.id, 'url', pm.url, 'type', pm.type, 'display_order', pm.display_order)
          ) FILTER (WHERE pm.id IS NOT NULL),
          '[]'::json
        ) AS media,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', ps.id, 'spec_text', ps.spec_text, 'display_order', ps.display_order)
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
        AND (c.id IS NULL OR c.is_published = true)
        AND NOT EXISTS (
          SELECT 1 FROM product_vendors epv
          JOIN vendors ev ON ev.id = epv.vendor_id
          WHERE epv.product_id = p.id AND ev.is_published = false
        )
    `;

    const params = [categoryId];
    let paramCount = 2;

    if (vendorId) {
      query += ` AND EXISTS (
        SELECT 1 FROM product_vendors selected_pv
        WHERE selected_pv.product_id = p.id AND selected_pv.vendor_id = $${paramCount++}
      )`;
      params.push(vendorId);
    }

    if (status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(status);
    }

    if (inStock !== undefined) {
      query += ` AND p.in_stock = $${paramCount++}`;
      params.push(inStock);
    }

    if (search && search.trim()) {
      query += ` AND p.name ILIKE $${paramCount++}`;
      params.push(`%${search.trim()}%`);
    }

    for (const triggerRules of constraintsPerTrigger) {
      const orClauses = [];

      for (const rule of triggerRules) {
        const clauseParts = [];

        if (rule.result_vendor_id) {
          clauseParts.push(`EXISTS (
            SELECT 1 FROM product_vendors result_pv
            WHERE result_pv.product_id = p.id AND result_pv.vendor_id = $${paramCount++}
          )`);
          params.push(rule.result_vendor_id);
        }

        if (rule.spec_match_terms && rule.spec_match_terms.length > 0) {
          if (rule.spec_match_mode === 'all') {
            clauseParts.push(`NOT EXISTS (
              SELECT 1 FROM unnest($${paramCount++}::text[]) AS required_term(term)
              WHERE NOT EXISTS (
                SELECT 1 FROM product_specs term_specs
                WHERE term_specs.product_id = p.id
                  AND term_specs.spec_text ILIKE '%' || required_term.term || '%'
              )
            )`);
          } else {
            clauseParts.push(`EXISTS (
              SELECT 1 FROM product_specs term_specs
              WHERE term_specs.product_id = p.id
                AND EXISTS (
                  SELECT 1 FROM unnest($${paramCount++}::text[]) AS required_term(term)
                  WHERE term_specs.spec_text ILIKE '%' || required_term.term || '%'
                )
            )`);
          }

          params.push(rule.spec_match_terms);
        }

        if (clauseParts.length > 0) {
          orClauses.push(`(${clauseParts.join(' AND ')})`);
        }
      }

      if (orClauses.length > 0) {
        query += ` AND (${orClauses.join(' OR ')})`;
      }
    }

    const { clauses: kfClauses, params: kfParams } = await this.buildKeyFeatureConstraintClauses(categoryId, priorSelections, paramCount);
    if (kfClauses.length > 0) {
      query += ` AND ${kfClauses.join(' AND ')}`;
      params.push(...kfParams);
      paramCount += kfParams.length;
    }

    query += ` GROUP BY p.id, c.category_name ORDER BY p.created_at DESC`;

    const effectiveLimit = limit && limit > 0 ? limit : null;
    const effectiveOffset = offset && offset > 0 ? offset : 0;

    if (effectiveLimit) {
      // Fetch one extra row to detect whether more pages exist, without a second COUNT query.
      query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(effectiveLimit + 1, effectiveOffset);
    }

    const result = await db.query(query, params);
    const rows = result.rows;

    if (!effectiveLimit) {
      return { products: rows, hasMore: false };
    }

    const hasMore = rows.length > effectiveLimit;
    return { products: hasMore ? rows.slice(0, effectiveLimit) : rows, hasMore };
  }
}

module.exports = new PcBuilderFilterRuleService();
