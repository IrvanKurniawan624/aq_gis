import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fetchOpenMeteo from './adapters/open-meteo.js';
import fetchGoogleAQ from './adapters/google-aq.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const SURABAYA_GEONAME_ID = 1625822;
const DEFAULT_FETCH_INTERVAL_HOURS = 1;
const DEFAULT_KECAMATAN_RETENTION_DAYS = 30;
const TIMEZONE = 'Asia/Jakarta';
const KECAMATAN_ROLLUP_SOURCE = {
  name: 'kecamatan_rollup',
  provider: 'Internal',
  source_type: 'aggregate',
  frequency: 'daily',
  resolution: 'city_avg',
};
const API_SOURCES = [
  {
    name: 'open_meteo_current',
    provider: 'Open-Meteo',
    source_type: 'api',
    frequency: 'hourly',
    resolution: 'modeled_city',
    fetcher: fetchOpenMeteo,
  },
  {
    name: 'google_aq_current',
    provider: 'Google',
    source_type: 'api',
    frequency: 'hourly',
    resolution: 'realtime',
    fetcher: fetchGoogleAQ,
  },
];

// MySQL Connection Pool
// DB_SOCKET takes precedence over DB_HOST/DB_PORT (used for Cloud SQL Unix socket on Cloud Run)
const poolConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_aq_gis',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
};

if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = Number.parseInt(process.env.DB_PORT || '3306', 10);
}

const pool = mysql.createPool(poolConfig);

app.use(cors());
app.use(express.json());

let surabayaCityId = null;
let kecamatanRows = null;

function getFetchIntervalMs() {
  const intervalHours = Number.parseFloat(
    process.env.FETCH_INTERVAL_HOURS || `${DEFAULT_FETCH_INTERVAL_HOURS}`,
  );
  const safeIntervalHours = Number.isFinite(intervalHours) && intervalHours > 0
    ? intervalHours
    : DEFAULT_FETCH_INTERVAL_HOURS;

  return safeIntervalHours * 60 * 60 * 1000;
}

function getRetentionDays() {
  const retentionDays = Number.parseInt(
    process.env.KECAMATAN_RETENTION_DAYS || `${DEFAULT_KECAMATAN_RETENTION_DAYS}`,
    10,
  );

  return Number.isFinite(retentionDays) && retentionDays > 0
    ? retentionDays
    : DEFAULT_KECAMATAN_RETENTION_DAYS;
}

function getJakartaDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const date = new Date(Date.UTC(
    Number.parseInt(dateParts.year, 10),
    Number.parseInt(dateParts.month, 10) - 1,
    Number.parseInt(dateParts.day, 10) + offsetDays,
  ));

  return date.toISOString().slice(0, 10);
}

async function getSurabayaCityId() {
  if (surabayaCityId) {
    return surabayaCityId;
  }

  const [rows] = await pool.execute(
    'SELECT id FROM cities WHERE geoname_id = ? LIMIT 1',
    [SURABAYA_GEONAME_ID],
  );

  if (rows.length === 0) {
    throw new Error(`City not found for geoname_id ${SURABAYA_GEONAME_ID}`);
  }

  surabayaCityId = rows[0].id;
  return surabayaCityId;
}

async function ensureDataSource(source) {
  await pool.execute(
    `
      INSERT IGNORE INTO data_sources
        (name, provider, source_type, frequency, resolution)
      VALUES (?, ?, ?, ?, ?)
    `,
    [source.name, source.provider, source.source_type, source.frequency, source.resolution],
  );

  const [rows] = await pool.execute(
    'SELECT id FROM data_sources WHERE name = ? LIMIT 1',
    [source.name],
  );

  if (rows.length === 0) {
    throw new Error(`Data source not found after insert: ${source.name}`);
  }

  return rows[0].id;
}

async function upsertReading(cityId, source, reading) {
  const sourceId = await ensureDataSource(source);

  await pool.execute(
    `
      INSERT INTO air_quality_readings (
        city_id,
        source_id,
        measured_on,
        frequency,
        resolution,
        pm10,
        pm2_5,
        carbon_monoxide,
        nitrogen_dioxide,
        sulphur_dioxide,
        ozone,
        aerosol_optical_depth,
        dust,
        uv_index,
        us_aqi,
        european_aqi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        frequency = VALUES(frequency),
        resolution = VALUES(resolution),
        pm10 = VALUES(pm10),
        pm2_5 = VALUES(pm2_5),
        carbon_monoxide = VALUES(carbon_monoxide),
        nitrogen_dioxide = VALUES(nitrogen_dioxide),
        sulphur_dioxide = VALUES(sulphur_dioxide),
        ozone = VALUES(ozone),
        aerosol_optical_depth = VALUES(aerosol_optical_depth),
        dust = VALUES(dust),
        uv_index = VALUES(uv_index),
        us_aqi = VALUES(us_aqi),
        european_aqi = VALUES(european_aqi)
    `,
    [
      cityId,
      sourceId,
      reading.measured_on,
      source.frequency,
      source.resolution,
      reading.pm10,
      reading.pm2_5,
      reading.carbon_monoxide,
      reading.nitrogen_dioxide,
      reading.sulphur_dioxide,
      reading.ozone,
      reading.aerosol_optical_depth,
      reading.dust,
      reading.uv_index,
      reading.us_aqi,
      reading.european_aqi,
    ],
  );
}

