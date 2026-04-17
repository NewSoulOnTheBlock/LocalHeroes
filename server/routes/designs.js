const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/designs/templates — list starter templates
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const params = [];
    let sql = 'SELECT id, name, category_slug, thumbnail_url, canvas_json FROM design_templates';
    if (category) {
      params.push(category);
      sql += ` WHERE category_slug = $${params.length} OR category_slug IS NULL`;
    }
    sql += ' ORDER BY id';
    const { rows } = await db.query(sql, params);
    res.json(rows.map(r => ({ ...r, canvas_json: JSON.parse(r.canvas_json) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/designs — save a new design
router.post('/', async (req, res) => {
  try {
    const { title, canvas_json, preview_url, template_id, owner_email, application_id, business_id } = req.body;
    if (!canvas_json) return res.status(400).json({ error: 'canvas_json required' });
    const json = typeof canvas_json === 'string' ? canvas_json : JSON.stringify(canvas_json);
    const { rows } = await db.query(
      `INSERT INTO postcard_designs
        (title, canvas_json, preview_url, template_id, owner_email, application_id, business_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
      [title || 'Untitled design', json, preview_url || null,
       template_id || null, owner_email || null,
       application_id || null, business_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/designs/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM postcard_designs WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const d = rows[0];
    try { d.canvas_json = JSON.parse(d.canvas_json); } catch (_) {}
    res.json(d);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/designs/:id — update (design is editable until application approved)
router.put('/:id', async (req, res) => {
  try {
    const { title, canvas_json, preview_url } = req.body;
    const json = canvas_json ? (typeof canvas_json === 'string' ? canvas_json : JSON.stringify(canvas_json)) : null;
    await db.query(
      `UPDATE postcard_designs
       SET title = COALESCE($1, title),
           canvas_json = COALESCE($2, canvas_json),
           preview_url = COALESCE($3, preview_url),
           updated_at = NOW()
       WHERE id = $4`,
      [title || null, json, preview_url || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
