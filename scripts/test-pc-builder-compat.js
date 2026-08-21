require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD, port: process.env.DB_PORT,
});
// db.config.js opens its own pool on require; reuse it so the service shares one connection pool.
const svc = require('../services/pcBuilderFilterRule.service');

async function findProduct(namePattern) {
  const r = await pool.query('SELECT id, name, category_id FROM products WHERE name ILIKE $1 LIMIT 1', [`%${namePattern}%`]);
  if (!r.rows.length) throw new Error(`No product matching "${namePattern}"`);
  return r.rows[0];
}
async function categoryId(name) {
  const r = await pool.query('SELECT id FROM categories WHERE category_name = $1', [name]);
  return r.rows[0].id;
}
async function vendorIdOfProduct(productId) {
  const r = await pool.query('SELECT vendor_id FROM product_vendors WHERE product_id = $1 LIMIT 1', [productId]);
  return r.rows[0].vendor_id;
}
async function namesOf(products) {
  return products.map((p) => p.name);
}

async function main() {
  const mbCat = await categoryId('Motherboard');
  const coolerCat = await categoryId('CPU COOLER');
  const psuCat = await categoryId('POWER SUPPLY');

  console.log('=== TEST 1: AM5 Ryzen 5 7500F -> Motherboard (expect ONLY AM5 boards) ===');
  const ryzen = await findProduct('Ryzen 5 7500F');
  const ryzenVendor = await vendorIdOfProduct(ryzen.id);
  const { products: mbForRyzen } = await svc.getProductsForCategorySelection({
    categoryId: mbCat,
    priorSelections: [{ category_id: ryzen.category_id, vendor_id: ryzenVendor, product_id: ryzen.id }],
    status: 'published', limit: 200,
  });
  console.log(`Matched ${mbForRyzen.length} motherboards. Sample:`, (await namesOf(mbForRyzen)).slice(0, 5));
  const badAm5 = mbForRyzen.filter((p) => !p.specs); // placeholder, real check below
  const socketsSeen = new Set();
  for (const p of mbForRyzen) {
    const r = await pool.query(`SELECT pkf.feature_value FROM product_key_features pkf JOIN category_key_features ckf ON ckf.id=pkf.category_key_feature_id WHERE pkf.product_id=$1 AND ckf.feature_key='Socket Type'`, [p.id]);
    if (r.rows[0]) socketsSeen.add(r.rows[0].feature_value);
  }
  console.log('Sockets present in result set (should be ONLY {AM5}):', [...socketsSeen]);

  console.log('\n=== TEST 2: Threadripper 7960X -> Motherboard (expect ONLY sTR5 boards) ===');
  const tr = await findProduct('Threadripper 7960X');
  const trVendor = await vendorIdOfProduct(tr.id);
  const { products: mbForTr } = await svc.getProductsForCategorySelection({
    categoryId: mbCat,
    priorSelections: [{ category_id: tr.category_id, vendor_id: trVendor, product_id: tr.id }],
    status: 'published', limit: 200,
  });
  console.log(`Matched ${mbForTr.length} motherboards:`, await namesOf(mbForTr));

  console.log('\n=== TEST 3: Intel i5-14400 -> Motherboard (expect ONLY LGA1700 boards) ===');
  const intel = await findProduct('i5-14400');
  const intelVendor = await vendorIdOfProduct(intel.id);
  const { products: mbForIntel } = await svc.getProductsForCategorySelection({
    categoryId: mbCat,
    priorSelections: [{ category_id: intel.category_id, vendor_id: intelVendor, product_id: intel.id }],
    status: 'published', limit: 200,
  });
  const intelSockets = new Set();
  for (const p of mbForIntel) {
    const r = await pool.query(`SELECT pkf.feature_value FROM product_key_features pkf JOIN category_key_features ckf ON ckf.id=pkf.category_key_feature_id WHERE pkf.product_id=$1 AND ckf.feature_key='Socket Type'`, [p.id]);
    if (r.rows[0]) intelSockets.add(r.rows[0].feature_value);
  }
  console.log(`Matched ${mbForIntel.length} motherboards. Sockets seen (should be ONLY {LGA1700}):`, [...intelSockets]);

  console.log('\n=== TEST 4: RTX 5090 GameRock (Recommended PSU 1200W) -> PSU (expect ONLY >=1200W) ===');
  const gpu = await findProduct('RTX 5090 GameRock');
  const gpuVendor = await vendorIdOfProduct(gpu.id);
  const { products: psuForGpu } = await svc.getProductsForCategorySelection({
    categoryId: psuCat,
    priorSelections: [{ category_id: gpu.category_id, vendor_id: gpuVendor, product_id: gpu.id }],
    status: 'published', limit: 200,
  });
  console.log(`Matched ${psuForGpu.length} PSUs:`, await namesOf(psuForGpu));

  console.log('\n=== TEST 5: AM5 CPU -> Cooler (expect Noctua TR5-SP6/DX-4677 EXCLUDED) ===');
  const { products: coolersForRyzen } = await svc.getProductsForCategorySelection({
    categoryId: coolerCat,
    priorSelections: [{ category_id: ryzen.category_id, vendor_id: ryzenVendor, product_id: ryzen.id }],
    status: 'published', limit: 200,
  });
  const hasNoctuaWorkstation = coolersForRyzen.some((p) => p.name.includes('TR5-SP6') || p.name.includes('DX-4677'));
  console.log(`Matched ${coolersForRyzen.length} coolers. Noctua workstation coolers incorrectly included?`, hasNoctuaWorkstation);

  console.log('\n=== TEST 6: DDR4-only Motherboard -> RAM (expect ONLY DDR4 kits) ===');
  const ddr4Board = await findProduct('MSI PRO B760M-A [DDR4');
  const ddr4Vendor = await vendorIdOfProduct(ddr4Board.id);
  const ramCat = await categoryId('Ram');
  const { products: ramForDdr4 } = await svc.getProductsForCategorySelection({
    categoryId: ramCat,
    priorSelections: [{ category_id: ddr4Board.category_id, vendor_id: ddr4Vendor, product_id: ddr4Board.id }],
    status: 'published', limit: 200,
  });
  const ramTypes = new Set();
  for (const p of ramForDdr4) {
    const r = await pool.query(`SELECT pkf.feature_value FROM product_key_features pkf JOIN category_key_features ckf ON ckf.id=pkf.category_key_feature_id WHERE pkf.product_id=$1 AND ckf.feature_key='Memory Type'`, [p.id]);
    if (r.rows[0]) ramTypes.add(r.rows[0].feature_value);
  }
  console.log(`Matched ${ramForDdr4.length} RAM kits. Types seen (should be ONLY {DDR4}):`, [...ramTypes]);

  console.log('\n=== TEST 7: Vendor chip narrowing — Motherboard vendors for the Threadripper CPU ===');
  const trVendors = await svc.getVendorsForSelection(mbCat, [{ category_id: tr.category_id, vendor_id: trVendor, product_id: tr.id }]);
  console.log('Motherboard vendor chips shown:', trVendors.map((v) => v.vendor_name));

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
