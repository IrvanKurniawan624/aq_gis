\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS data_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  resolution TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  id BIGSERIAL PRIMARY KEY,
  geoname_id BIGINT NOT NULL UNIQUE,
  city_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  admin1 TEXT,
  admin2 TEXT,
  feature_code TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  population INTEGER,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_cities_geom ON cities USING GIST (geom);

CREATE TABLE IF NOT EXISTS air_quality_readings (
  id BIGSERIAL PRIMARY KEY,
  city_id BIGINT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES data_sources(id),
  measured_on DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  resolution TEXT NOT NULL DEFAULT 'modeled_city',
  pm10 DOUBLE PRECISION,
  pm2_5 DOUBLE PRECISION,
  carbon_monoxide DOUBLE PRECISION,
  nitrogen_dioxide DOUBLE PRECISION,
  sulphur_dioxide DOUBLE PRECISION,
  ozone DOUBLE PRECISION,
  aerosol_optical_depth DOUBLE PRECISION,
  dust DOUBLE PRECISION,
  uv_index DOUBLE PRECISION,
  us_aqi DOUBLE PRECISION,
  european_aqi DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, source_id, measured_on)
);

CREATE INDEX IF NOT EXISTS idx_air_quality_readings_city_date
  ON air_quality_readings (city_id, measured_on);

CREATE INDEX IF NOT EXISTS idx_air_quality_readings_source_date
  ON air_quality_readings (source_id, measured_on);

INSERT INTO data_sources (name, provider, source_type, frequency, resolution, notes)
VALUES (
  'open_meteo_surabaya_historical_daily',
  'Open-Meteo Air Quality API',
  'modeled',
  'daily',
  'city_point',
  'Historical modeled Surabaya air quality readings imported from data/air_quality_historical.csv.'
)
ON CONFLICT (name) DO UPDATE
SET provider = EXCLUDED.provider,
    source_type = EXCLUDED.source_type,
    frequency = EXCLUDED.frequency,
    resolution = EXCLUDED.resolution,
    notes = EXCLUDED.notes;

CREATE TEMP TABLE import_cities (
  geoname_id BIGINT,
  city_name TEXT,
  country_code CHAR(2),
  admin1 TEXT,
  admin2 TEXT,
  feature_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  population INTEGER
);

COPY import_cities
FROM '/import/city_info.csv'
WITH (FORMAT csv, HEADER true);

INSERT INTO cities (
  geoname_id,
  city_name,
  country_code,
  admin1,
  admin2,
  feature_code,
  latitude,
  longitude,
  population
)
SELECT
  geoname_id,
  city_name,
  country_code,
  admin1,
  admin2,
  feature_code,
  latitude,
  longitude,
  population
FROM import_cities
ON CONFLICT (geoname_id) DO UPDATE
SET city_name = EXCLUDED.city_name,
    country_code = EXCLUDED.country_code,
    admin1 = EXCLUDED.admin1,
    admin2 = EXCLUDED.admin2,
    feature_code = EXCLUDED.feature_code,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    population = EXCLUDED.population;

CREATE TEMP TABLE import_air_quality (
  measured_on DATE,
  pm10 DOUBLE PRECISION,
  pm2_5 DOUBLE PRECISION,
  carbon_monoxide DOUBLE PRECISION,
  nitrogen_dioxide DOUBLE PRECISION,
  sulphur_dioxide DOUBLE PRECISION,
  ozone DOUBLE PRECISION,
  aerosol_optical_depth DOUBLE PRECISION,
  dust DOUBLE PRECISION,
  uv_index DOUBLE PRECISION,
  us_aqi DOUBLE PRECISION,
  european_aqi DOUBLE PRECISION
);

COPY import_air_quality
FROM '/import/air_quality_historical.csv'
WITH (FORMAT csv, HEADER true, NULL '');

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
SELECT
  c.id,
  ds.id,
  aq.measured_on,
  ds.frequency,
  ds.resolution,
  aq.pm10,
  aq.pm2_5,
  aq.carbon_monoxide,
  aq.nitrogen_dioxide,
  aq.sulphur_dioxide,
  aq.ozone,
  aq.aerosol_optical_depth,
  aq.dust,
  aq.uv_index,
  aq.us_aqi,
  aq.european_aqi
FROM import_air_quality aq
CROSS JOIN cities c
CROSS JOIN data_sources ds
WHERE c.geoname_id = 1625822
  AND ds.name = 'open_meteo_surabaya_historical_daily'
ON CONFLICT (city_id, source_id, measured_on) DO UPDATE
SET frequency = EXCLUDED.frequency,
    resolution = EXCLUDED.resolution,
    pm10 = EXCLUDED.pm10,
    pm2_5 = EXCLUDED.pm2_5,
    carbon_monoxide = EXCLUDED.carbon_monoxide,
    nitrogen_dioxide = EXCLUDED.nitrogen_dioxide,
    sulphur_dioxide = EXCLUDED.sulphur_dioxide,
    ozone = EXCLUDED.ozone,
    aerosol_optical_depth = EXCLUDED.aerosol_optical_depth,
    dust = EXCLUDED.dust,
    uv_index = EXCLUDED.uv_index,
    us_aqi = EXCLUDED.us_aqi,
    european_aqi = EXCLUDED.european_aqi;

CREATE OR REPLACE VIEW air_quality_readings_geo AS
SELECT
  r.id,
  r.measured_on,
  r.frequency,
  r.resolution,
  c.geoname_id,
  c.city_name,
  c.country_code,
  c.latitude,
  c.longitude,
  c.geom,
  ds.name AS source_name,
  ds.provider AS source_provider,
  r.pm10,
  r.pm2_5,
  r.carbon_monoxide,
  r.nitrogen_dioxide,
  r.sulphur_dioxide,
  r.ozone,
  r.aerosol_optical_depth,
  r.dust,
  r.uv_index,
  r.us_aqi,
  r.european_aqi
FROM air_quality_readings r
JOIN cities c ON c.id = r.city_id
JOIN data_sources ds ON ds.id = r.source_id;

CREATE OR REPLACE VIEW latest_air_quality_by_city AS
SELECT DISTINCT ON (geoname_id)
  *
FROM air_quality_readings_geo
ORDER BY geoname_id, measured_on DESC;

SELECT
  COUNT(*) AS imported_readings,
  MIN(measured_on) AS first_date,
  MAX(measured_on) AS last_date
FROM air_quality_readings;
