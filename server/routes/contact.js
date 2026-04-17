const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/contact — submit contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const { rows } = await db.query(`
      INSERT INTO contact_messages (name, email, phone, subject, message)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [name, email, phone || null, subject || null, message]);

    res.status(201).json({ id: rows[0].id, message: 'Message sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
