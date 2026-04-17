const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/auth');

router.use(adminAuth);

const q = (text, params) => db.query(text, params);

// POST /api/admin/login — auth middleware already validated credentials
router.post('/login', (req, res) => res.json({ success: true }));

// --- Applications ---
router.get('/applications', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let sql = 'SELECT * FROM applications';
    if (status) { params.push(status); sql += ` WHERE status = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    res.json((await q(sql, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/applications/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await q('UPDATE applications SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// --- Businesses ---
router.get('/businesses', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT b.*, c.name AS category_name, z.zipcode, z.neighborhood
      FROM businesses b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN zipcodes   z ON b.zipcode_id  = z.id
      ORDER BY b.created_at DESC`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/businesses', async (req, res) => {
  try {
    const { name, category_id, description, phone, email, website, address, zipcode_id, featured } = req.body;
    if (!name) return res.status(400).json({ error: 'Business name is required' });
    const { rows } = await q(
      `INSERT INTO businesses (name, category_id, description, phone, email, website, address, zipcode_id, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, category_id || null, description || null, phone || null, email || null, website || null, address || null, zipcode_id || null, featured ? 1 : 0]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.put('/businesses/:id', async (req, res) => {
  try {
    const { name, category_id, description, phone, email, website, address, zipcode_id, featured, active } = req.body;
    await q(
      `UPDATE businesses
         SET name=$1, category_id=$2, description=$3, phone=$4, email=$5, website=$6,
             address=$7, zipcode_id=$8, featured=$9, active=$10, updated_at=NOW()
       WHERE id=$11`,
      [name, category_id || null, description || null, phone || null, email || null, website || null,
       address || null, zipcode_id || null, featured ? 1 : 0, active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/businesses/:id', async (req, res) => {
  try { await q('DELETE FROM businesses WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// --- Contact Messages ---
router.get('/messages', async (req, res) => {
  try { res.json((await q('SELECT * FROM contact_messages ORDER BY created_at DESC')).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/messages/:id/read', async (req, res) => {
  try { await q('UPDATE contact_messages SET read = 1 WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// --- Zipcodes ---
router.get('/zipcodes', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT z.*, COUNT(b.id)::int AS business_count
      FROM zipcodes z
      LEFT JOIN businesses b ON z.id = b.zipcode_id AND b.active = 1
      GROUP BY z.id
      ORDER BY z.zipcode`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// --- Categories ---
router.get('/categories', async (req, res) => {
  try { res.json((await q('SELECT * FROM categories ORDER BY name')).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
