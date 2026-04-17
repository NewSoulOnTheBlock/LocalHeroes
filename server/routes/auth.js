const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const salesAuth = require('../middleware/sales-auth');

const router = express.Router();
const JWT_SECRET = salesAuth.JWT_SECRET;
const TOKEN_TTL = '30d';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, signup_code } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Optional gated signup: if SALES_SIGNUP_CODE is set, require it
    const requiredCode = process.env.SALES_SIGNUP_CODE;
    if (requiredCode && signup_code !== requiredCode) {
      return res.status(403).json({ error: 'Invalid signup code' });
    }

    const existing = await db.query('SELECT id FROM salespeople WHERE username = $1 OR (email IS NOT NULL AND email = $2)', [username, email || null]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Username or email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO salespeople (username, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, full_name, is_admin`,
      [username, email || null, hash, full_name || null, phone || null]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const { rows } = await db.query(
      'SELECT id, username, email, full_name, password_hash, is_admin, active FROM salespeople WHERE username = $1 OR email = $1',
      [username]
    );
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', salesAuth, (req, res) => {
  res.json({ user: req.salesperson });
});

// GET /api/auth/salespeople — list (admin only) for commission dashboards
router.get('/salespeople', salesAuth, async (req, res) => {
  try {
    if (!req.salesperson.is_admin) return res.status(403).json({ error: 'Admin only' });
    const { rows } = await db.query('SELECT id, username, email, full_name, is_admin, active, created_at FROM salespeople ORDER BY id');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
