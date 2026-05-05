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
