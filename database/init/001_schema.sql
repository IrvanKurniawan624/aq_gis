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
