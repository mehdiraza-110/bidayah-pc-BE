require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const MD_FILE = path.join(__dirname, '..', 'New-Product-Data-Coolers.md');
const IMAGES_DIR = path.join(__dirname, '..', 'new-prod-pics', 'Hyper pc 1', 'Cooler');
const CATEGORY_NAME = 'CPU COOLER';
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

// ---------- Feature data ----------
// Unlike the GPU/CPU/Motherboard/RAM sheets, New-Product-Data-Coolers.md has NO feature columns
// at all — just Product + Price. Every value below (Cooler Type, Radiator/Fan Size, Compatible
// Sockets, RGB, Color) was researched against each model's official manufacturer spec page
// (DeepCool, NZXT, Lian Li, MSI, ASUS, Noctua, Phanteks, Corsair) since it wasn't in the sheet.
//
// Socket-compatibility notes worth knowing when building PC-builder rules on top of this:
// - NOCTUA NH-U14S TR5-SP6 and DX-4677 are single-purpose workstation coolers (sTR5/SP6 only,
//   and LGA4677/LGA4710 only, respectively) — they do NOT fit mainstream desktop sockets.
// - LIAN LI Hydroshift LCD 360R and ASUS ROG RYUO IV SLC only support current-gen sockets
//   (LGA1851/LGA1700/AM5/AM4) — no legacy LGA1200/115x bracket.
// - MSI MEG CORELIQUID S360 additionally supports HEDT sockets (sTRX4, TR4, SP3) that the
//   mainstream MPG CORELIQUID D240 does not.
// - RGB/Color are derived from each product's own name (same method used for the RAM sheet):
//   "RGB"/"ARGB" in the name -> RGB Yes, otherwise No. One correction was needed (see below).
const MAINSTREAM_CURRENT = 'LGA1851, LGA1700, LGA1200, LGA115x, AM5, AM4';
const HEDT_AIR = 'LGA2066, LGA2011-3, LGA2011, LGA1851, LGA1700, LGA1200, LGA115x, AM5, AM4';
const HYDROSHIFT_SOCKETS = 'LGA1851, LGA1700, AM5, AM4';
const MEG_S360_SOCKETS = 'LGA1851, LGA1700, LGA1200, LGA115x, AM5, AM4, sTRX4, TR4, SP3';
const RYUO_IV_SLC_SOCKETS = 'LGA1851, LGA1700, AM5, AM4';
const NOCTUA_TR5_SOCKETS = 'sTR5, SP6';
const NOCTUA_DX_SOCKETS = 'LGA4677, LGA4710';
const PHANTEKS_SOCKETS = 'LGA115x, LGA1200, LGA1700, LGA2011, LGA2011-3, LGA2066, AM4, AM5';
const CORSAIR_H150I_SOCKETS = 'LGA115x, LGA1200, LGA1700, LGA2011, LGA2066, AM4, AM5, sTRX4/sTR4';
const CORSAIR_LINK_SOCKETS = 'LGA1851, LGA1700, LGA1200, LGA1150, LGA1151, LGA1155, LGA1156, AM5, AM4';

const SINGLE_TOWER_120 = 'Single Tower, 120mm fan';
const DUAL_TOWER_120 = 'Dual Tower, 2x120mm fans';
const DUAL_TOWER_140 = 'Dual Tower, 140mm fan';
const DUAL_TOWER_140_120 = 'Dual Tower, 140mm + 120mm fans';
const SINGLE_TOWER_140_PP = 'Single Tower, 140mm fan (dual push/pull)';

