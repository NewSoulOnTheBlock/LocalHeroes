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

// ==================== ACTIVITY TIMELINE ====================

// Log an activity (used internally by other actions too)
function logActivity(contact_id, type, title, detail, metadata) {
  db.prepare(`
    INSERT INTO crm_activities (contact_id, type, title, detail, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(contact_id, type, title, detail || null, metadata ? JSON.stringify(metadata) : null);
}

// GET /api/crm/activities/:contactId — timeline for a contact
router.get('/activities/:contactId', (req, res) => {
  const activities = db.prepare(`
    SELECT * FROM crm_activities WHERE contact_id = ? ORDER BY created_at DESC
  `).all(req.params.contactId);
  res.json(activities);
});

// POST /api/crm/activities — add a manual note
router.post('/activities', (req, res) => {
  const { contact_id, title, detail } = req.body;
  if (!contact_id || !title) return res.status(400).json({ error: 'Contact ID and title required' });
  logActivity(contact_id, 'note', title, detail);
  db.prepare("UPDATE crm_contacts SET updated_at = datetime('now') WHERE id = ?").run(contact_id);
  res.status(201).json({ success: true });
});

// ==================== DAILY CALL LIST ====================

// GET /api/crm/calllist — auto-generated prioritized call queue
router.get('/calllist', (req, res) => {
  // Priority 1: Overdue follow-ups
  const overdue = db.prepare(`
    SELECT c.*, f.followup_date, f.reason as followup_reason, f.id as followup_id,
      'overdue_followup' as priority_reason, 1 as priority_score
    FROM crm_followups f
    JOIN crm_contacts c ON f.contact_id = c.id
    WHERE f.completed = 0 AND f.followup_date < date('now')
    ORDER BY f.followup_date ASC
  `).all();

  // Priority 2: Today's follow-ups
  const today = db.prepare(`
    SELECT c.*, f.followup_date, f.reason as followup_reason, f.id as followup_id,
      'today_followup' as priority_reason, 2 as priority_score
    FROM crm_followups f
    JOIN crm_contacts c ON f.contact_id = c.id
    WHERE f.completed = 0 AND date(f.followup_date) = date('now')
    ORDER BY f.followup_date ASC
  `).all();

  // Priority 3: Hot leads (interested/negotiating) with no recent call (>3 days)
  const hotLeads = db.prepare(`
    SELECT c.*,
      (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) as last_call,
      'hot_lead' as priority_reason, 3 as priority_score
    FROM crm_contacts c
    WHERE c.status IN ('interested', 'negotiating')
    AND (
      (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) IS NULL
      OR (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) < datetime('now', '-3 days')
    )
    ORDER BY c.updated_at DESC
  `).all();

  // Priority 4: New leads never called
  const newLeads = db.prepare(`
    SELECT c.*,
      'new_lead' as priority_reason, 4 as priority_score
    FROM crm_contacts c
    WHERE c.status = 'new'
    AND (SELECT COUNT(*) FROM crm_calls WHERE contact_id = c.id) = 0
    ORDER BY c.created_at ASC
    LIMIT 20
  `).all();

  // Priority 5: No-answers to retry (last call was no_answer, >2 days ago)
  const retries = db.prepare(`
    SELECT c.*,
      (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) as last_call,
      'retry_no_answer' as priority_reason, 5 as priority_score
    FROM crm_contacts c
    WHERE c.status = 'no_answer'
    AND (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) < datetime('now', '-2 days')
    ORDER BY (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) ASC
    LIMIT 10
  `).all();

  // Dedupe by contact id (a contact might appear in multiple lists)
  const seen = new Set();
  const callList = [];
  for (const list of [overdue, today, hotLeads, newLeads, retries]) {
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        callList.push(item);
      }
    }
  }

  res.json(callList);
});

// ==================== EMAIL TEMPLATES ====================

// GET /api/crm/templates
router.get('/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM crm_email_templates ORDER BY id').all());
});

// GET /api/crm/templates/:id
router.get('/templates/:id', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM crm_email_templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  res.json(tmpl);
});

// POST /api/crm/templates
router.post('/templates', (req, res) => {
  const { name, subject, body } = req.body;
  if (!name || !subject || !body) return res.status(400).json({ error: 'Name, subject, and body required' });
  const result = db.prepare('INSERT INTO crm_email_templates (name, subject, body) VALUES (?, ?, ?)').run(name, subject, body);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/crm/templates/:id
router.put('/templates/:id', (req, res) => {
  const { name, subject, body } = req.body;
  db.prepare('UPDATE crm_email_templates SET name = ?, subject = ?, body = ? WHERE id = ?').run(name, subject, body, req.params.id);
  res.json({ success: true });
});

// POST /api/crm/emails/send — send (log) an email to a contact
router.post('/emails/send', (req, res) => {
  const { contact_id, template_id, to_email, subject, body } = req.body;
  if (!contact_id || !to_email || !subject || !body) {
    return res.status(400).json({ error: 'contact_id, to_email, subject, and body required' });
  }

  const result = db.prepare(`
    INSERT INTO crm_emails_sent (contact_id, template_id, to_email, subject, body)
    VALUES (?, ?, ?, ?, ?)
  `).run(contact_id, template_id || null, to_email, subject, body);

  // Log activity
  logActivity(contact_id, 'email', `Email sent: ${subject}`, body.substring(0, 200));

  // Update contact timestamp
  db.prepare("UPDATE crm_contacts SET updated_at = datetime('now') WHERE id = ?").run(contact_id);

  res.status(201).json({ id: result.lastInsertRowid });
});

// GET /api/crm/emails/:contactId — emails sent to a contact
router.get('/emails/:contactId', (req, res) => {
  const emails = db.prepare(`
    SELECT e.*, t.name as template_name
    FROM crm_emails_sent e
    LEFT JOIN crm_email_templates t ON e.template_id = t.id
    WHERE e.contact_id = ?
    ORDER BY e.created_at DESC
  `).all(req.params.contactId);
  res.json(emails);
});

// ==================== CALENDAR ====================

// GET /api/crm/calendar?month=2026-04 — follow-ups for a given month
router.get('/calendar', (req, res) => {
  const { month } = req.query; // format: YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month param required (YYYY-MM)' });
  }

  const startDate = `${month}-01`;
  const endDate = `${month}-31`; // sqlite handles overflow gracefully

  const followups = db.prepare(`
    SELECT f.*, c.business_name, c.contact_name, c.phone, c.status as contact_status
    FROM crm_followups f
    JOIN crm_contacts c ON f.contact_id = c.id
    WHERE f.followup_date >= ? AND f.followup_date <= ?
    ORDER BY f.followup_date ASC
  `).all(startDate, endDate);

  res.json(followups);
});

// Export logActivity for use in other route files
router.logActivity = logActivity;

module.exports = router;