async function runSchedulerTick() {
  const summary = {
    upserted: [],
    skipped: [],
    failed: [],
  };

  let cityId;

  try {
    cityId = await getSurabayaCityId();
  } catch (error) {
    console.error('[scheduler] city lookup failed:', error);
    summary.failed.push({
      source: 'cities',
      error: error.message,
    });
    return summary;
  }

  const fetchResults = await Promise.allSettled(
    API_SOURCES.map((source) => source.fetcher()),
  );

  for (const [index, result] of fetchResults.entries()) {
    const source = API_SOURCES[index];

    if (result.status === 'rejected') {
      console.error(`[scheduler] ${source.name} fetch failed:`, result.reason);
      summary.failed.push({
        source: source.name,
        error: result.reason?.message || 'fetch failed',
      });
      continue;
    }

    if (!result.value) {
      console.warn(`[scheduler] ${source.name} skipped: no reading returned`);
      summary.skipped.push(source.name);
      continue;
    }

    try {
      await upsertReading(cityId, source, result.value);
      console.log(`[scheduler] ${source.name} upserted for ${result.value.measured_on}`);
      summary.upserted.push(source.name);
    } catch (error) {
      console.error(`[scheduler] ${source.name} upsert failed:`, error);
      summary.failed.push({
        source: source.name,
        error: error.message,
      });
    }
  }

  return summary;
}

async function getKecamatanRows() {
  if (kecamatanRows) {
    return kecamatanRows;
  }

  const [rows] = await pool.execute(
    `
      SELECT id, name, centroid_lat, centroid_lon
      FROM kecamatan
      ORDER BY name ASC
    `,
  );

  kecamatanRows = rows;
  return kecamatanRows;
}

async function upsertKecamatanReading(kecamatanId, reading) {
  await pool.execute(
    `
      INSERT INTO kecamatan_readings (
        kecamatan_id,
        measured_on,
        us_aqi,
        pm2_5,
        pm10,
        nitrogen_dioxide,
        ozone,
        sulphur_dioxide,
        carbon_monoxide,
        aerosol_optical_depth,
        dust,
        uv_index,
        european_aqi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        us_aqi = VALUES(us_aqi),
        pm2_5 = VALUES(pm2_5),
        pm10 = VALUES(pm10),
        nitrogen_dioxide = VALUES(nitrogen_dioxide),
        ozone = VALUES(ozone),
        sulphur_dioxide = VALUES(sulphur_dioxide),
        carbon_monoxide = VALUES(carbon_monoxide),
        aerosol_optical_depth = VALUES(aerosol_optical_depth),
        dust = VALUES(dust),
        uv_index = VALUES(uv_index),
        european_aqi = VALUES(european_aqi)
    `,
    [
      kecamatanId,
      reading.measured_on,
      reading.us_aqi,
      reading.pm2_5,
      reading.pm10,
      reading.nitrogen_dioxide,
      reading.ozone,
      reading.sulphur_dioxide,
      reading.carbon_monoxide,
      reading.aerosol_optical_depth,
      reading.dust,
      reading.uv_index,
      reading.european_aqi,
    ],
  );
}

async function runKecamatanTick() {
  const summary = {
    upserted: [],
    skipped: [],
    failed: [],
  };

  if (!process.env.GOOGLE_AQ_API_KEY) {
    return summary;
  }

  let districts;

  try {
    districts = await getKecamatanRows();
  } catch (error) {
    console.error('[scheduler:kecamatan] district lookup failed:', error);
    summary.failed.push({
      source: 'kecamatan',
      error: error.message,
    });
    return summary;
  }

  const fetchResults = await Promise.allSettled(
    districts.map((district) => fetchGoogleAQ({
      latitude: district.centroid_lat,
      longitude: district.centroid_lon,
    })),
  );

  for (const [index, result] of fetchResults.entries()) {
    const district = districts[index];

    if (result.status === 'rejected') {
      console.error(`[scheduler:kecamatan] ${district.name} fetch failed:`, result.reason);
      summary.failed.push({
        kecamatan: district.name,
        error: result.reason?.message || 'fetch failed',
      });
      continue;
    }

    if (!result.value) {
      summary.skipped.push(district.name);
      continue;
    }

    try {
      await upsertKecamatanReading(district.id, result.value);
      console.log(`[scheduler:kecamatan] ${district.name} upserted for ${result.value.measured_on}`);
      summary.upserted.push(district.name);
    } catch (error) {
      console.error(`[scheduler:kecamatan] ${district.name} upsert failed:`, error);
      summary.failed.push({
        kecamatan: district.name,
        error: error.message,
      });
    }
  }

  return summary;
}

