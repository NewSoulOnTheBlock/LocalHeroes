const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/auth');

// All admin routes require authentication
router.use(adminAuth);

// POST /api/admin/login — verify credentials
router.post('/login', (req, res) => {
  res.json({ success: true });
});

// --- Applications ---

// GET /api/admin/applications
router.get('/applications', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM applications';
  const params = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// PATCH /api/admin/applications/:id
router.patch('/applications/:id', (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// --- Businesses ---

// GET /api/admin/businesses
router.get('/businesses', (req, res) => {
  const businesses = db.prepare(`
    SELECT b.*, c.name as category_name, z.zipcode, z.neighborhood
    FROM businesses b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN zipcodes z ON b.zipcode_id = z.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(businesses);
});

// POST /api/admin/businesses
router.post('/businesses', (req, res) => {
  const { name, category_id, description, phone, email, website, address, zipcode_id, featured } = req.body;
  if (!name) return res.status(400).json({ error: 'Business name is required' });

  const result = db.prepare(`
    INSERT INTO businesses (name, category_id, description, phone, email, website, address, zipcode_id, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, category_id || null, description, phone, email, website, address, zipcode_id || null, featured ? 1 : 0);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/admin/businesses/:id
router.put('/businesses/:id', (req, res) => {
  const { name, category_id, description, phone, email, website, address, zipcode_id, featured, active } = req.body;

  db.prepare(`
    UPDATE businesses
    SET name = ?, category_id = ?, description = ?, phone = ?, email = ?, website = ?, address = ?, zipcode_id = ?, featured = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, category_id || null, description, phone, email, website, address, zipcode_id || null, featured ? 1 : 0, active ? 1 : 0, req.params.id);

  res.json({ success: true });
});

// DELETE /api/admin/businesses/:id
router.delete('/businesses/:id', (req, res) => {
  db.prepare('DELETE FROM businesses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Contact Messages ---

// GET /api/admin/messages
router.get('/messages', (req, res) => {
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
  res.json(messages);
});

// PATCH /api/admin/messages/:id/read
router.patch('/messages/:id/read', (req, res) => {
  db.prepare('UPDATE contact_messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Zipcodes ---

// GET /api/admin/zipcodes
router.get('/zipcodes', (req, res) => {
  const zips = db.prepare(`
    SELECT z.*, COUNT(b.id) as business_count
    FROM zipcodes z
    LEFT JOIN businesses b ON z.id = b.zipcode_id AND b.active = 1
    GROUP BY z.id
    ORDER BY z.zipcode
  `).all();
  res.json(zips);
});

// --- Categories ---

// GET /api/admin/categories
router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

module.exports = router;
