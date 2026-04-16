const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/businesses — list businesses, optionally filter by zipcode or category
router.get('/', (req, res) => {
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
    query += ' AND z.zipcode = ?';
    params.push(zipcode);
  }
  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }
  if (featured === '1') {
    query += ' AND b.featured = 1';
  }

  query += ' ORDER BY b.featured DESC, b.name ASC';

  const businesses = db.prepare(query).all(...params);
  res.json(businesses);
});

// GET /api/businesses/:id — single business
router.get('/:id', (req, res) => {
  const business = db.prepare(`
    SELECT b.*, c.name as category_name, c.slug as category_slug, z.zipcode, z.neighborhood
    FROM businesses b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN zipcodes z ON b.zipcode_id = z.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }
  res.json(business);
});

module.exports = router;
