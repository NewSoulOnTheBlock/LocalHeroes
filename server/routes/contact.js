const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/contact — submit contact form
router.post('/', (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const result = db.prepare(`
    INSERT INTO contact_messages (name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, phone || null, subject || null, message);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Message sent successfully' });
});

module.exports = router;
