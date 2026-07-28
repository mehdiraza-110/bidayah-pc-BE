require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, '..', 'data', 'motherboard_new_prices.md');
const CATEGORY_NAME = 'Motherboard';
const MARKUP = 1.18; // new price + 18% of new price
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

function normalizeName(s) {
  return s
    .normalize('NFKC')
    .toUpperCase()
    .replace(/["'“”‘’_|\\/:*?<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/_+/g, '_')
    .replace(/\s*_\s*/g, '_');
}

function parsePriceFile(raw) {
  const lines = raw.split('\n');
  const entries = [];

  for (const line of lines) {
    const match = line.match(/^(.*?)\s+AED\s+([\d,]+)\s*$/);
    if (!match) continue;

    const name = match[1].trim();
    if (!name || name.toUpperCase() === 'PRODUCT') continue;

    const newPrice = parseFloat(match[2].replace(/,/g, ''));
    if (isNaN(newPrice)) continue;

    entries.push({ name, newPrice });
  }

  return entries;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update prices in DB)'}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const entries = parsePriceFile(raw);
  console.log(`Parsed ${entries.length} price entries from ${path.basename(DATA_FILE)}`);

  const categoryResult = await pool.query('SELECT id FROM categories WHERE category_name = $1', [CATEGORY_NAME]);
  if (categoryResult.rows.length === 0) {
    throw new Error(`Category "${CATEGORY_NAME}" not found`);
  }
  const categoryId = categoryResult.rows[0].id;

  const productsResult = await pool.query(
    'SELECT id, name, price FROM products WHERE category_id = $1',
    [categoryId]
  );

  const productByNorm = new Map();
  for (const p of productsResult.rows) {
    productByNorm.set(normalizeName(p.name), p);
  }

  const matched = [];
  const unmatched = [];

  for (const entry of entries) {
    const key = normalizeName(entry.name);
    const product = productByNorm.get(key);
    if (product) {
      const finalPrice = Math.round(entry.newPrice * MARKUP * 100) / 100;
      matched.push({ ...entry, product, finalPrice });
    } else {
      unmatched.push(entry);
    }
  }

  console.log(`\nMatched ${matched.length}/${entries.length} price entries to Motherboard products.`);
  console.log('\nPreview (product -> old price | new base price -> final price with 18% markup):');
  for (const m of matched) {
    console.log(
      `  ${m.product.name} -> AED ${Number(m.product.price).toLocaleString()} | base AED ${m.newPrice.toLocaleString()} -> AED ${m.finalPrice.toLocaleString()}`
    );
  }

  if (unmatched.length > 0) {
    console.log('\nUnmatched entries (no matching product found in Motherboard category):');
    unmatched.forEach((u) => console.log(`  - ${u.name} (AED ${u.newPrice})`));
  }

  const unpricedProducts = productsResult.rows.filter(
    (p) => !matched.some((m) => m.product.id === p.id)
  );
  if (unpricedProducts.length > 0) {
    console.log('\nMotherboard products with NO new price entry (will be left unchanged):');
    unpricedProducts.forEach((p) => console.log(`  - ${p.name}`));
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No DB writes performed.');
    await pool.end();
    return;
  }

  let updated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of matched) {
      await client.query(
        `UPDATE products SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [m.finalPrice, m.product.id]
      );
      updated++;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(`\n=== Price update complete ===`);
  console.log(`Products updated: ${updated}`);
  console.log(`Unmatched entries: ${unmatched.length}`);
  console.log(`Motherboard products left unchanged (no entry): ${unpricedProducts.length}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
