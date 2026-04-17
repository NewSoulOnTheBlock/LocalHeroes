const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/auth', require('./routes/auth'));

// Zipcodes public endpoint
const db = require('./db');
app.get('/api/zipcodes', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT z.zipcode, z.neighborhood, z.active, COUNT(b.id)::int AS business_count
      FROM zipcodes z
      LEFT JOIN businesses b ON z.id = b.zipcode_id AND b.active = 1
      WHERE z.active = 1
      GROUP BY z.id
      ORDER BY z.zipcode
    `);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Categories public endpoint
app.get('/api/categories', async (req, res) => {
  try { res.json((await db.query('SELECT * FROM categories ORDER BY name')).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Initialize DB schema/seed on startup
db.init().then(() => console.log('DB initialized')).catch(err => console.error('DB init error:', err));

// SPA fallback — serve index.html for non-API, non-file routes
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Local Heroes server running at http://localhost:${PORT}`);
});
