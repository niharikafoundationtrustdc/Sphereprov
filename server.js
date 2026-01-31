
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Your MySQL password
  database: 'hotelsphere',
  waitForConnections: true,
  connectionLimit: 10,
});

// Generic CRUD endpoints for the Hostel System
app.get('/api/:table', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM ${req.params.table}`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/primary', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM settings WHERE id = 'primary'`);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:table', async (req, res) => {
  try {
    const table = req.params.table;
    const data = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const item of data) {
      const keys = Object.keys(item);
      const values = Object.values(item).map(v => typeof v === 'object' ? JSON.stringify(v) : v);
      
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) 
                   ON DUPLICATE KEY UPDATE ${keys.map(k => `${k}=VALUES(${k})`).join(',')}`;
      
      await pool.query(sql, values);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('HotelSphere Local Bridge running on http://localhost:5000');
});
