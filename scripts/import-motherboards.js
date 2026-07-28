require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const DATA_DIR = path.join(__dirname, '..', 'data', 'Motherboard');
const TXT_FILE = path.join(DATA_DIR, 'Mother Board.txt');
const CATEGORY_NAME = 'Motherboard';
const DEFAULT_STOCK = 10;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ---------- name normalization (matches folder <-> txt-line names) ----------
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

function naturalImageSort(files) {
  return files.sort((a, b) => {
    const na = parseInt((a.match(/(\d+)/) || [])[1], 10);
    const nb = parseInt((b.match(/(\d+)/) || [])[1], 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

function mimeFor(ext) {
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[ext] || 'image/jpeg';
}

// ROG and TUF are ASUS sub-brands; some source names drop the ASUS prefix.
function vendorForMotherboard(name) {
  const n = name.toUpperCase();
  if (n.startsWith('ASUS') || n.startsWith('ROG ') || n.startsWith('TUF ')) return 'ASUS';
  if (n.startsWith('MSI')) return 'MSI';
  if (n.startsWith('GIGABYTE')) return 'GIGABYTE';
  return name.trim().split(/\s+/)[0].toUpperCase();
}

// Dummy price heuristic (no price data provided) — chipset tier -> ballpark AED.
function estimatePrice(name) {
  const n = name.toUpperCase();
  const has = (re) => re.test(n);
  if (has(/TRX50|WRX90|WRX80/)) return 3500;
  if (has(/X870E|Z890/)) return 1600;
  if (has(/X870|Z790|X670E/)) return 1100;
  if (has(/B850|B760|B650E/)) return 650;
  if (has(/B650|B550/)) return 550;
  if (has(/H810|H610|A620/)) return 350;
  return 500;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const current = idx++;
      try {
        results[current] = await worker(items[current], current);
      } catch (err) {
        results[current] = { error: err };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will write to DB + S3)'}`);
  console.log('Loading motherboard names...');
  const txtNames = fs.readFileSync(TXT_FILE, 'utf8')
    .split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim().length > 0);

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const dirByNorm = new Map();
  for (const d of dirNames) dirByNorm.set(normalizeName(d), d);

  const matched = [];
  const unmatched = [];
  for (const name of txtNames) {
    const key = normalizeName(name);
    const dir = dirByNorm.get(key);
    if (dir) matched.push({ name: name.trim(), dir });
    else unmatched.push(name);
  }

  console.log(`Matched ${matched.length}/${txtNames.length} names to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched names (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> vendor / estimated price):');
  for (const m of matched) {
    console.log(`  ${m.name} -> ${vendorForMotherboard(m.name)} / AED ${estimatePrice(m.name)}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No DB or S3 writes performed.');
    await pool.end();
    return;
  }

  // ---------- category (create if missing, reuse if present) ----------
  let categoryId;
  const existingCategory = await pool.query('SELECT id FROM categories WHERE category_name = $1', [CATEGORY_NAME]);
  if (existingCategory.rows.length > 0) {
    categoryId = existingCategory.rows[0].id;
    console.log(`\nUsing existing category "${CATEGORY_NAME}" (${categoryId})`);
  } else {
    const r = await pool.query('INSERT INTO categories (category_name) VALUES ($1) RETURNING id', [CATEGORY_NAME]);
    categoryId = r.rows[0].id;
    console.log(`\nCreated category "${CATEGORY_NAME}" (${categoryId})`);
  }

  // ---------- vendors (create if missing, reuse if present) ----------
  const neededVendorNames = [...new Set(matched.map((m) => vendorForMotherboard(m.name)))];
  const vendorIdByName = new Map();
  for (const vname of neededVendorNames) {
    const existing = await pool.query('SELECT id FROM vendors WHERE UPPER(vendor_name) = $1', [vname.toUpperCase()]);
    if (existing.rows.length > 0) {
      vendorIdByName.set(vname, existing.rows[0].id);
    } else {
      const r = await pool.query('INSERT INTO vendors (vendor_name) VALUES ($1) RETURNING id', [vname]);
      vendorIdByName.set(vname, r.rows[0].id);
      console.log(`Created new vendor "${vname}"`);
    }
  }
  console.log(`Vendors ready: ${[...vendorIdByName.keys()].join(', ')}`);

  // ---------- skip products that already exist (idempotent re-run safety) ----------
  const existingNamesResult = await pool.query(
    `SELECT name FROM products WHERE category_id = $1`,
    [categoryId]
  );
  const existingNames = new Set(existingNamesResult.rows.map((r) => normalizeName(r.name)));
  const toInsert = matched.filter((m) => !existingNames.has(normalizeName(m.name)));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the Motherboard category.`);
  }

  // ---------- insert products with images ----------
  let done = 0;
  let failed = 0;
  let imagesUploaded = 0;
  const failures = [];

  await runPool(toInsert, 6, async (m) => {
    const dirPath = path.join(DATA_DIR, m.dir);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: m.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: m.name, error: 'no valid image files in folder' });
      return;
    }
    files = naturalImageSort(files);

    let mainImageUrl;
    const mediaUrls = [];
    try {
      const mainFile = files[0];
      const mainExt = path.extname(mainFile).toLowerCase();
      const mainBuffer = fs.readFileSync(path.join(dirPath, mainFile));
      mainImageUrl = await uploadMediaToS3(
        { buffer: mainBuffer, mimetype: mimeFor(mainExt), originalname: mainFile },
        'products'
      );
      imagesUploaded++;

      const extraFiles = files.slice(1, 6);
      for (const f of extraFiles) {
        const ext = path.extname(f).toLowerCase();
        const buf = fs.readFileSync(path.join(dirPath, f));
        const url = await uploadMediaToS3(
          { buffer: buf, mimetype: mimeFor(ext), originalname: f },
          'products/media'
        );
        mediaUrls.push(url);
        imagesUploaded++;
      }
    } catch (err) {
      failed++;
      failures.push({ name: m.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const vendorName = vendorForMotherboard(m.name);
    const vendorId = vendorIdByName.get(vendorName);
    const price = estimatePrice(m.name);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status)
         VALUES ($1, $2, $3, $4, $5, 'published')
         RETURNING id`,
        [m.name, categoryId, price, mainImageUrl, DEFAULT_STOCK]
      );
      const productId = productResult.rows[0].id;

      await client.query(
        'INSERT INTO product_vendors (product_id, vendor_id) VALUES ($1, $2)',
        [productId, vendorId]
      );

      for (let i = 0; i < mediaUrls.length; i++) {
        await client.query(
          `INSERT INTO product_media (product_id, url, type, display_order) VALUES ($1, $2, 'image', $3)`,
          [productId, mediaUrls[i], i]
        );
      }

      await client.query('COMMIT');
      done++;
    } catch (err) {
      await client.query('ROLLBACK');
      failed++;
      failures.push({ name: m.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }

    if ((done + failed) % 20 === 0) {
      console.log(`Progress: ${done + failed}/${toInsert.length}`);
    }
  });

  console.log('\n=== Motherboard import complete ===');
  console.log(`Category: ${CATEGORY_NAME} (${categoryId})`);
  console.log(`Products inserted: ${done}`);
  console.log(`Products skipped (already existed): ${skippedExisting}`);
  console.log(`Products failed: ${failed}`);
  console.log(`Images uploaded to S3: ${imagesUploaded}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(` - ${f.name}: ${f.error}`);
  }
  if (unmatched.length > 0) {
    console.log(`\n${unmatched.length} names from Mother Board.txt had no matching image folder — not imported.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
