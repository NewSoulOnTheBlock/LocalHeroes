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

// Zipcodes public endpoint
const db = require('./db');
app.get('/api/zipcodes', (req, res) => {
  const zips = db.prepare(`
    SELECT z.zipcode, z.neighborhood, z.active, COUNT(b.id) as business_count
    FROM zipcodes z
    LEFT JOIN businesses b ON z.id = b.zipcode_id AND b.active = 1
    WHERE z.active = 1
    GROUP BY z.id
    ORDER BY z.zipcode
  `).all();
  res.json(zips);
});

// Categories public endpoint
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

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
