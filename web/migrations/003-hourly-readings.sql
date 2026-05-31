ALTER TABLE air_quality_readings
  MODIFY COLUMN measured_on DATETIME NOT NULL;

ALTER TABLE kecamatan_readings
  MODIFY COLUMN measured_on DATETIME NOT NULL;
