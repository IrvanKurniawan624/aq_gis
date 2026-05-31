CREATE TABLE IF NOT EXISTS data_sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  provider VARCHAR(160) NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  frequency VARCHAR(80) NOT NULL,
  resolution VARCHAR(80) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_data_sources_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT NOT NULL AUTO_INCREMENT,
  geoname_id BIGINT NOT NULL,
  city_name VARCHAR(160) NOT NULL,
  country_code CHAR(2) NOT NULL,
  admin1 VARCHAR(80),
  admin2 VARCHAR(80),
  feature_code VARCHAR(80),
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  population INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_geoname_id (geoname_id),
  KEY idx_cities_lat_lon (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS air_quality_readings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  city_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  measured_on DATE NOT NULL,
  frequency VARCHAR(80) NOT NULL DEFAULT 'daily',
  resolution VARCHAR(80) NOT NULL DEFAULT 'modeled_city',
  pm10 DOUBLE,
  pm2_5 DOUBLE,
  carbon_monoxide DOUBLE,
  nitrogen_dioxide DOUBLE,
  sulphur_dioxide DOUBLE,
  ozone DOUBLE,
  aerosol_optical_depth DOUBLE,
  dust DOUBLE,
  uv_index DOUBLE,
  us_aqi DOUBLE,
  european_aqi DOUBLE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_air_quality_city_source_date (city_id, source_id, measured_on),
  KEY idx_air_quality_readings_city_date (city_id, measured_on),
  KEY idx_air_quality_readings_source_date (source_id, measured_on),
  CONSTRAINT fk_air_quality_readings_city
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
  CONSTRAINT fk_air_quality_readings_source
    FOREIGN KEY (source_id) REFERENCES data_sources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Surabaya
INSERT INTO cities (geoname_id, city_name, country_code, admin1, admin2, feature_code, latitude, longitude, population)
VALUES (1625822, 'Surabaya', 'ID', '08', '3578', 'PPLA', -7.24917, 112.75083, 2874314)
ON DUPLICATE KEY UPDATE
  city_name = VALUES(city_name),
  latitude   = VALUES(latitude),
  longitude  = VALUES(longitude);
