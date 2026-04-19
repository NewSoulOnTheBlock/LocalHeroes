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
app.use('/api/slots', require('./routes/slots'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/territories', require('./routes/territories'));
app.use('/api/blog', require('./routes/blog'));

// Zipcodes public endpoint
const db = require('./db');
app.get('/api/zipcodes', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT z.zipcode, z.neighborhood, z.active,
             z.household_count, z.monthly_price_cents, z.max_slots,
             z.center_lat, z.center_lng,
             COUNT(b.id)::int AS business_count
      FROM zipcodes z
      LEFT JOIN businesses b ON z.id = b.zipcode_id AND b.active = 1
      WHERE z.active = 1
      GROUP BY z.id
      ORDER BY z.zipcode
    `);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Zipcodes as GeoJSON FeatureCollection (point features with metadata)
app.get('/api/zipcodes/geojson', async (req, res) => {
  try {
    const month = req.query.month ||
      (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })();
    const { rows } = await db.query(`
      SELECT z.id, z.zipcode, z.neighborhood, z.household_count, z.monthly_price_cents,
             z.max_slots, z.center_lat, z.center_lng,
             (SELECT COUNT(*)::int FROM postcard_slots s
                WHERE s.zipcode_id = z.id AND s.mailing_month = $1) AS slots_claimed
      FROM zipcodes z WHERE z.active = 1 AND z.center_lat IS NOT NULL
    `, [month]);
    const features = rows.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.center_lng, r.center_lat] },
      properties: {
        id: r.id,
        zipcode: r.zipcode,
        neighborhood: r.neighborhood,
        household_count: r.household_count,
        monthly_price_cents: r.monthly_price_cents,
        max_slots: r.max_slots,
        slots_claimed: r.slots_claimed,
        slots_remaining: Math.max(0, (r.max_slots || 6) - r.slots_claimed),
        mailing_month: month
      }
    }));
    res.json({ type: 'FeatureCollection', features });
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
