const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/businesses — list businesses, optionally filter by zipcode or category
router.get('/', async (req, res) => {
  try {
    const { zipcode, category, featured } = req.query;

    let query = `
      SELECT b.*, c.name as category_name, c.slug as category_slug, z.zipcode, z.neighborhood
      FROM businesses b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN zipcodes z ON b.zipcode_id = z.id
      WHERE b.active = 1
    `;
    const params = [];

    if (zipcode) {
      params.push(zipcode);
      query += ` AND z.zipcode = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND c.slug = $${params.length}`;
    }
    if (featured === '1') {
      query += ' AND b.featured = 1';
    }

    query += ' ORDER BY b.featured DESC, b.name ASC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/businesses/:id — single business
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.*, c.name as category_name, c.slug as category_slug, z.zipcode, z.neighborhood
      FROM businesses b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN zipcodes z ON b.zipcode_id = z.id
      WHERE b.id = $1
    `, [req.params.id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
