require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const MD_FILE = path.join(__dirname, '..', 'Keyboards.md');
const IMAGES_DIR = path.join(__dirname, '..', 'new-prod-pics', 'Hyper pc 1', 'Keyboard');
const CATEGORY_NAME = 'Keyboard';
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

// No F- columns; everything below is parsed from each product's own name (no web lookups):
//   - Layout: the trailing "AR"/"US" in ASUS ROG names (Arabic/US keyboard layout).
//   - Switch Type: HyperX names literally state it after " - " (e.g. "- HyperX Red").
//   - Color: only where a color word appears (the Azoth variants).
//   - Wireless: "Wireless" literally present in the name -> Yes, else No (a real binary
//     attribute, so absence of the word is treated as a meaningful "No" rather than skipped).
const FEATURE_KEYS = ['Layout', 'Switch Type', 'Color', 'Wireless'];

function normalizeName(s) {
  return s
    .normalize('NFKC')
    .toUpperCase()
    .replace(/["'"'_|\\/:*?<>]/g, '_')
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

function parsePrice(priceStr) {
  const digits = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(digits);
}

function vendorForKeyboard(name) {
  return name.trim().split(/\s+/)[0].toUpperCase();
}

function layoutFor(name) {
  const m = name.match(/\b(AR|US)\b/);
  return m ? m[1] : null;
}

function switchTypeFor(name) {
  const m = name.match(/-\s*(HyperX \w+)\s*$/i);
  return m ? m[1] : null;
}

function colorFor(name) {
  const m = name.match(/\b(Black|White)\b/i);
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}` : null;
}

function parseMarkdown() {
  const lines = fs.readFileSync(MD_FILE, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const rows = lines.slice(1); // drop header
  return rows.map((line) => {
    const cols = line.split('\t').map((c) => c.trim());
    const [rawName, priceStr] = cols;
    return {
      rawName,
      name: rawName,
      price: parsePrice(priceStr),
      layout: layoutFor(rawName),
      switchType: switchTypeFor(rawName),
      color: colorFor(rawName),
      wireless: /Wireless/i.test(rawName) ? 'YES' : 'NO',
    };
  });
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
  console.log('Parsing Keyboard data sheet...');
  const keyboards = parseMarkdown();
  console.log(`Parsed ${keyboards.length} keyboard rows.`);

  const imgDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const imgDirSet = new Set(imgDirs);

  const matched = [];
  const unmatched = [];
  for (const k of keyboards) {
    if (imgDirSet.has(k.rawName)) matched.push(k);
    else unmatched.push(k.rawName);
  }
  console.log(`Matched ${matched.length}/${keyboards.length} keyboards to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> vendor / price / layout / switch / color / wireless):');
  for (const k of matched) {
    console.log(`  ${k.name} -> ${vendorForKeyboard(k.name)} / AED ${k.price} / ${k.layout || '-'} / ${k.switchType || '-'} / ${k.color || '-'} / ${k.wireless}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No DB or S3 writes performed.');
    await pool.end();
    return;
  }

  // ---------- category (must already exist) ----------
  const existingCategory = await pool.query('SELECT id FROM categories WHERE category_name = $1', [CATEGORY_NAME]);
  if (existingCategory.rows.length === 0) {
    throw new Error(`Category "${CATEGORY_NAME}" not found. Create it first.`);
  }
  const categoryId = existingCategory.rows[0].id;
  console.log(`\nUsing existing category "${CATEGORY_NAME}" (${categoryId})`);

  // ---------- vendors (create if missing, reuse if present) ----------
  const neededVendorNames = [...new Set(matched.map((k) => vendorForKeyboard(k.name)))];
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

  // ---------- category key features (create if missing, reuse if present) ----------
  const featureIdByKey = new Map();
  for (let i = 0; i < FEATURE_KEYS.length; i++) {
    const key = FEATURE_KEYS[i];
    const existing = await pool.query(
      'SELECT id FROM category_key_features WHERE category_id = $1 AND feature_key = $2',
      [categoryId, key]
    );
    if (existing.rows.length > 0) {
      featureIdByKey.set(key, existing.rows[0].id);
    } else {
      const r = await pool.query(
        `INSERT INTO category_key_features (category_id, feature_key, display_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [categoryId, key, i]
      );
      featureIdByKey.set(key, r.rows[0].id);
      console.log(`Created category key feature "${key}"`);
    }
  }

  // ---------- skip products that already exist (idempotent re-run safety) ----------
  const existingNamesResult = await pool.query('SELECT name FROM products WHERE category_id = $1', [categoryId]);
  const existingNames = new Set(existingNamesResult.rows.map((r) => normalizeName(r.name)));
  const toInsert = matched.filter((k) => !existingNames.has(normalizeName(k.name)));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the Keyboard category.`);
  }

  // ---------- insert products with images + key features ----------
  let done = 0;
  let failed = 0;
  let imagesUploaded = 0;
  const failures = [];

  await runPool(toInsert, 6, async (k) => {
    const dirPath = path.join(IMAGES_DIR, k.rawName);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: k.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: k.name, error: 'no valid image files in folder' });
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
      failures.push({ name: k.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const vendorId = vendorIdByName.get(vendorForKeyboard(k.name));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status, new_product)
         VALUES ($1, $2, $3, $4, $5, 'published', TRUE)
         RETURNING id`,
        [k.name, categoryId, k.price, mainImageUrl, DEFAULT_STOCK]
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

      const featureValues = [
        ['Layout', k.layout],
        ['Switch Type', k.switchType],
        ['Color', k.color],
        ['Wireless', k.wireless],
      ].filter(([, value]) => value != null);
      for (let i = 0; i < featureValues.length; i++) {
        const [key, value] = featureValues[i];
        await client.query(
          `INSERT INTO product_key_features (product_id, category_key_feature_id, feature_value, display_order)
           VALUES ($1, $2, $3, $4)`,
          [productId, featureIdByKey.get(key), value, i]
        );
      }

      await client.query('COMMIT');
      done++;
    } catch (err) {
      await client.query('ROLLBACK');
      failed++;
      failures.push({ name: k.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }
  });

  console.log('\n=== Keyboard import complete ===');
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
    console.log(`\n${unmatched.length} names from the data sheet had no matching image folder — not imported.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
