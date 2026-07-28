require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { uploadMediaToS3 } = require('../utils/s3.util');

const DATA_DIR = path.join(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'product_images');
const DEFAULT_STOCK = 10;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ---------- name normalization (must match the analysis pass) ----------
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

// ---------- dummy price heuristic ----------
function estimatePrice(name, category) {
  const n = name.toUpperCase();
  const has = (re) => re.test(n);

  function capacityGB() {
    let m = n.match(/(\d+(?:\.\d+)?)\s*TB/);
    if (m) return parseFloat(m[1]) * 1024;
    m = n.match(/(\d+)\s*GB/);
    if (m) return parseInt(m[1], 10);
    return null;
  }
  function wattage() {
    const m = n.match(/(\d{3,4})\s*W\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  // GPUs
  if (has(/RTX\s?4090/)) return 6800;
  if (has(/RTX\s?4080\s?SUPER/)) return 4200;
  if (has(/RTX\s?4080/)) return 3600;
  if (has(/RTX\s?4070\s?TI\s?SUPER|4070TI SUPER/)) return 3200;
  if (has(/RTX\s?4070\s?TI|4070TI/)) return 2600;
  if (has(/RTX\s?4070/)) return 2300;
  if (has(/RTX\s?4060\s?TI|4060TI/)) return 1500;
  if (has(/RTX\s?4060/)) return 1100;
  if (has(/RTX\s?3050/)) return 550;
  if (has(/GT\s?730/)) return 280;
  if (has(/GT\s?710/)) return 220;
  if (category === 'GPU') return 900;

  // CPU coolers (checked before actual CPU chips)
  if (has(/COOLER|AIO|LIQUID COOL|AIR COOLER/)) {
    if (has(/420\s?MM/)) return 900;
    if (has(/360\s?MM/)) return has(/NZXT|CORSAIR/) ? 650 : 450;
    if (has(/280\s?MM/)) return 320;
    if (has(/240\s?MM/)) return 260;
    return 130;
  }

  // Actual CPU chips
  if (has(/RYZEN\s?9/)) return 2200;
  if (has(/RYZEN\s?7/)) return 1400;
  if (has(/RYZEN\s?5/)) return 800;
  if (has(/\bI9\b|I9-/)) return 1800;
  if (has(/\bI7\b|I7-/)) return 1100;
  if (has(/\bI5\b|I5-/)) return 700;
  if (has(/\bI3\b|I3 /)) return 200;

  // Motherboards
  if (has(/MOTHERBOARD|MOTHER BOARD/)) {
    if (has(/Z890|X870|X670E|Z790|MAXIMUS/)) return 1100;
    if (has(/B760|B650|B550/)) return 550;
    if (has(/A620|H610/)) return 350;
    return 500;
  }

  // Power supplies
  if (has(/POWER SUPPLY|\bPSU\b/)) {
    const w = wattage();
    let base = w ? Math.round(w * 0.45) : 350;
    if (has(/TITANIUM/)) base += 200;
    else if (has(/PLATINUM/)) base += 120;
    else if (has(/GOLD/)) base += 60;
    return base;
  }

  // Cases
  if (has(/\bCASE\b|CASING|CABINET|MID TOWER|FULL TOWER|MINI-TOWER|MINI TOWER/)) {
    let base = 300;
    if (has(/E-ATX|FULL TOWER/)) base += 150;
    if (has(/TEMPERED GLASS|ARGB|RGB/)) base += 80;
    return base;
  }

  // Fans
  if (has(/\bFAN\b/) && !has(/COOLER/)) return 60;

  // RAM
  if (has(/\bRAM\b|DDR4|DDR5|SODIMM|MEMORY|MEMEORY/)) {
    const gb = capacityGB() || 8;
    let base;
    if (gb >= 64) base = 850;
    else if (gb >= 32) base = 450;
    else if (gb >= 16) base = 220;
    else base = 120;
    if (has(/RGB/)) base += 40;
    if (has(/DDR5/)) base += 30;
    return base;
  }

  // Storage
  if (has(/\bSSD\b|NVME|HDD|HARD DISK|HARD DRIVE/)) {
    const gb = capacityGB() || 500;
    if (has(/HDD|HARD DISK|HARD DRIVE/)) {
      if (gb >= 4096) return 480;
      if (gb >= 3072) return 400;
      if (gb >= 2048) return 300;
      if (gb >= 1024) return 200;
      return 150;
    }
    if (gb >= 2048) return 450;
    if (gb >= 1024) return 250;
    if (gb >= 512) return 150;
    return 90;
  }
  if (has(/ENCLOSURE|DOCKING STATION|DOCK\b/)) return 120;

  // Monitors
  if (category === 'Monitor' || has(/MONITOR/)) {
    let base = 500;
    if (has(/180HZ|170HZ|165HZ/)) base += 250;
    if (has(/QHD|1440/)) base += 150;
    if (has(/CURVED/)) base += 100;
    return base;
  }

  // Keyboards
  if (category === 'Keyboard' || has(/KEYBOARD/)) {
    if (has(/LOGITECH G\d|DUCKY|MECHANICAL|TACTILE|TKL/)) return 380;
    if (has(/WIRELESS|BLUETOOTH/)) return 130;
    return 80;
  }

  // Mouse
  if (category === 'Mouse' || has(/MOUSE/)) {
    if (has(/COMBO/)) return 100;
    if (has(/LOGITECH G\d|GAMING/)) return 280;
    if (has(/MOUSEPAD/)) return 30;
    return 50;
  }

  // Bags
  if (category === 'Bag' || has(/\bBAG\b|BACKPACK/)) return 90;

  // Battery
  if (category === 'Battery' || has(/BATTERY/)) return 180;

  // Adapters / chargers / docks
  if (category === 'Adapter' || has(/ADAPTER|ADATER|CHARGER|CHARGING/)) {
    return has(/DOCK/) ? 350 : 100;
  }

  // Cables
  if (category === 'Cable' || has(/CABLE|PATCH ?CORD/)) {
    if (has(/HDMI|DISPLAYPORT|DISPLAY PORT|\bDP\b/)) return 45;
    if (has(/USB.?C|TYPE-C|TYPE C/)) return 35;
    return 20;
  }

  // Full laptops / desktops / AIOs
  if (category === 'Laptop' && has(/I[3579]-|RYZEN|SSD|DOS|WIN\d|WINDOWS/)) return 1800;

  if (has(/HEADSET/)) return 200;
  if (has(/CARTRIDGE/)) return 60;
  if (has(/ROUTER|WIFI\d|WIRELESS N|WL CARD|PCIE WL/)) return 150;
  if (has(/WEBCAM|CAMERA|CAPTURE CARD|SCANNER/)) return 150;

  const catFallback = {
    Other: 100, Laptop: 300, GPU: 900, CPU: 300, Storage: 150, Cable: 25,
    Memory: 150, Keyboard: 100, Mouse: 60, Monitor: 500, Bag: 90, Battery: 180, Adapter: 100,
  };
  return catFallback[category] || 100;
}

const CATEGORY_NAME_MAP = {
  Cable: 'Cables',
  Memory: 'Ram',
};

// ---------- simple async concurrency pool ----------
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
  console.log('Loading source data...');
  const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'refined_products.json'), 'utf8'));
  const txtNames = fs.readFileSync(path.join(DATA_DIR, 'products.txt'), 'utf8')
    .split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim().length > 0);
  const imgDirs = fs.readdirSync(IMAGES_DIR);

  const jsonByNorm = new Map();
  for (const p of products) jsonByNorm.set(normalizeName(p.name), p);
  const imgByNorm = new Map();
  for (const d of imgDirs) imgByNorm.set(normalizeName(d), d);

  const matched = [];
  for (const orig of txtNames) {
    const key = normalizeName(orig);
    const p = jsonByNorm.get(key);
    const dir = imgByNorm.get(key);
    if (p && dir) matched.push({ product: p, dir });
  }
  console.log(`Matched ${matched.length} products (with JSON entry + image folder) out of ${txtNames.length} in products.txt`);

  // ---------- wipe catalog tables ----------
  console.log('\nWiping catalog tables (products, categories, vendors + dependents)...');
  await pool.query('TRUNCATE TABLE products, categories, vendors RESTART IDENTITY CASCADE');
  console.log('Catalog tables cleared.');

  // ---------- create categories ----------
  const categoryNames = [...new Set(matched.map((m) => CATEGORY_NAME_MAP[m.product.category] || m.product.category))];
  const categoryIdByName = new Map();
  for (const name of categoryNames) {
    const r = await pool.query(
      'INSERT INTO categories (category_name) VALUES ($1) RETURNING id',
      [name]
    );
    categoryIdByName.set(name, r.rows[0].id);
  }
  console.log(`Created ${categoryIdByName.size} categories:`, [...categoryIdByName.keys()].join(', '));

  // ---------- create vendors ----------
  const vendorNameByUpper = new Map();
  for (const m of matched) {
    const key = m.product.vendor.toUpperCase();
    if (!vendorNameByUpper.has(key)) vendorNameByUpper.set(key, m.product.vendor);
  }
  const vendorIdByUpper = new Map();
  for (const [upper, displayName] of vendorNameByUpper) {
    const r = await pool.query(
      'INSERT INTO vendors (vendor_name) VALUES ($1) RETURNING id',
      [displayName]
    );
    vendorIdByUpper.set(upper, r.rows[0].id);
  }
  console.log(`Created ${vendorIdByUpper.size} vendors.`);

  // ---------- insert products with images ----------
  let done = 0;
  let failed = 0;
  let zeroPriceFilled = 0;
  let imagesUploaded = 0;
  let imagesDropped = 0;
  const failures = [];

  await runPool(matched, 6, async (m) => {
    const { product, dir } = m;
    const dirPath = path.join(IMAGES_DIR, dir);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch (err) {
      failed++;
      failures.push({ name: product.name, error: `readdir failed: ${err.message}` });
      return;
    }
    if (files.length === 0) {
      failed++;
      failures.push({ name: product.name, error: 'no valid image files in folder' });
      return;
    }
    files = naturalImageSort(files);

    const droppedHere = Math.max(0, files.length - 6); // 1 main + up to 5 media
    if (droppedHere > 0) imagesDropped += droppedHere;

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
      failures.push({ name: product.name, error: `S3 upload failed: ${err.message}` });
      return;
    }

    const categoryName = CATEGORY_NAME_MAP[product.category] || product.category;
    const categoryId = categoryIdByName.get(categoryName);
    const vendorId = vendorIdByUpper.get(product.vendor.toUpperCase());

    let price = product.price;
    if (!price || price <= 0) {
      price = estimatePrice(product.name, product.category);
      zeroPriceFilled++;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query(
        `INSERT INTO products (name, category_id, price, image, stock, status)
         VALUES ($1, $2, $3, $4, $5, 'published')
         RETURNING id`,
        [product.name, categoryId, price, mainImageUrl, DEFAULT_STOCK]
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
      failures.push({ name: product.name, error: `DB insert failed: ${err.message}` });
    } finally {
      client.release();
    }

    if ((done + failed) % 50 === 0) {
      console.log(`Progress: ${done + failed}/${matched.length} (done=${done}, failed=${failed})`);
    }
  });

  console.log('\n=== Import complete ===');
  console.log(`Products inserted: ${done}`);
  console.log(`Products failed: ${failed}`);
  console.log(`Zero-price products filled with estimated price: ${zeroPriceFilled}`);
  console.log(`Images uploaded to S3: ${imagesUploaded}`);
  console.log(`Images dropped due to 5-media-slot cap: ${imagesDropped}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(` - ${f.name}: ${f.error}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
