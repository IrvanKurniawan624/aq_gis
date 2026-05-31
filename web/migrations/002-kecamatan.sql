CREATE TABLE IF NOT EXISTS kecamatan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  centroid_lat DOUBLE NOT NULL,
  centroid_lon DOUBLE NOT NULL,
  UNIQUE KEY uq_kecamatan_name (name)
);

CREATE TABLE IF NOT EXISTS kecamatan_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kecamatan_id INT NOT NULL,
  measured_on DATETIME NOT NULL,
  us_aqi DOUBLE DEFAULT NULL,
  pm2_5 DOUBLE DEFAULT NULL,
  pm10 DOUBLE DEFAULT NULL,
  nitrogen_dioxide DOUBLE DEFAULT NULL,
  ozone DOUBLE DEFAULT NULL,
  sulphur_dioxide DOUBLE DEFAULT NULL,
  carbon_monoxide DOUBLE DEFAULT NULL,
  aerosol_optical_depth DOUBLE DEFAULT NULL,
  dust DOUBLE DEFAULT NULL,
  uv_index DOUBLE DEFAULT NULL,
  european_aqi DOUBLE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kecamatan_date (kecamatan_id, measured_on),
  KEY idx_kecamatan_date (kecamatan_id, measured_on DESC),
  CONSTRAINT fk_kecamatan_readings_kecamatan FOREIGN KEY (kecamatan_id) REFERENCES kecamatan(id)
);
