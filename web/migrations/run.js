import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(webRoot, '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_aq_gis',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
  multipleStatements: true,
});

try {
  const entries = await fs.readdir(__dirname, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(__dirname, file), 'utf8');
    await pool.query(sql);
    console.log(`[migrations] applied ${file}`);
  }
} finally {
  await pool.end();
}
