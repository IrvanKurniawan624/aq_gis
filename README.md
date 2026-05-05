# Surabaya Air Quality GIS Dashboard

A web-based GIS dashboard for monitoring air quality in Surabaya, Indonesia. The map displays mock sensor readings across the city; the history chart pulls real daily data from a local MySQL database (imported from Open-Meteo historical CSV).

## Project Status

| Layer | Status | Notes |
|-------|--------|-------|
| Map view | Working | Mock sensor data (5 locations) |
| History chart | Working | Real data from MySQL, 2022-08-01 – 2026-02-18 |
| Live API ingestion | Planned | AQAir, Google Air Quality, Open-Meteo |

## Tech Stack

- **Frontend** — React 19, Vite, Leaflet / react-leaflet, Recharts, Tailwind CSS
- **Backend** — Node.js, Express 5, MySQL 8 (mysql2)
- **Database** — MySQL 8 (primary), PostgreSQL 16 + PostGIS (optional Docker setup)

## Project Structure

```
aq_gis/
├── data/                        # Source CSV files
│   ├── air_quality_historical.csv
│   ├── city_info.csv
│   └── data_dictionary.csv
├── database/
│   ├── import_air_quality.sql       # PostgreSQL schema + data import
│   ├── import_air_quality_mysql.sql # MySQL schema + data import
│   └── init/                        # Docker PostgreSQL init scripts
├── scripts/
│   └── build-data-json.mjs          # Export CSV → JSON for frontend
├── web/                         # Full-stack web application
│   ├── server.js                    # Express API server
│   ├── src/                         # React frontend
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HistoryChart.jsx
│   │   │   ├── MapView.jsx
│   │   │   └── StatCard.jsx
│   │   └── data/mockApiData.js
│   └── package.json
└── docker-compose.yml           # PostgreSQL/PostGIS (optional)
```

## Quick Start

### 1. MySQL Database

Import the schema and historical data into a local MySQL database:

```powershell
mysql -u root -p db_aq_gis < database\import_air_quality_mysql.sql
```

Or import `database/import_air_quality_mysql.sql` through phpMyAdmin / MySQL Workbench. This file includes all 1,298 historical readings inline so no CSV access is needed.

### 2. Backend API

```powershell
cd web
Copy-Item .env.example .env   # then edit DB credentials
npm install
node server.js
# → http://localhost:3001
```

Default `.env` values (match your MySQL setup):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_aq_gis
PORT=3001
```

### 3. Frontend

```powershell
cd web
npm run dev
# → http://localhost:5173
```

Or run both together:

```powershell
npm run start:full
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/latest` | Latest reading per city |
| GET | `/api/history/:city_id` | Last 30 records for a city (default) |
| GET | `/api/history/:city_id?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` | Filtered by date range (max 30 days) |

## Optional: PostgreSQL / PostGIS (Docker)

If you prefer PostgreSQL or want the PostGIS geometry column:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Manual import into an existing container:

```powershell
Get-Content database\import_air_quality.sql | docker compose exec -T postgres psql -U aq_gis -d aq_gis
```

## Regenerate Frontend JSON

The map can also load data from static JSON files instead of the API:

```powershell
node scripts\build-data-json.mjs
```

Writes `data/air_quality.json` and `data/air_quality.geojson`.

## Roadmap

- [ ] Live data ingestion from **AQAir API**
- [ ] Live data ingestion from **Google Air Quality API**
- [ ] Live data ingestion from **Open-Meteo real-time API**
- [ ] Multiple city support
- [ ] Mobile app (Flutter)
- [ ] Alert thresholds and notifications

## Data Source

Historical Surabaya readings (2022-08-01 – 2026-02-18) from the Open-Meteo Air Quality API, stored as modeled city-level daily aggregates.
