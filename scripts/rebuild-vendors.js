// Rebuilds the vendors table from scratch based solely on the brands actually present in the
// current live product catalog. The old vendors table had 69 rows, but only 26 were ever
// referenced by an actual product — the other 43 were leftover cruft from a much older catalog
// import (junk like "connector Unpublsih", "LOCAL  PRODUCT", "CMOS Mother Board cell", etc.).
//
// This script:
//   1. Snapshots every (product -> vendor), (pc_builder_category_vendors), and
//      (pc_builder_filter_rules vendor reference) row using vendor NAME (not id), plus a couple
//      of casing fixups (see CANONICAL_RENAMES below) so the rebuilt vendor list is fully
//      consistent (single-word brands in ALL CAPS, multi-word/stylized names in proper case).
//   2. Deletes every row from `vendors` (cascades product_vendors + pc_builder_category_vendors
//      per the schema's ON DELETE CASCADE; sets pc_builder_filter_rules' vendor columns to NULL
//      per its ON DELETE SET NULL).
//   3. Re-creates one vendor row per unique canonical name.
//   4. Re-links everything from the snapshots against the new vendor ids, so nothing that was
//      pointing at a real, still-used vendor gets silently lost.
//
// The two "__SMOKE_TEST__ CPU ..." products (leftover engineering test data, never had a vendor
// link) are deleted as part of this cleanup too.
require('dotenv').config();
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Only casing fix needed: every other single-word brand already in use is ALL CAPS
// (ASUS, MSI, DEEPCOOL, ZOTAC, GIGABYTE, ...) except "Palit", which slipped in mixed-case.
const CANONICAL_RENAMES = {
  Palit: 'PALIT',
};

function canonicalize(name) {
  return CANONICAL_RENAMES[name] || name;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will rebuild vendors table)'}`);

  // ---------- snapshot everything that references a vendor, by NAME ----------
  const productVendorRows = await pool.query(`
    SELECT pv.product_id, v.vendor_name, p.name as product_name
    FROM product_vendors pv
    JOIN vendors v ON v.id = pv.vendor_id
    JOIN products p ON p.id = pv.product_id
  `);
  const categoryVendorRows = await pool.query(`
    SELECT pcv.category_id, v.vendor_name, pcv.display_order, c.category_name
    FROM pc_builder_category_vendors pcv
    JOIN vendors v ON v.id = pcv.vendor_id
    JOIN categories c ON c.id = pcv.category_id
  `);
  const filterRuleRows = await pool.query(`
    SELECT fr.id, fr.rule_name, sv.vendor_name as selected_vendor_name, rv.vendor_name as result_vendor_name
    FROM pc_builder_filter_rules fr
    LEFT JOIN vendors sv ON sv.id = fr.selected_vendor_id
    LEFT JOIN vendors rv ON rv.id = fr.result_vendor_id
  `);
  const smokeTestProducts = await pool.query(`SELECT id, name FROM products WHERE name LIKE '\\_\\_SMOKE\\_TEST\\_\\_%'`);

  const canonicalNames = [...new Set(productVendorRows.rows.map((r) => canonicalize(r.vendor_name)))].sort();

  console.log(`\nCanonical vendor list derived from ${productVendorRows.rows.length} product-vendor links (${canonicalNames.length} unique):`);
  canonicalNames.forEach((n) => console.log(`  - ${n}`));

  console.log(`\npc_builder_category_vendors rows to preserve: ${categoryVendorRows.rows.length}`);
  categoryVendorRows.rows.forEach((r) => console.log(`  - ${r.category_name} -> ${canonicalize(r.vendor_name)} (order ${r.display_order})`));

  console.log(`\npc_builder_filter_rules vendor references to preserve: ${filterRuleRows.rows.length}`);
  filterRuleRows.rows.forEach((r) => console.log(`  - ${r.rule_name}: selected=${r.selected_vendor_name ? canonicalize(r.selected_vendor_name) : 'null'}, result=${r.result_vendor_name ? canonicalize(r.result_vendor_name) : 'null'}`));

  console.log(`\nSmoke-test products to delete: ${smokeTestProducts.rows.length}`);
  smokeTestProducts.rows.forEach((r) => console.log(`  - ${r.name}`));

  if (DRY_RUN) {
    console.log('\nDry run complete. No writes performed.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of smokeTestProducts.rows) {
      await client.query('DELETE FROM products WHERE id = $1', [row.id]);
    }
    console.log(`Deleted ${smokeTestProducts.rows.length} smoke-test products.`);

    const deleteResult = await client.query('DELETE FROM vendors');
    console.log(`Deleted ${deleteResult.rowCount} old vendor rows (cascaded product_vendors + pc_builder_category_vendors; nulled pc_builder_filter_rules vendor columns).`);

    const newVendorIdByName = new Map();
    for (const name of canonicalNames) {
      const r = await client.query('INSERT INTO vendors (vendor_name) VALUES ($1) RETURNING id', [name]);
      newVendorIdByName.set(name, r.rows[0].id);
    }
    console.log(`Created ${newVendorIdByName.size} new vendor rows.`);

    let relinkedProducts = 0;
    for (const row of productVendorRows.rows) {
      const vendorId = newVendorIdByName.get(canonicalize(row.vendor_name));
      await client.query(
        'INSERT INTO product_vendors (product_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [row.product_id, vendorId]
      );
      relinkedProducts++;
    }
    console.log(`Re-linked ${relinkedProducts} product_vendors rows.`);

    let relinkedCategoryVendors = 0;
    for (const row of categoryVendorRows.rows) {
      const vendorId = newVendorIdByName.get(canonicalize(row.vendor_name));
      await client.query(
        'INSERT INTO pc_builder_category_vendors (category_id, vendor_id, display_order) VALUES ($1, $2, $3)',
        [row.category_id, vendorId, row.display_order]
      );
      relinkedCategoryVendors++;
    }
    console.log(`Re-linked ${relinkedCategoryVendors} pc_builder_category_vendors rows.`);

    let relinkedRules = 0;
    for (const row of filterRuleRows.rows) {
      const selectedId = row.selected_vendor_name ? newVendorIdByName.get(canonicalize(row.selected_vendor_name)) : null;
      const resultId = row.result_vendor_name ? newVendorIdByName.get(canonicalize(row.result_vendor_name)) : null;
      await client.query(
        'UPDATE pc_builder_filter_rules SET selected_vendor_id = $1, result_vendor_id = $2 WHERE id = $3',
        [selectedId, resultId, row.id]
      );
      relinkedRules++;
    }
    console.log(`Restored vendor references on ${relinkedRules} pc_builder_filter_rules rows.`);

    await client.query('COMMIT');
    console.log('\n=== Vendor rebuild complete ===');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