async function runRetentionPruner() {
  const summary = {
    rolledUpDates: 0,
    deletedRows: 0,
    failed: null,
  };

  try {
    const retentionDays = getRetentionDays();
    const cutoffDate = getJakartaDate(-retentionDays);
    const cityId = await getSurabayaCityId();

    await ensureDataSource(KECAMATAN_ROLLUP_SOURCE);

    const [dates] = await pool.execute(
      `
        SELECT DISTINCT measured_on
        FROM kecamatan_readings
        WHERE measured_on < ?
        ORDER BY measured_on ASC
      `,
      [cutoffDate],
    );

    for (const row of dates) {
      const measuredOn = row.measured_on;
      const [averages] = await pool.execute(
        `
          SELECT
            AVG(pm10) as pm10,
            AVG(pm2_5) as pm2_5,
            AVG(carbon_monoxide) as carbon_monoxide,
            AVG(nitrogen_dioxide) as nitrogen_dioxide,
            AVG(sulphur_dioxide) as sulphur_dioxide,
            AVG(ozone) as ozone,
            AVG(aerosol_optical_depth) as aerosol_optical_depth,
            AVG(dust) as dust,
            AVG(uv_index) as uv_index,
            AVG(us_aqi) as us_aqi,
            AVG(european_aqi) as european_aqi
          FROM kecamatan_readings
          WHERE measured_on = ?
        `,
        [measuredOn],
      );

      await upsertReading(cityId, KECAMATAN_ROLLUP_SOURCE, {
        measured_on: measuredOn,
        pm10: averages[0].pm10,
        pm2_5: averages[0].pm2_5,
        carbon_monoxide: averages[0].carbon_monoxide,
        nitrogen_dioxide: averages[0].nitrogen_dioxide,
        sulphur_dioxide: averages[0].sulphur_dioxide,
        ozone: averages[0].ozone,
        aerosol_optical_depth: averages[0].aerosol_optical_depth,
        dust: averages[0].dust,
        uv_index: averages[0].uv_index,
        us_aqi: averages[0].us_aqi,
        european_aqi: averages[0].european_aqi,
      });

      summary.rolledUpDates += 1;
    }

    const [deleteResult] = await pool.execute(
      'DELETE FROM kecamatan_readings WHERE measured_on < ?',
      [cutoffDate],
    );

    summary.deletedRows = deleteResult.affectedRows;
    console.log(
      `[retention] rolled up ${summary.rolledUpDates} dates, deleted ${summary.deletedRows} rows from kecamatan_readings`,
    );
  } catch (error) {
    console.error('[retention] pruner failed:', error);
    summary.failed = error.message;
  }

  return summary;
}

async function runAllSchedulerTicks() {
  const [city, kecamatan] = await Promise.all([
    runSchedulerTick(),
    runKecamatanTick(),
  ]);
  const retention = await runRetentionPruner();

  return { city, kecamatan, retention };
}

function startScheduler() {
  const intervalMs = getFetchIntervalMs();
  const intervalHours = intervalMs / 60 / 60 / 1000;

  console.log(`[scheduler] running every ${intervalHours} hour(s)`);
  void runAllSchedulerTicks();
  setInterval(() => {
    void runAllSchedulerTicks();
  }, intervalMs);
}

app.get('/api/config', (req, res) => {
  res.json({
    hasGoogleAQ: Boolean(process.env.GOOGLE_AQ_API_KEY),
  });
});

