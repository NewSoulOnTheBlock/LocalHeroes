const express = require('express');
const router = express.Router();
const db = require('../db');
const salesAuth = require('../middleware/sales-auth');

// POST /api/referrals/validate — public, check if code is valid (for apply form)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, error: 'code required' });
    const { rows } = await db.query(
      `SELECT id, code, discount_cents, reward_cents, active
       FROM referral_codes WHERE code = $1`,
      [code.trim().toUpperCase()]
    );
    const r = rows[0];
    if (!r || !r.active) return res.json({ valid: false });
    res.json({
      valid: true,
      code: r.code,
      discount_cents: r.discount_cents,
      discount_display: `$${(r.discount_cents / 100).toFixed(0)} off your first month`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// All routes below require salesperson/business owner auth
router.use(salesAuth);

function randCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return (prefix || 'LH') + '-' + out;
}

// GET /api/referrals/mine — list my referral codes + uses
router.get('/mine', async (req, res) => {
  try {
    const me = req.salesperson.id;
    const email = req.salesperson.email;
    const { rows: codes } = await db.query(
      `SELECT rc.*,
        (SELECT COUNT(*)::int FROM referrals r WHERE r.code_id = rc.id) AS total_referrals,
        (SELECT COUNT(*)::int FROM referrals r WHERE r.code_id = rc.id AND r.status = 'converted') AS converted
       FROM referral_codes rc
       WHERE rc.owner_salesperson_id = $1 OR rc.owner_email = $2
       ORDER BY rc.created_at DESC`,
      [me, email || '']
    );
    res.json(codes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/generate — create a code for the logged-in user
router.post('/generate', async (req, res) => {
  try {
    const { reward_cents, discount_cents, prefix } = req.body;
    const code = randCode(prefix);
    const { rows } = await db.query(
      `INSERT INTO referral_codes (code, owner_salesperson_id, owner_email, reward_cents, discount_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code, req.salesperson.id || null, req.salesperson.email || null,
       reward_cents || 5000, discount_cents || 5000]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrals/admin/all — admin-only full list
router.get('/admin/all', async (req, res) => {
  try {
    if (!req.salesperson.is_admin) return res.status(403).json({ error: 'Admin only' });
    const { rows } = await db.query(`
      SELECT rc.*, sp.username AS owner_username,
        (SELECT COUNT(*)::int FROM referrals r WHERE r.code_id = rc.id) AS total_referrals
      FROM referral_codes rc
      LEFT JOIN salespeople sp ON rc.owner_salesperson_id = sp.id
      ORDER BY rc.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
