
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

// Middleware for External API Authorization
const authorizeExternal = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API Key in x-api-key header' });

  try {
    const [settings] = await pool.query(`SELECT externalApiKey FROM settings WHERE id = 'primary'`);
    if (settings[0] && settings[0].externalApiKey === apiKey) {
      next();
    } else {
      res.status(403).json({ error: 'Invalid API Key' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Authorization error' });
  }
};

// --- Standard Management Endpoints ---
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

// --- External / Third Party Integration Endpoints (Tally Bridge) ---

/**
 * Endpoint for fetching accounting vouchers for Tally
 * Supports date range filtering: /api/external/accounting?start=2024-01-01&end=2024-01-31
 */
app.get('/api/external/accounting', authorizeExternal, async (req, res) => {
  const { start, end } = req.query;
  try {
    let query = `SELECT * FROM transactions`;
    const params = [];

    if (start && end) {
      query += ` WHERE date BETWEEN ? AND ?`;
      params.push(start, end);
    }

    const [rows] = await pool.query(query, params);
    
    // Transform to a Tally-friendly JSON structure if needed
    const tallyVouchers = rows.map(row => ({
      VoucherID: row.id,
      Date: row.date,
      VoucherType: row.type === 'RECEIPT' ? 'Receipt' : 'Payment',
      LedgerName: row.ledger,
      PartyName: row.entityName || 'Cash',
      Amount: row.amount,
      Narration: row.description,
      AccountGroup: row.accountGroup
    }));

    res.json({
      property: "Hotel Sphere Pro Node",
      timestamp: new Date().toISOString(),
      vouchers: tallyVouchers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint for fetching real-time occupancy status for external dashboards
 */
app.get('/api/external/occupancy', authorizeExternal, async (req, res) => {
  try {
    const [rooms] = await pool.query(`SELECT id, number, type, status FROM rooms`);
    const [activeBookings] = await pool.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'ACTIVE'`);
    
    res.json({
      totalRooms: rooms.length,
      activeOccupancy: activeBookings[0].count,
      roomList: rooms
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('HotelSphere Local Bridge running on http://localhost:5000');
  console.log('External API Gateway Active at /api/external/');
});
