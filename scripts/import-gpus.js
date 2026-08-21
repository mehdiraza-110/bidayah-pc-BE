require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const MD_FILE = path.join(__dirname, '..', 'New-Product-Data-GPUs.md');
const IMAGES_DIR = path.join(__dirname, '..', 'new-prod-pics', 'Hyper pc 1', 'GPU');
const CATEGORY_NAME = 'GPU';
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

// ---------- known source-data corrections (verified against NVIDIA/manufacturer specs) ----------
// The source sheet mislabels memory type for several Ampere/Ada workstation cards as GDDR7
// (they actually ship GDDR6), and mislabels the datacenter A100/H100 as GDDR6 (they use HBM).
// It also copy-pasted the H100's CUDA core count (14592) onto the A100 row; the real A100
// PCIe card has 6912 CUDA cores.
const CORRECTIONS = {
  'NVIDIA Quadro RTX A1000 [8GB, 2304 CUDA]': { vramType: 'GDDR6' },
  'NVIDIA Quadro RTX A2000 [12GB, 3328 CUDA]': { vramType: 'GDDR6' },
  'NVIDIA Quadro RTX A5000 [24GB, 8192 CUDA]': { vramType: 'GDDR6' },
  'NVIDIA Quadro RTX A6000 [48GB, 10752 CUDA]': { vramType: 'GDDR6' },
  'NVIDIA Quadro RTX 6000 Ada Generation [48GB, 18176 CUDA]': { vramType: 'GDDR6' },
  'NVIDIA A100 [80GB, 14592 CUDA]': { vramType: 'HBM2e', nameOverride: 'NVIDIA A100 [80GB, 6912 CUDA]' },
  'NVIDIA H100 [80GB, 14592 CUDA]': { vramType: 'HBM2e' },
};

const FEATURE_KEYS = ['VRAM', 'VRAM Type', 'Recommended PSU'];

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

function vendorForGpu(name) {
  const n = name.toUpperCase();
  if (n.startsWith('NVIDIA')) return 'NVIDIA';
  if (n.startsWith('ASUS')) return 'ASUS';
  if (n.startsWith('MSI')) return 'MSI';
  if (n.startsWith('GIGABYTE')) return 'GIGABYTE';
  if (n.startsWith('PALIT')) return 'Palit';
  if (n.startsWith('ZOTAC')) return 'ZOTAC';
  return name.trim().split(/\s+/)[0].toUpperCase();
}

function parsePrice(priceStr) {
  // "AED 2,000" -> 2000
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
    const [rawName, priceStr, vram, vramType, psu] = cols;
    const correction = CORRECTIONS[rawName] || {};
    return {
      rawName, // used to locate the image folder (matches source sheet + folder names exactly)
      name: correction.nameOverride || rawName,
      price: parsePrice(priceStr),
      vram,
      vramType: correction.vramType || vramType,
      psu,
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
  console.log('Parsing GPU data sheet...');
  const gpus = parseMarkdown();
  console.log(`Parsed ${gpus.length} GPU rows.`);

  const imgDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const imgDirSet = new Set(imgDirs);

  const matched = [];
  const unmatched = [];
  for (const g of gpus) {
    if (imgDirSet.has(g.rawName)) matched.push(g);
    else unmatched.push(g.rawName);
  }
  console.log(`Matched ${matched.length}/${gpus.length} GPUs to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> vendor / price / VRAM / VRAM-Type / PSU):');
  for (const g of matched) {
    console.log(`  ${g.name} -> ${vendorForGpu(g.name)} / AED ${g.price} / ${g.vram} / ${g.vramType} / ${g.psu}`);
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
  const neededVendorNames = [...new Set(matched.map((g) => vendorForGpu(g.name)))];
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
  const toInsert = matched.filter((g) => !existingNames.has(normalizeName(g.name)));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the GPU category.`);
  }

  // ---------- insert products with images + key features ----------
  let done = 0;
  let failed = 0;
  let imagesUploaded = 0;
  const failures = [];

  await runPool(toInsert, 6, async (g) => {
    const dirPath = path.join(IMAGES_DIR, g.rawName);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: g.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: g.name, error: 'no valid image files in folder' });
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
      failures.push({ name: g.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const vendorName = vendorForGpu(g.name);
    const vendorId = vendorIdByName.get(vendorName);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status, new_product)
         VALUES ($1, $2, $3, $4, $5, 'published', TRUE)
         RETURNING id`,
        [g.name, categoryId, g.price, mainImageUrl, DEFAULT_STOCK]
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
        ['VRAM', g.vram],
        ['VRAM Type', g.vramType],
        ['Recommended PSU', g.psu],
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
      failures.push({ name: g.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }

    if ((done + failed) % 10 === 0) {
      console.log(`Progress: ${done + failed}/${toInsert.length}`);
    }
  });

  console.log('\n=== GPU import complete ===');
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