// name -> { type, size, sockets, rgb, color }
const FEATURE_DATA = {
  'DeepCool AG400 ARGB Black': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'DeepCool AG400 ARGB White': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'DeepCool AG400 Digital Black': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'DeepCool AG400 Digital White': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'White' },
  'DeepCool AK400 ZERO DARK': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'DeepCool AK400 WH': { type: 'Air', size: SINGLE_TOWER_120, sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'White' },
  'DeepCool AG620 ARGB Black': { type: 'Air', size: DUAL_TOWER_120, sockets: HEDT_AIR, rgb: 'YES', color: 'Black' },
  'DeepCool AG620 ARGB White': { type: 'Air', size: DUAL_TOWER_120, sockets: HEDT_AIR, rgb: 'YES', color: 'White' },
  'DeepCool AK620 ZERO DARK': { type: 'Air', size: DUAL_TOWER_120, sockets: HEDT_AIR, rgb: 'NO', color: 'Black' },
  'DeepCool AK620 WH': { type: 'Air', size: DUAL_TOWER_120, sockets: HEDT_AIR, rgb: 'NO', color: 'White' },
  'DeepCool LE520 RGB White': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'DeepCool LE520 RGB Black': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'DeepCool ASSASSIN 4S': { type: 'Air', size: DUAL_TOWER_140, sockets: HEDT_AIR, rgb: 'NO', color: 'Black' },
  'DeepCool ASSASSIN 4S WH': { type: 'Air', size: DUAL_TOWER_140, sockets: HEDT_AIR, rgb: 'NO', color: 'White' },
  'DeepCool ASSASSIN IV': { type: 'Air', size: DUAL_TOWER_140_120, sockets: HEDT_AIR, rgb: 'NO', color: 'Black' },
  // "LE720" is DeepCool's performance-tier naming, not a 720mm radiator — confirmed via official
  // spec page as a standard 402x120x27mm (3x120mm = 360mm) radiator, same as LE360 V2/LD360.
  'DeepCool LE360 V2 Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'DeepCool LE720 RGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'DeepCool LE720 RGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'DeepCool LD240': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'DeepCool LE360 V2 White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'White' },
  'DeepCool LD360': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'DeepCool Mystique 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'NZXT Kraken 240 RGB Black': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'NZXT Kraken 240 RGB White': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  // Lian Li's newer premium line dropped legacy brackets — current-gen sockets only.
  'LIAN LI Hydroshift LCD 360R Black': { type: 'AIO Liquid', size: '360mm', sockets: HYDROSHIFT_SOCKETS, rgb: 'NO', color: 'Black' },
  'LIAN LI Hydroshift LCD 360R White': { type: 'AIO Liquid', size: '360mm', sockets: HYDROSHIFT_SOCKETS, rgb: 'NO', color: 'White' },
  'MSI MPG CORELIQUID D240': { type: 'AIO Liquid', size: '240mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'ASUS ROG STRIX LC II 360 ARGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'ASUS ROG STRIX LC II 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'LIAN LI Galahad II LCD 360 Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  'LIAN LI Galahad II LCD 360 White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'White' },
  'ASUS ROG Strix LC III 360 ARGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'ASUS ROG Strix LC III 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'NZXT Kraken 360 RGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'NZXT Kraken 360 RGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  // Single-purpose workstation coolers — physically incompatible with any other socket.
  'NOCTUA NH-U14S TR5-SP6': { type: 'Air', size: SINGLE_TOWER_140_PP, sockets: NOCTUA_TR5_SOCKETS, rgb: 'NO', color: 'Brown/Beige' },
  'NOCTUA NH-U14S DX-4677': { type: 'Air', size: SINGLE_TOWER_140_PP, sockets: NOCTUA_DX_SOCKETS, rgb: 'NO', color: 'Brown/Beige' },
  'PHANTEKS Glacier One 360D30 Black': { type: 'AIO Liquid', size: '360mm', sockets: PHANTEKS_SOCKETS, rgb: 'NO', color: 'Black' },
  'PHANTEKS Glacier One 360D30 White': { type: 'AIO Liquid', size: '360mm', sockets: PHANTEKS_SOCKETS, rgb: 'NO', color: 'White' },
  'Corsair iCUE H150i Elite LCD XT Black': { type: 'AIO Liquid', size: '360mm', sockets: CORSAIR_H150I_SOCKETS, rgb: 'NO', color: 'Black' },
  'Corsair iCUE H150i Elite LCD XT White': { type: 'AIO Liquid', size: '360mm', sockets: CORSAIR_H150I_SOCKETS, rgb: 'NO', color: 'White' },
  'ASUS ROG RYUO III 360 ARGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'ASUS ROG RYUO III 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'ASUS ProArt LC 360': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  // MEG tier additionally supports HEDT/workstation sockets the mainstream MPG D240 doesn't.
  'MSI MEG CORELIQUID S360': { type: 'AIO Liquid', size: '360mm', sockets: MEG_S360_SOCKETS, rgb: 'NO', color: 'Black' },
  'NZXT Kraken Elite 360 RGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'NZXT Kraken Elite 360 RGB Black V2': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'ASUS ROG RYUJIN III 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  // Every Kraken Elite SKU ships with an RGB LCD pump — this row's name just omitted "RGB"
  // unlike its two siblings above; corrected for consistency.
  'NZXT Kraken Elite 360 White V2': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'White' },
  'Corsair iCUE LINK H150i RGB LCD Black': { type: 'AIO Liquid', size: '360mm', sockets: CORSAIR_LINK_SOCKETS, rgb: 'YES', color: 'Black' },
  'ASUS ROG RYUJIN III 360 ARGB Black': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'ASUS ProArt LC 420': { type: 'AIO Liquid', size: '420mm', sockets: MAINSTREAM_CURRENT, rgb: 'NO', color: 'Black' },
  // "Extreme" upgrades the fans/pump/LCD, not the radiator — confirmed identical 360mm size to
  // the standard RYUJIN III on ASUS's own spec page.
  'ASUS ROG RYUJIN III 360 ARGB Black Extreme': { type: 'AIO Liquid', size: '360mm', sockets: MAINSTREAM_CURRENT, rgb: 'YES', color: 'Black' },
  'Corsair iCUE LINK H150i RGB LCD White': { type: 'AIO Liquid', size: '360mm', sockets: CORSAIR_LINK_SOCKETS, rgb: 'YES', color: 'White' },
  // "SLC" variant's official ASUS spec page lists only current-gen sockets — no LGA1200/115x
  // bracket, unlike the standard (non-SLC) RYUO IV.
  'ASUS ROG RYUO IV SLC 360 ARGB Black': { type: 'AIO Liquid', size: '360mm', sockets: RYUO_IV_SLC_SOCKETS, rgb: 'YES', color: 'Black' },
  'ASUS ROG RYUO IV SLC 360 ARGB White': { type: 'AIO Liquid', size: '360mm', sockets: RYUO_IV_SLC_SOCKETS, rgb: 'YES', color: 'White' },
};

