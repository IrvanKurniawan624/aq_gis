import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_aq_gis',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors());
app.use(express.json());

// Endpoint to get the latest reading for each city
app.get('/api/latest', async (req, res) => {
  try {
    // We get the max measured_on for each city and join to get the full reading
    const query = `
      SELECT 
        c.id as city_id, c.city_name as location_name, c.latitude, c.longitude,
        r.id as reading_id, r.measured_on, 
        ROUND(r.pm10, 1) as pm10, 
        ROUND(r.pm2_5, 1) as pm2_5, 
        ROUND(r.carbon_monoxide, 1) as carbon_monoxide, 
        ROUND(r.nitrogen_dioxide, 1) as nitrogen_dioxide, 
        ROUND(r.sulphur_dioxide, 1) as sulphur_dioxide, 
        ROUND(r.ozone, 1) as ozone, 
        ROUND(r.us_aqi) as us_aqi
      FROM cities c
      JOIN air_quality_readings r ON c.id = r.city_id
      INNER JOIN (
        SELECT city_id, MAX(measured_on) as max_date
        FROM air_quality_readings
        GROUP BY city_id
      ) latest ON r.city_id = latest.city_id AND r.measured_on = latest.max_date
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Database error:", error);
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

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
