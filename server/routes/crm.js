const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/auth');

router.use(adminAuth);

// ==================== CONTACTS ====================

// GET /api/crm/contacts — list all contacts with latest call and next follow-up
router.get('/contacts', (req, res) => {
  const { status, search, zipcode } = req.query;

  let query = `
    SELECT c.*,
      (SELECT call_date FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) as last_call_date,
      (SELECT outcome FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) as last_call_outcome,
      (SELECT COUNT(*) FROM crm_calls WHERE contact_id = c.id) as total_calls,
      (SELECT followup_date FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) as next_followup_date,
      (SELECT reason FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) as next_followup_reason
    FROM crm_contacts c
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND c.status = ?';
    params.push(status);
  }
  if (zipcode) {
    query += ' AND c.zipcode = ?';
    params.push(zipcode);
  }
  if (search) {
    query += ' AND (c.business_name LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY c.updated_at DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/crm/contacts/:id — single contact with all calls and follow-ups
router.get('/contacts/:id', (req, res) => {
  const contact = db.prepare('SELECT * FROM crm_contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  contact.calls = db.prepare('SELECT * FROM crm_calls WHERE contact_id = ? ORDER BY call_date DESC').all(req.params.id);
  contact.followups = db.prepare('SELECT * FROM crm_followups WHERE contact_id = ? ORDER BY followup_date ASC').all(req.params.id);

  res.json(contact);
});

// POST /api/crm/contacts — create contact
router.post('/contacts', (req, res) => {
  const { business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes } = req.body;
  if (!business_name) return res.status(400).json({ error: 'Business name is required' });

  const result = db.prepare(`
    INSERT INTO crm_contacts (business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(business_name, contact_name, phone, email, website, address, zipcode, category, source || 'manual', status || 'new', notes);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/crm/contacts/:id — update contact
router.put('/contacts/:id', (req, res) => {
  const { business_name, contact_name, phone, email, website, address, zipcode, category, status, notes } = req.body;

  db.prepare(`
    UPDATE crm_contacts
    SET business_name = ?, contact_name = ?, phone = ?, email = ?, website = ?, address = ?, zipcode = ?, category = ?, status = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(business_name, contact_name, phone, email, website, address, zipcode, category, status, notes, req.params.id);

  res.json({ success: true });
});

// DELETE /api/crm/contacts/:id
router.delete('/contacts/:id', (req, res) => {
  db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== CALLS ====================

// POST /api/crm/calls — log a call
router.post('/calls', (req, res) => {
  const { contact_id, call_date, duration_minutes, outcome, notes } = req.body;
  if (!contact_id) return res.status(400).json({ error: 'Contact ID is required' });

  const result = db.prepare(`
    INSERT INTO crm_calls (contact_id, call_date, duration_minutes, outcome, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(contact_id, call_date || new Date().toISOString(), duration_minutes || null, outcome, notes);

  // Update contact's updated_at
  db.prepare("UPDATE crm_contacts SET updated_at = datetime('now') WHERE id = ?").run(contact_id);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ==================== FOLLOW-UPS ====================

// GET /api/crm/followups — list upcoming follow-ups
router.get('/followups', (req, res) => {
  const { completed, upcoming } = req.query;

  let query = `
    SELECT f.*, c.business_name, c.contact_name, c.phone, c.email, c.status as contact_status
    FROM crm_followups f
    JOIN crm_contacts c ON f.contact_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (completed === '0') {
    query += ' AND f.completed = 0';
  } else if (completed === '1') {
    query += ' AND f.completed = 1';
  }

  if (upcoming === '1') {
    query += ' AND f.completed = 0 AND f.followup_date >= date("now")';
  }

  query += ' ORDER BY f.followup_date ASC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/crm/followups — schedule a follow-up
router.post('/followups', (req, res) => {
  const { contact_id, followup_date, followup_type, reason } = req.body;
  if (!contact_id || !followup_date) return res.status(400).json({ error: 'Contact ID and date are required' });

  const result = db.prepare(`
    INSERT INTO crm_followups (contact_id, followup_date, followup_type, reason)
    VALUES (?, ?, ?, ?)
  `).run(contact_id, followup_date, followup_type || 'call', reason);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/crm/followups/:id/complete — mark follow-up as done
router.patch('/followups/:id/complete', (req, res) => {
  db.prepare("UPDATE crm_followups SET completed = 1, completed_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/crm/followups/:id
router.delete('/followups/:id', (req, res) => {
  db.prepare('DELETE FROM crm_followups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== DASHBOARD STATS ====================

// GET /api/crm/dashboard — summary stats
router.get('/dashboard', (req, res) => {
  const totalContacts = db.prepare('SELECT COUNT(*) as count FROM crm_contacts').get().count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM crm_contacts GROUP BY status').all();
  const callsThisWeek = db.prepare("SELECT COUNT(*) as count FROM crm_calls WHERE call_date >= date('now', '-7 days')").get().count;
  const overdueFollowups = db.prepare("SELECT COUNT(*) as count FROM crm_followups WHERE completed = 0 AND followup_date < date('now')").get().count;
  const todayFollowups = db.prepare("SELECT COUNT(*) as count FROM crm_followups WHERE completed = 0 AND date(followup_date) = date('now')").get().count;
  const upcomingFollowups = db.prepare("SELECT COUNT(*) as count FROM crm_followups WHERE completed = 0 AND followup_date >= date('now')").get().count;

  res.json({
    totalContacts,
    byStatus,
    callsThisWeek,
    overdueFollowups,
    todayFollowups,
    upcomingFollowups
  });
});

module.exports = router;