const FEATURE_KEYS = ['Cooler Type', 'Radiator/Fan Size', 'Compatible Sockets', 'RGB', 'Color'];

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

function vendorForCooler(name) {
  if (/^LIAN LI/i.test(name)) return 'LIAN LI';
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
    const [rawName, priceStr] = cols;
    const features = FEATURE_DATA[rawName];
    if (!features) {
      throw new Error(`No researched feature data for "${rawName}" — add it to FEATURE_DATA before running.`);
    }
    return {
      rawName,
      name: rawName,
      price: parsePrice(priceStr),
      ...features,
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
  console.log('Parsing Cooler data sheet...');
  const coolers = parseMarkdown();
  console.log(`Parsed ${coolers.length} cooler rows.`);

  const imgDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const imgDirSet = new Set(imgDirs);

  const matched = [];
  const unmatched = [];
  for (const c of coolers) {
    if (imgDirSet.has(c.rawName)) matched.push(c);
    else unmatched.push(c.rawName);
  }
  console.log(`Matched ${matched.length}/${coolers.length} coolers to image folders.`);
  if (unmatched.length) {
    console.log('Unmatched (no image folder found):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }

  console.log('\nPreview (name -> vendor / price / type / size / rgb / color):');
  for (const c of matched) {
    console.log(`  ${c.name} -> ${vendorForCooler(c.name)} / AED ${c.price} / ${c.type} / ${c.size} / ${c.rgb} / ${c.color}`);
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
  const neededVendorNames = [...new Set(matched.map((c) => vendorForCooler(c.name)))];
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
  const toInsert = matched.filter((c) => !existingNames.has(normalizeName(c.name)));
  const skippedExisting = matched.length - toInsert.length;
  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} products that already exist in the CPU COOLER category.`);
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

    const vendorId = vendorIdByName.get(vendorForCooler(c.name));

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
        ['Cooler Type', c.type],
        ['Radiator/Fan Size', c.size],
        ['Compatible Sockets', c.sockets],
        ['RGB', c.rgb],
        ['Color', c.color],
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

  console.log('\n=== Cooler import complete ===');
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
