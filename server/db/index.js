const fs = require('fs/promises');
const path = require('path');

const DB_DIR = path.join(__dirname, '../../data');

async function ensureDataDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (err) {}
}

async function read(collection) {
  const filePath = path.join(DB_DIR, `${collection}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function write(collection, data) {
  const filePath = path.join(DB_DIR, `${collection}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { read, write, ensureDataDir };
