# Surabaya Air Quality GIS Dashboard

This project is a web-based geographic information system for monitoring air quality in
Surabaya, Indonesia. It combines imported historical data with hourly live ingestion,
provider-specific city summaries, Google Air Quality district estimates, and map-based
visualization.

The application does not present modeled coordinates as physical sensors. Open-Meteo
returns modeled air-quality data for a requested coordinate. Google Air Quality returns
location-based estimates and heatmap tiles. The current integrations do not expose
individual monitoring-station locations.

## Features

- Hourly Surabaya city summaries from Open-Meteo and Google Air Quality.
- Provider selector for comparing Open-Meteo and Google AQ city values.
- Google AQ heatmap tiles for AQI, US AQI, and PM2.5.
- Google AQ district estimates for 31 Surabaya kecamatan centroid coordinates.
- City and district historical charts.
- MySQL persistence with hourly deduplication.
- Thirty-day retention for detailed kecamatan rows.
- Daily city-level rollups before older kecamatan rows are deleted.
- Docker image and Google Cloud Run deployment configuration.

## Data Storage

| Table | Data | Frequency | Retention |
| --- | --- | --- | --- |
| `air_quality_readings` | Imported Open-Meteo city history | Daily | Permanent |
| `air_quality_readings` | Live Open-Meteo city summary | Hourly | Permanent |
| `air_quality_readings` | Live Google AQ city summary | Hourly | Permanent |
| `air_quality_readings` | Rolled-up kecamatan average | Daily | Permanent |
| `kecamatan_readings` | Google AQ values for 31 kecamatan centroids | Hourly | 30 days by default |

Live rows use `Asia/Jakarta` hourly buckets such as `2026-05-31 21:00:00`. Repeated
refreshes within the same hour update the existing row instead of inserting a duplicate.

Google ingestion explicitly requests the `usa_epa` AQI for Indonesia. Google Universal
AQI is not stored as US AQI because the indexes use different scales.

## Data Units

PM2.5 and PM10 values use `ug/m3` for both live providers. Gas concentration values need
additional care:

| Provider | Gas concentration unit |
| --- | --- |
| Open-Meteo | `ug/m3` |
| Google Air Quality | `ppb` |

Do not directly compare or merge cross-provider gas concentration fields without an
explicit unit-conversion policy.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Leaflet, Recharts, Tailwind CSS |
| Backend | Node.js, Express 5 |
| Database | MySQL 8 |
| External APIs | Open-Meteo Air Quality API, Google Air Quality API |
| Deployment | Docker, Google Cloud Build, Google Cloud Run, Cloud SQL, Cloud Scheduler |

## Repository Layout

```text
data/                         Historical source datasets
database/                     Standalone MySQL and PostgreSQL import scripts
deploy/                       Google Cloud deployment configuration
scripts/                      Dataset conversion utilities
web/                          React frontend and Express backend
web/adapters/                 Live provider adapters
web/migrations/               MySQL migrations
web/scripts/                  Database seed utilities
```

## Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- MySQL 8 or Docker Desktop

### Start MySQL with Docker

```powershell
docker compose up -d mysql
```

### Import Historical Data

```powershell
mysql -h 127.0.0.1 -P 3306 -u root db_aq_gis --execute="source database/import_air_quality_mysql.sql"
```

### Configure and Initialize the Web Application

```powershell
cd web
Copy-Item .env.example .env
npm install
node migrations/run.js
node scripts/seed-kecamatan.js
```

Edit `web/.env` and set `GOOGLE_AQ_API_KEY` to enable Google city summaries, Google
district estimates, and Google heatmap tiles. Open-Meteo does not require an API key.

### Run the Application

```powershell
cd web
npm run start:full
```

The frontend runs at `http://localhost:5173`. The Express API runs at
`http://localhost:3001`.

### Run Validation

```powershell
cd web
npm test
npm run lint
npm run build
```

Build the production image from the repository root:

```powershell
docker build -t aq-gis-web:test ./web
```

## API Reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/config` | Enabled providers and refresh interval |
| `GET` | `/api/latest?source=open_meteo_current` | Latest Open-Meteo city summary |
| `GET` | `/api/latest?source=google_aq_current` | Latest Google AQ city summary |
| `GET` | `/api/history/:city_id?source=open_meteo_current` | Open-Meteo city history |
| `GET` | `/api/history/:city_id?source=google_aq_current` | Google AQ city history |
| `GET` | `/api/kecamatan/latest` | Latest Google AQ values for each kecamatan |
| `GET` | `/api/kecamatan/history?days=30` | Recent kecamatan history |
| `GET` | `/api/tiles/:mapType/:z/:x/:y` | Proxied Google AQ heatmap tile |
| `POST` | `/api/admin/refresh` | Run one ingestion and retention cycle |

When `REFRESH_TOKEN` is configured, `/api/admin/refresh` requires the token in the
`X-Refresh-Token` request header. Production deployments require this token.

## Scheduler and Retention

Local development runs a refresh cycle when the backend starts and repeats it every
`FETCH_INTERVAL_HOURS`. The default interval is one hour.

Cloud Run disables the internal interval scheduler because instances can scale to zero.
Use Cloud Scheduler to call `/api/admin/refresh` once per hour.

Detailed kecamatan rows are retained for `KECAMATAN_RETENTION_DAYS`. The default is 30
days. Before older rows are removed, the backend stores a daily Surabaya-level average in
`air_quality_readings` with source `kecamatan_rollup`.

## Cloud Deployment

See [deploy/README.md](deploy/README.md) for the Google Cloud Run deployment procedure.

## Source Documentation

- Open-Meteo Air Quality API: https://open-meteo.com/en/docs/air-quality-api
- Google Air Quality API: https://developers.google.com/maps/documentation/air-quality
- Google AQ current conditions: https://developers.google.com/maps/documentation/air-quality/current-conditions
- Google AQ heatmap tiles: https://developers.google.com/maps/documentation/air-quality/heatmaps
