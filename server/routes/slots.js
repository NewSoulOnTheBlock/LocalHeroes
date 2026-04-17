const express = require('express');
const router = express.Router();
const db = require('../db');

function nextMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

// GET /api/slots/availability?zipcode=77008&month=2026-05
// Returns per-category availability for a zipcode/month
router.get('/availability', async (req, res) => {
  try {
    const zipcode = req.query.zipcode;
    const month = req.query.month || nextMonth();
    if (!zipcode) return res.status(400).json({ error: 'zipcode required' });

    const { rows: zipRows } = await db.query(
      'SELECT id, zipcode, neighborhood, household_count, monthly_price_cents, max_slots FROM zipcodes WHERE zipcode = $1',
      [zipcode]
    );
    const zip = zipRows[0];
    if (!zip) return res.status(404).json({ error: 'Zipcode not found' });

    const { rows: cats } = await db.query('SELECT id, name, slug FROM categories ORDER BY name');
    const { rows: claimed } = await db.query(
      `SELECT category_id FROM postcard_slots WHERE zipcode_id = $1 AND mailing_month = $2`,
      [zip.id, month]
    );
    const claimedSet = new Set(claimed.map(r => r.category_id));
    const { rows: waitCounts } = await db.query(
      `SELECT category_id, COUNT(*)::int AS c FROM waitlist_entries
       WHERE zipcode_id = $1 AND mailing_month = $2 GROUP BY category_id`,
      [zip.id, month]
    );
    const waitMap = Object.fromEntries(waitCounts.map(r => [r.category_id, r.c]));

    const totalClaimed = claimedSet.size;
    const zipFull = totalClaimed >= (zip.max_slots || 6);

    res.json({
      zipcode: zip.zipcode,
      neighborhood: zip.neighborhood,
      household_count: zip.household_count,
      monthly_price_cents: zip.monthly_price_cents,
      max_slots: zip.max_slots,
      slots_claimed: totalClaimed,
      slots_remaining: Math.max(0, (zip.max_slots || 6) - totalClaimed),
      zip_full: zipFull,
      mailing_month: month,
      categories: cats.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        available: !claimedSet.has(c.id) && !zipFull,
        taken: claimedSet.has(c.id),
        waitlist_count: waitMap[c.id] || 0
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/slots/waitlist — join waitlist without submitting full application
router.post('/waitlist', async (req, res) => {
  try {
    const { zipcode, category, mailing_month, business_name, contact_name, email, phone } = req.body;
    if (!zipcode || !category || !email) return res.status(400).json({ error: 'zipcode, category, email required' });
    const month = mailing_month || nextMonth();

    const { rows: zipRows } = await db.query('SELECT id FROM zipcodes WHERE zipcode=$1', [zipcode]);
    const { rows: catRows } = await db.query(
      'SELECT id FROM categories WHERE slug=$1 OR name=$1 LIMIT 1', [category]
    );
    if (!zipRows[0] || !catRows[0]) return res.status(404).json({ error: 'Unknown zipcode or category' });

    const { rows } = await db.query(
      `INSERT INTO waitlist_entries
        (zipcode_id, category_id, mailing_month, business_name, contact_name, email, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [zipRows[0].id, catRows[0].id, month, business_name || null, contact_name || null, email, phone || null]
    );
    res.status(201).json({ id: rows[0].id, message: 'Added to waitlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
