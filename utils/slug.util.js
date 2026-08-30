const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Appends -2, -3, ... until the candidate doesn't collide with another
// product's slug. Pass `client` to run inside an existing transaction, and
// `excludeProductId` when regenerating a slug on update so a product doesn't
// collide with its own current slug.
const generateUniqueProductSlug = async (name, { client, excludeProductId } = {}) => {
  const db = require('../config/db.config');
  const runner = client || db;
  const base = slugify(name) || 'product';
  let candidate = base;
  let suffix = 2;

  // Bounded in practice by suffix growth — a catalog would need many
  // identically-named products before this loop runs more than once or twice.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = excludeProductId
      ? 'SELECT 1 FROM products WHERE slug = $1 AND id != $2'
      : 'SELECT 1 FROM products WHERE slug = $1';
    const params = excludeProductId ? [candidate, excludeProductId] : [candidate];
    const result = await runner.query(query, params);

    if (result.rows.length === 0) {
      return candidate;
    }

    candidate = `${base}-${suffix++}`;
  }
};

// Generalized version of generateUniqueProductSlug, parameterized by table —
// `table` is always a hardcoded string from our own call sites, never user
// input, so interpolating it directly into the query is safe here.
//
// `scopeColumn`/`scopeValue` narrow the uniqueness check to rows sharing that
// column's value instead of the whole table — e.g. a pc_series_variant_colors
// slug only needs to be unique within its own series_id, not globally, since
// the public URL is "/gaming-pc/:seriesSlug/:colorSlug". `scopeColumn` is
// always a hardcoded string from our own call sites too.
const generateUniqueSlug = async (name, table, { client, excludeId, scopeColumn, scopeValue } = {}) => {
  const db = require('../config/db.config');
  const runner = client || db;
  const base = slugify(name) || table;
  let candidate = base;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conditions = ['slug = $1'];
    const params = [candidate];

    if (scopeColumn) {
      params.push(scopeValue);
      conditions.push(`${scopeColumn} = $${params.length}`);
    }
    if (excludeId) {
      params.push(excludeId);
      conditions.push(`id != $${params.length}`);
    }

    const query = `SELECT 1 FROM ${table} WHERE ${conditions.join(' AND ')}`;
    const result = await runner.query(query, params);

    if (result.rows.length === 0) {
      return candidate;
    }

    candidate = `${base}-${suffix++}`;
  }
};

module.exports = { slugify, generateUniqueProductSlug, generateUniqueSlug };
