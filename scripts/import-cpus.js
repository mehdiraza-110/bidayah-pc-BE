require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const MD_FILE = path.join(__dirname, '..', 'New-Product-Data-CPU.md');
const IMAGES_DIR = path.join(__dirname, '..', 'new-prod-pics', 'Hyper pc 1', 'CPU');
const CATEGORY_NAME = 'CPU';
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

// ---------- known source-data corrections (verified against Intel/AMD official specs) ----------
// The sheet mislabels the "Ultra 5 245K(F)" row's series as "Core Ultra 7" (copy-paste from the
// row below it) — it is a Core Ultra 5. It also marks every non-X3D, non-"F" Ryzen 7000/9000 chip
// as having no integrated graphics; in fact every AM5 Ryzen desktop chip except the true "F"-suffix
// SKUs ships a small RDNA2 iGPU (good for display output, not gaming) — only Threadripper (no iGPU
// ever) and genuine F-suffix parts should read "NO".
const CORRECTIONS = {
  'Intel® Core™ Ultra 5 245K(F) [up to 5.2GHz, 14 cores]': { series: 'Core Ultra 5' },
  'AMD Ryzen 5 9600X [up to 5.4GHz, 6 cores]': { integratedGraphics: 'YES' },
  'AMD Ryzen 7 7700X [up to 5.4GHz, 8 cores]': { integratedGraphics: 'YES' },
  'AMD Ryzen 7 9700X [up to 5.5GHz, 8 cores]': { integratedGraphics: 'YES' },
  'AMD Ryzen 9 9900X [up to 5.6GHz, 12 cores]': { integratedGraphics: 'YES' },
  'AMD Ryzen 9 9950X [up to 5.7GHz, 16 cores]': { integratedGraphics: 'YES' },
  // Source sheet has a typo "CLGA4677" for this row; every other Xeon W in the list (and the
  // real w9-3495X) uses LGA4677.
  'Intel® Xeon™ w9-3495X [up to 4.8GHz, 56 cores]': { socket: 'LGA4677' },
};

// "Socket Type" already exists as a CPU key feature from earlier work — reuse it instead of
// creating a duplicate. The other three are new, matching the sheet's F- columns.
const SOCKET_FEATURE_KEY = 'Socket Type';
const NEW_FEATURE_KEYS = ['CPU Brand', 'Integrated Graphics', 'CPU Series'];

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

function parseMarkdown() {
  const lines = fs.readFileSync(MD_FILE, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const rows = lines.slice(1); // drop header
  return rows.map((line) => {
    const cols = line.split('\t').map((c) => c.trim());
    const [rawName, priceStr, socket, brand, integratedGraphics, series] = cols;
    const correction = CORRECTIONS[rawName] || {};
    return {
      rawName, // matches the source sheet + image folder names exactly
      name: rawName,
      price: parsePrice(priceStr),
      socket: correction.socket || socket,
      brand,
      integratedGraphics: correction.integratedGraphics || integratedGraphics,
      series: correction.series || series,
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
  console.log('Parsing CPU data sheet...');
  const cpus = parseMarkdown();
  console.log(`Parsed ${cpus.length} CPU rows.`);

  const imgDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const imgDirSet = new Set(imgDirs);

  const matched = [];
  const unmatched = [];
  for (const c of cpus) {
    if (imgDirSet.has(c.rawName)) matched.push(c);
    else unmatched.push(c.rawName);
  }
  console.log(`Matched ${matched.length}/${cpus.length} CPUs to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> brand / price / socket / iGPU / series):');
  for (const c of matched) {
    console.log(`  ${c.name} -> ${c.brand} / AED ${c.price} / ${c.socket} / ${c.integratedGraphics} / ${c.series}`);
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
  const neededVendorNames = [...new Set(matched.map((c) => c.brand))];
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

  // ---------- category key features (reuse Socket Type, create the rest if missing) ----------
  const featureIdByKey = new Map();

  const socketFeature = await pool.query(
    'SELECT id FROM category_key_features WHERE category_id = $1 AND feature_key = $2',
    [categoryId, SOCKET_FEATURE_KEY]
  );
  if (socketFeature.rows.length > 0) {
    featureIdByKey.set(SOCKET_FEATURE_KEY, socketFeature.rows[0].id);
    console.log(`Reusing existing category key feature "${SOCKET_FEATURE_KEY}"`);
  } else {
    const r = await pool.query(
      `INSERT INTO category_key_features (category_id, feature_key, display_order) VALUES ($1, $2, 0) RETURNING id`,
      [categoryId, SOCKET_FEATURE_KEY]
    );
    featureIdByKey.set(SOCKET_FEATURE_KEY, r.rows[0].id);
    console.log(`Created category key feature "${SOCKET_FEATURE_KEY}"`);
  }

  const maxOrderResult = await pool.query(
    'SELECT COALESCE(MAX(display_order), -1) as max_order FROM category_key_features WHERE category_id = $1',
    [categoryId]
  );
  let nextOrder = maxOrderResult.rows[0].max_order + 1;

  for (const key of NEW_FEATURE_KEYS) {
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
        [categoryId, key, nextOrder++]
      );
      featureIdByKey.set(key, r.rows[0].id);
      console.log(`Created category key feature "${key}"`);
    }
  }

  // ---------- skip products that already exist (idempotent re-run safety) ----------
  const existingNamesResult = await pool.query('SELECT name FROM products WHERE category_id = $1', [categoryId]);
  const existingNames = new Set(existingNamesResult.rows.map((r) => normalizeName(r.name)));
  const toInsert = matched.filter((c) => !existingNames.has(normalizeName(c.name)));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the CPU category.`);
  }

  // ---------- insert products with images + key features ----------
  let done = 0;
  let failed = 0;
  let imagesUploaded = 0;
  const failures = [];

  await runPool(toInsert, 6, async (c) => {
    const dirPath = path.join(IMAGES_DIR, c.rawName);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: c.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: c.name, error: 'no valid image files in folder' });
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
      failures.push({ name: c.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const vendorId = vendorIdByName.get(c.brand);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status, new_product)
         VALUES ($1, $2, $3, $4, $5, 'published', TRUE)
         RETURNING id`,
        [c.name, categoryId, c.price, mainImageUrl, DEFAULT_STOCK]
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
        [SOCKET_FEATURE_KEY, c.socket],
        ['CPU Brand', c.brand],
        ['Integrated Graphics', c.integratedGraphics],
        ['CPU Series', c.series],
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
      failures.push({ name: c.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }

    if ((done + failed) % 10 === 0) {
      console.log(`Progress: ${done + failed}/${toInsert.length}`);
    }
  });

  console.log('\n=== CPU import complete ===');
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
