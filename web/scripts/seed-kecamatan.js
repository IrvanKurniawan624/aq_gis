import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const geoJsonPath = path.join(webRoot, 'public', 'data', 'surabaya_kecamatan.json');

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
});

function collectPolygonCoordinates(geometry) {
  if (!geometry) return [];

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat(1);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2);
  }

  return [];
}

function getCentroid(geometry) {
  const coordinates = collectPolygonCoordinates(geometry);

  if (coordinates.length === 0) {
    throw new Error('Feature has no polygon coordinates');
  }

  const totals = coordinates.reduce(
    (sum, [lon, lat]) => ({
      lon: sum.lon + lon,
      lat: sum.lat + lat,
    }),
    { lon: 0, lat: 0 },
  );

  return {
    centroid_lat: totals.lat / coordinates.length,
    centroid_lon: totals.lon / coordinates.length,
  };
}

try {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));

  for (const feature of geoJson.features ?? []) {
    const name = feature.properties?.name;

    if (!name) {
      console.warn('[seed-kecamatan] skipped feature without properties.name');
      continue;
    }

    const centroid = getCentroid(feature.geometry);

    await pool.execute(
      `
        INSERT INTO kecamatan
          (name, centroid_lat, centroid_lon)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          centroid_lat = VALUES(centroid_lat),
          centroid_lon = VALUES(centroid_lon)
      `,
      [name, centroid.centroid_lat, centroid.centroid_lon],
    );

    console.log(`[seed-kecamatan] seeded ${name}`);
  }
} finally {
  await pool.end();
}
