import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.join(projectRoot, 'data')
const publicDataDir = path.join(projectRoot, 'aq_gis', 'public', 'data')

const numericColumns = new Set([
  'geoname_id',
  'latitude',
  'longitude',
  'population',
  'pm10',
  'pm2_5',
  'carbon_monoxide',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'ozone',
  'aerosol_optical_depth',
  'dust',
  'uv_index',
  'us_aqi',
  'european_aqi',
])

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      field += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1
      }
      row.push(field)
      if (row.some((value) => value !== '')) {
        rows.push(row)
      }
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [headers, ...records] = rows
  return records.map((record) =>
    Object.fromEntries(
      headers.map((header, index) => {
        const rawValue = record[index] ?? ''
        if (rawValue === '') {
          return [header, null]
        }
        if (numericColumns.has(header)) {
          return [header, Number(rawValue)]
        }
        return [header, rawValue]
      }),
    ),
  )
}

async function readCsv(fileName) {
  const text = await fs.readFile(path.join(dataDir, fileName), 'utf8')
  return parseCsv(text)
}

function summarizeReadings(readings) {
  const completeReadings = readings.filter((reading) =>
    Object.entries(reading).some(([key, value]) => key !== 'date' && value !== null),
  )

  return {
    total_days: readings.length,
    days_with_any_measurement: completeReadings.length,
    start_date: readings[0]?.date ?? null,
    end_date: readings.at(-1)?.date ?? null,
    latest: readings.at(-1) ?? null,
  }
}

const [cities, readings, dictionary] = await Promise.all([
  readCsv('city_info.csv'),
  readCsv('air_quality_historical.csv'),
  readCsv('data_dictionary.csv'),
])

const city = cities[0]
const source = {
  name: 'open_meteo_surabaya_historical_daily',
  provider: 'Open-Meteo Air Quality API',
  type: 'modeled',
  frequency: 'daily',
  resolution: 'city_point',
}

const airQuality = {
  metadata: {
    project: 'AQ GIS',
    generated_at: new Date().toISOString(),
    source,
    summary: summarizeReadings(readings),
  },
  city,
  data_dictionary: dictionary,
  readings,
}

const geojson = {
  type: 'FeatureCollection',
  name: 'Surabaya daily air quality readings',
  features: readings.map((reading) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [city.longitude, city.latitude],
    },
    properties: {
      city_name: city.city_name,
      geoname_id: city.geoname_id,
      source: source.name,
      ...reading,
    },
  })),
}

await fs.mkdir(publicDataDir, { recursive: true })

const outputs = [
  [path.join(dataDir, 'air_quality.json'), airQuality],
  [path.join(publicDataDir, 'air_quality.json'), airQuality],
  [path.join(dataDir, 'air_quality.geojson'), geojson],
  [path.join(publicDataDir, 'air_quality.geojson'), geojson],
]

await Promise.all(
  outputs.map(([filePath, value]) =>
    fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'),
  ),
)

console.log(
  `Wrote ${readings.length} readings for ${city.city_name} to ${outputs
    .map(([filePath]) => path.relative(projectRoot, filePath))
    .join(', ')}`,
)