app.get('/api/tiles/:mapType/:z/:x/:y', async (req, res) => {
  const apiKey = process.env.GOOGLE_AQ_API_KEY;

  if (!apiKey) {
    return res.status(404).json({ error: 'Google Air Quality API key is not configured' });
  }

  const { mapType, z, x, y } = req.params;
  const tileUrl = `https://airquality.googleapis.com/v1/mapTypes/${encodeURIComponent(mapType)}/heatmapTiles/${encodeURIComponent(z)}/${encodeURIComponent(x)}/${encodeURIComponent(y)}?key=${encodeURIComponent(apiKey)}`;

  try {
    const tileResponse = await fetch(tileUrl);

    if (!tileResponse.ok) {
      return res.status(tileResponse.status).json({ error: 'Google Air Quality tile request failed' });
    }

    const tileBuffer = Buffer.from(await tileResponse.arrayBuffer());
    res.set('Content-Type', tileResponse.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(tileBuffer);
  } catch (error) {
    console.error('[tiles] Google Air Quality tile proxy failed:', error);
    return res.status(502).json({ error: 'Google Air Quality tile proxy failed' });
  }
});

// Endpoint to get the latest reading for each city
app.get('/api/latest', async (req, res) => {
  try {
    const query = `
      SELECT 
        city_id,
        location_name,
        latitude,
        longitude,
        reading_id,
        source_id,
        source_name,
        source_provider,
        measured_on,
        pm10,
        pm2_5,
        carbon_monoxide,
        nitrogen_dioxide,
        sulphur_dioxide,
        ozone,
        aerosol_optical_depth,
        dust,
        uv_index,
        us_aqi,
        european_aqi
      FROM (
        SELECT
          c.id as city_id,
          c.city_name as location_name,
          c.latitude,
          c.longitude,
          r.id as reading_id,
          r.source_id,
          ds.name as source_name,
          ds.provider as source_provider,
          r.measured_on,
          ROUND(r.pm10, 1) as pm10,
          ROUND(r.pm2_5, 1) as pm2_5,
          ROUND(r.carbon_monoxide, 1) as carbon_monoxide,
          ROUND(r.nitrogen_dioxide, 1) as nitrogen_dioxide,
          ROUND(r.sulphur_dioxide, 1) as sulphur_dioxide,
          ROUND(r.ozone, 1) as ozone,
          ROUND(r.aerosol_optical_depth, 3) as aerosol_optical_depth,
          ROUND(r.dust, 1) as dust,
          ROUND(r.uv_index, 1) as uv_index,
          ROUND(r.us_aqi) as us_aqi,
          ROUND(r.european_aqi) as european_aqi,
          ROW_NUMBER() OVER (
            PARTITION BY c.id
            ORDER BY r.measured_on DESC, r.id DESC
          ) as row_rank
        FROM cities c
        JOIN air_quality_readings r ON c.id = r.city_id
        JOIN data_sources ds ON ds.id = r.source_id
      ) ranked
      WHERE row_rank = 1
      ORDER BY location_name ASC
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/admin/refresh', async (req, res) => {
  const summary = await runAllSchedulerTicks();
  res.json(summary);
});

app.get('/api/kecamatan/latest', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          k.id,
          k.name,
          k.centroid_lat,
          k.centroid_lon,
          kr.measured_on,
          kr.us_aqi,
          kr.pm2_5,
          kr.pm10,
          kr.nitrogen_dioxide,
          kr.ozone
        FROM kecamatan k
        LEFT JOIN kecamatan_readings kr ON kr.kecamatan_id = k.id
          AND kr.measured_on = (
            SELECT MAX(measured_on)
            FROM kecamatan_readings
            WHERE kecamatan_id = k.id
          )
        ORDER BY k.name ASC
      `,
    );

    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/kecamatan/history', async (req, res) => {
  try {
    const requestedDays = Number.parseInt(req.query.days, 10);
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? requestedDays
      : getRetentionDays();
    const [rows] = await pool.execute(
      `
        SELECT
          k.name,
          kr.measured_on,
          ROUND(kr.us_aqi) as us_aqi,
          ROUND(kr.pm2_5, 1) as pm2_5,
          ROUND(kr.pm10, 1) as pm10
        FROM kecamatan k
        JOIN kecamatan_readings kr ON kr.kecamatan_id = k.id
        WHERE kr.measured_on >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY kr.measured_on ASC, k.name ASC
      `,
      [days],
    );

    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/history/:city_id', async (req, res) => {
  try {
    const cityId = req.params.city_id;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        id, measured_on, 
        ROUND(pm10, 1) as pm10, 
        ROUND(pm2_5, 1) as pm2_5, 
        ROUND(carbon_monoxide, 1) as carbon_monoxide, 
        ROUND(nitrogen_dioxide, 1) as nitrogen_dioxide, 
        ROUND(sulphur_dioxide, 1) as sulphur_dioxide, 
        ROUND(ozone, 1) as ozone, 
        ROUND(us_aqi) as us_aqi
      FROM air_quality_readings
      WHERE city_id = ?
    `;
    
    const params = [cityId];

    if (start_date && end_date) {
      query += ` AND DATE(measured_on) BETWEEN ? AND ? ORDER BY measured_on ASC LIMIT 30`;
      params.push(start_date, end_date);
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } 
    
    // Default to last 30 days if no specific valid range is provided
    query += ` ORDER BY measured_on DESC LIMIT 30`;
    const finalQuery = `SELECT * FROM (${query}) AS sub ORDER BY measured_on ASC`;
    const [rows] = await pool.query(finalQuery, params);
    res.json(rows);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Serve Vite build in production; dev traffic goes through Vite's own server
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
  startScheduler();
});
