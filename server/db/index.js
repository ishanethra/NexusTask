const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const DB_DIR = path.join(__dirname, '../../data');
const USE_SQL = !!process.env.DATABASE_URL;

// PostgreSQL Pool (only initialized if DATABASE_URL exists)
let pool = null;
if (USE_SQL) {
  console.log('\x1b[32m%s\x1b[0m', '✅ DATABASE MODE: PRODUCTION (PostgreSQL via DATABASE_URL)');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon/Supabase
  });
} else {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ WARNING: DATABASE MODE: DEMO (JSON File - Data will be lost on Render!)');
}

/**
 * @function initializePersistenceLayer
 * @description Validates and prepares the storage medium (SQL or JSON) for active operations.
 */
async function initializePersistenceLayer() {
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

/**
 * @function fetchRegistryData
 * @description Retrieves a categorized collection of records from the active storage layer.
 */
async function fetchRegistryData(collection) {
  if (USE_SQL) {
    const res = await pool.query(`SELECT * FROM ${collection}`);
    return res.rows;
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

/**
 * @function commitToPersistence
 * @description Synchronizes memory-state data with the physical storage medium.
 */
async function commitToPersistence(collection, data) {
  if (USE_SQL) {
    // Transactional SQL logic is handled via atomic queries in the core engine.
    return; 
  } else {
    const filePath = path.join(DB_DIR, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * @function executeSecureSQL
 * @description Executes a parameterized query against the PostgreSQL cluster with security sanitization.
 */
async function executeSecureSQL(text, params) {
  if (!USE_SQL) throw new Error('Persistence Bridge: SQL Mode Inactive');
  return pool.query(text, params);
}

module.exports = { fetchRegistryData, commitToPersistence, initializePersistenceLayer, executeSecureSQL, USE_SQL };
