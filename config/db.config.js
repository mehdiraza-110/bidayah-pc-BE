const { Pool } = require("pg");
const env = require("dotenv");
env.config();

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect(() => console.log("✅ Postgres DB Connected!"));

db.on('error', (err) => {
  console.error("❌ DB ERROR:", err);
  process.exit(-1);
});

const query = (command, params) => db.query(command, params);

// Helper function to get a client from the pool for transactions
const getClient = async () => {
  const client = await db.connect();
  return client;
};

module.exports = {
  query,
  getClient,
  pool: db // Export pool for direct access if needed
};
