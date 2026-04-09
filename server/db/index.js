const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const DB_DIR = path.join(__dirname, '../../data');
const USE_SQL = !!process.env.DATABASE_URL;

// PostgreSQL Pool (only initialized if DATABASE_URL exists)
let pool = null;
if (USE_SQL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon/Supabase
  });
}

async function ensureDataDir() {
  if (USE_SQL) {
    // Initialize SQL Tables if they don't exist
    try {
      const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('✅ PostgreSQL Schema Verified');
    } catch (err) {
      console.error('❌ SQL Initialization Error:', err.message);
    }
  } else {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      console.log('📁 JSON Storage Initialized');
    } catch (err) {}
  }
}

// Optimized helper for SQL results
const first = result => result.rows[0];
const all = result => result.rows;

async function read(collection) {
  if (USE_SQL) {
    const res = await pool.query(`SELECT * FROM ${collection}`);
    return all(res);
  } else {
    const filePath = path.join(DB_DIR, `${collection}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }
}

async function write(collection, data) {
  if (USE_SQL) {
    // In SQL mode, we usually don't "overwrite" the whole array.
    // However, to keep server logic minimal, we provide a generic table handler
    // But real production apps would use INSERT/UPDATE in the index.js logic.
    // We will handle the CRUD logic in the index.js handlers for SQL mode.
    return; 
  } else {
    const filePath = path.join(DB_DIR, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

// SQL-Specific CRUD Helpers
async function query(text, params) {
  if (!USE_SQL) throw new Error('SQL not enabled');
  return pool.query(text, params);
}

module.exports = { read, write, ensureDataDir, query, USE_SQL };
