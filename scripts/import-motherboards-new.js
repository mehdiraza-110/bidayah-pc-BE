require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const MD_FILE = path.join(__dirname, '..', 'New-Product-Data-Motherboards.md');
const IMAGES_DIR = path.join(__dirname, '..', 'new-prod-pics', 'Hyper pc 1', 'MB');
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

// ---------- known source-data corrections (verified: physically-impossible chipset/socket/brand
// combos in the sheet — e.g. a "Z790" (Intel) row paired with socket "AM5" — fixed against each
// board's real published spec) ----------
const CORRECTIONS = {
  // Missing closing bracket in the source sheet (the image folder has the same typo, so the
  // folder lookup below still uses the raw/typo'd name).
  'ASUS PRIME B760M-A [DDR4, Wi-Fi': { nameOverride: 'ASUS PRIME B760M-A [DDR4, Wi-Fi]' },
  // Real board is Intel B760 (LGA1700); sheet had it as AMD/AM5.
  'ASUS TUF B760M-PLUS II [DDR5, Wi-Fi]': { brand: 'Intel', socket: 'LGA1700' },
  // Real board is AM5 (AMD B650); sheet had socket LGA1700.
  'GIGABYTE B650M AORUS ELITE EX [DDR5]': { socket: 'AM5' },
  // Real board is Intel Z790 (LGA1700); sheet had it as AMD/AM5.
  'NZXT N7 Z790 White [DDR5, Wi-Fi]': { brand: 'Intel', socket: 'LGA1700' },
  // Real board is Intel Z790 (LGA1700); sheet had it as AMD/AM5.
  'ASUS TUF Z790-BTF GAMING [DDR5, Wi-Fi]': { brand: 'Intel', socket: 'LGA1700' },
  // Name says X670E; sheet's chipset column had it as B650E.
  'MSI MPG X670E CARBON [DDR5, Wi-Fi]': { chipset: 'X670E' },
  // Real board is Intel Z890 (LGA1851); sheet had it as AMD/AM5.
  'ASUS ROG STRIX Z890-E GAMING [DDR5, Wi-Fi]': { brand: 'Intel', socket: 'LGA1851' },
  // Z890 pairs with LGA1851, not LGA1700.
  'MSI MEG Z890 UNIFY-X [DDR5, Wi-Fi]': { socket: 'LGA1851' },
  // Name says W790E (Sapphire Rapids Xeon-W workstation chipset); sheet's chipset column had Z790.
  'ASUS Pro WS W790E SAGE SE [DDR5]': { chipset: 'W790' },
  // WRX90 pairs with socket sTR5 (shared with Threadripper PRO), not AM5.
  'ASUS Pro WS WRX90E-SAGE SE [DDR5]': { socket: 'sTR5' },
};

const FEATURE_KEYS = ['Memory Type', 'Chipset', 'CPU Brand', 'Socket Type', 'Form Factor', 'WiFi'];

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

function vendorForMotherboard(name) {
  return name.trim().split(/\s+/)[0].toUpperCase();
}

function parseMarkdown() {
  const lines = fs.readFileSync(MD_FILE, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const rows = lines.slice(1); // drop header
  return rows.map((line) => {
    const cols = line.split('\t').map((c) => c.trim());
    const [rawName, priceStr, memType, chipset, brand, socket, formFactor, wifi] = cols;
    const correction = CORRECTIONS[rawName] || {};
    return {
      rawName, // used to locate the image folder (matches source sheet + folder names exactly)
      name: correction.nameOverride || rawName,
      price: parsePrice(priceStr),
      memType,
      chipset: correction.chipset || chipset,
      brand: correction.brand || brand,
      socket: correction.socket || socket,
      formFactor: formFactor.replace(/\*$/, ''), // trailing "*" in the sheet just flags E-ATX variants
      wifi,
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
  console.log('Parsing Motherboard data sheet...');
  const boards = parseMarkdown();
  console.log(`Parsed ${boards.length} motherboard rows.`);

  const imgDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const imgDirSet = new Set(imgDirs);

  const matched = [];
  const unmatched = [];
  for (const b of boards) {
    if (imgDirSet.has(b.rawName)) matched.push(b);
    else unmatched.push(b.rawName);
  }
  console.log(`Matched ${matched.length}/${boards.length} motherboards to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> vendor / price / mem / chipset / brand / socket / form / wifi):');
  for (const b of matched) {
    console.log(`  ${b.name} -> ${vendorForMotherboard(b.name)} / AED ${b.price} / ${b.memType} / ${b.chipset} / ${b.brand} / ${b.socket} / ${b.formFactor} / ${b.wifi}`);
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
  const neededVendorNames = [...new Set(matched.map((b) => vendorForMotherboard(b.name)))];
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
  // Dedup by (name, price) rather than name alone: two rows in the sheet legitimately share a
  // name with different prices (kept intentionally per instruction), so name-only dedup would
  // wrongly collapse them.
  const existingResult = await pool.query('SELECT name, price FROM products WHERE category_id = $1', [categoryId]);
  const existingKeys = new Set(existingResult.rows.map((r) => `${normalizeName(r.name)}::${r.price}`));
  const toInsert = matched.filter((b) => !existingKeys.has(`${normalizeName(b.name)}::${b.price.toFixed(2)}`));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the Motherboard category.`);
  }

  // ---------- insert products with images + key features ----------
  let done = 0;
  let failed = 0;
  let imagesUploaded = 0;
  const failures = [];

  await runPool(toInsert, 6, async (b) => {
    const dirPath = path.join(IMAGES_DIR, b.rawName);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: b.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: b.name, error: 'no valid image files in folder' });
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
      failures.push({ name: b.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const vendorId = vendorIdByName.get(vendorForMotherboard(b.name));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status, new_product)
         VALUES ($1, $2, $3, $4, $5, 'published', TRUE)
         RETURNING id`,
        [b.name, categoryId, b.price, mainImageUrl, DEFAULT_STOCK]
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
        ['Memory Type', b.memType],
        ['Chipset', b.chipset],
        ['CPU Brand', b.brand],
        ['Socket Type', b.socket],
        ['Form Factor', b.formFactor],
        ['WiFi', b.wifi],
      ];
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
      failures.push({ name: b.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }

    if ((done + failed) % 10 === 0) {
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
    console.log(`\n${unmatched.length} names from the data sheet had no matching image folder — not imported.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
