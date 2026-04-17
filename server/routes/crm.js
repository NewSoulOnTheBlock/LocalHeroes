const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/auth');

router.use(adminAuth);

// Helper
const q = (text, params) => db.query(text, params);

// ==================== CONTACTS ====================

router.get('/contacts', async (req, res) => {
  try {
    const { status, search, zipcode } = req.query;
    const params = [];
    let where = 'WHERE 1=1';

    if (status)   { params.push(status);        where += ` AND c.status = $${params.length}`; }
    if (zipcode)  { params.push(zipcode);       where += ` AND c.zipcode = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      where += ` AND (c.business_name ILIKE $${i} OR c.contact_name ILIKE $${i} OR c.phone ILIKE $${i})`;
    }

    const sql = `
      SELECT c.*,
        (SELECT call_date  FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) AS last_call_date,
        (SELECT outcome    FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) AS last_call_outcome,
        (SELECT COUNT(*)::int FROM crm_calls WHERE contact_id = c.id) AS total_calls,
        (SELECT followup_date FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) AS next_followup_date,
        (SELECT reason        FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) AS next_followup_reason
      FROM crm_contacts c
      ${where}
      ORDER BY c.updated_at DESC
    `;
    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM crm_contacts WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
    const contact = rows[0];
    contact.calls     = (await q('SELECT * FROM crm_calls      WHERE contact_id = $1 ORDER BY call_date DESC',     [req.params.id])).rows;
    contact.followups = (await q('SELECT * FROM crm_followups  WHERE contact_id = $1 ORDER BY followup_date ASC',  [req.params.id])).rows;
    res.json(contact);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/contacts', async (req, res) => {
  try {
    const { business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes } = req.body;
    if (!business_name) return res.status(400).json({ error: 'Business name is required' });
    const { rows } = await q(
      `INSERT INTO crm_contacts (business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [business_name, contact_name || '', phone || '', email || '', website || '', address || '', zipcode || '', category || '', source || 'manual', status || 'new', notes || '']
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const { business_name, contact_name, phone, email, website, address, zipcode, category, status, notes } = req.body;
    await q(
      `UPDATE crm_contacts
         SET business_name=$1, contact_name=$2, phone=$3, email=$4, website=$5, address=$6,
             zipcode=$7, category=$8, status=$9, notes=$10, updated_at=NOW()
       WHERE id=$11`,
      [business_name, contact_name || '', phone || '', email || '', website || '', address || '',
       zipcode || '', category || '', status || 'new', notes || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/contacts/:id', async (req, res) => {
  try { await q('DELETE FROM crm_contacts WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== CALLS ====================

router.post('/calls', async (req, res) => {
  try {
    const { contact_id, call_date, duration_minutes, outcome, notes } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'Contact ID is required' });
    const { rows } = await q(
      `INSERT INTO crm_calls (contact_id, call_date, duration_minutes, outcome, notes)
       VALUES ($1, COALESCE($2, NOW()), $3, $4, $5) RETURNING id`,
      [contact_id, call_date || null, duration_minutes || null, outcome || null, notes || null]
    );
    await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    await q(
      `INSERT INTO crm_activities (contact_id, type, title, detail)
       VALUES ($1, 'call', $2, $3)`,
      [contact_id, `Call logged: ${outcome || 'unknown'}`, notes || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== FOLLOW-UPS ====================

router.get('/followups', async (req, res) => {
  try {
    const { completed, upcoming } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (completed === '0') where += ' AND f.completed = 0';
    else if (completed === '1') where += ' AND f.completed = 1';
    if (upcoming === '1') where += ` AND f.completed = 0 AND f.followup_date >= to_char(CURRENT_DATE, 'YYYY-MM-DD')`;

    const sql = `
      SELECT f.*, c.business_name, c.contact_name, c.phone, c.email, c.status AS contact_status
      FROM crm_followups f
      JOIN crm_contacts c ON f.contact_id = c.id
      ${where}
      ORDER BY f.followup_date ASC
    `;
    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/followups', async (req, res) => {
  try {
    const { contact_id, followup_date, followup_type, reason } = req.body;
    if (!contact_id || !followup_date) return res.status(400).json({ error: 'Contact ID and date are required' });
    const { rows } = await q(
      `INSERT INTO crm_followups (contact_id, followup_date, followup_type, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [contact_id, followup_date, followup_type || 'call', reason || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/followups/:id/complete', async (req, res) => {
  try {
    await q('UPDATE crm_followups SET completed = 1, completed_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/followups/:id', async (req, res) => {
  try { await q('DELETE FROM crm_followups WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard', async (req, res) => {
  try {
    const totalContacts = parseInt((await q('SELECT COUNT(*)::int AS count FROM crm_contacts')).rows[0].count, 10);
    const byStatus = (await q('SELECT status, COUNT(*)::int AS count FROM crm_contacts GROUP BY status')).rows;
    const callsThisWeek    = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_calls     WHERE call_date     >= NOW() - INTERVAL '7 days'`)).rows[0].count, 10);
    const overdueFollowups = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date <  to_char(CURRENT_DATE,'YYYY-MM-DD')`)).rows[0].count, 10);
    const todayFollowups   = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date  = to_char(CURRENT_DATE,'YYYY-MM-DD')`)).rows[0].count, 10);
    const upcomingFollowups= parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date >= to_char(CURRENT_DATE,'YYYY-MM-DD')`)).rows[0].count, 10);
    res.json({ totalContacts, byStatus, callsThisWeek, overdueFollowups, todayFollowups, upcomingFollowups });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== ACTIVITIES ====================

router.get('/activities/:contactId', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM crm_activities WHERE contact_id = $1 ORDER BY created_at DESC', [req.params.contactId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/activities', async (req, res) => {
  try {
    const { contact_id, title, detail } = req.body;
    if (!contact_id || !title) return res.status(400).json({ error: 'Contact ID and title required' });
    await q(`INSERT INTO crm_activities (contact_id, type, title, detail) VALUES ($1,'note',$2,$3)`, [contact_id, title, detail || null]);
    await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== DAILY CALL LIST ====================

router.get('/calllist', async (req, res) => {
  try {
    const today = `to_char(CURRENT_DATE,'YYYY-MM-DD')`;

    const overdue = (await q(`
      SELECT c.*, f.followup_date, f.reason AS followup_reason, f.id AS followup_id,
             'overdue_followup' AS priority_reason, 1 AS priority_score
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      WHERE f.completed = 0 AND f.followup_date < ${today}
      ORDER BY f.followup_date ASC`)).rows;

    const todayList = (await q(`
      SELECT c.*, f.followup_date, f.reason AS followup_reason, f.id AS followup_id,
             'today_followup' AS priority_reason, 2 AS priority_score
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      WHERE f.completed = 0 AND f.followup_date = ${today}
      ORDER BY f.followup_date ASC`)).rows;

    const hotLeads = (await q(`
      SELECT c.*,
             (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) AS last_call,
             'hot_lead' AS priority_reason, 3 AS priority_score
      FROM crm_contacts c
      WHERE c.status IN ('interested','negotiating')
        AND (
          (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) IS NULL
          OR (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) < NOW() - INTERVAL '3 days'
        )
      ORDER BY c.updated_at DESC`)).rows;

    const newLeads = (await q(`
      SELECT c.*, 'new_lead' AS priority_reason, 4 AS priority_score
      FROM crm_contacts c
      WHERE c.status = 'new'
        AND (SELECT COUNT(*) FROM crm_calls WHERE contact_id = c.id) = 0
      ORDER BY c.created_at ASC
      LIMIT 20`)).rows;

    const retries = (await q(`
      SELECT c.*,
             (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) AS last_call,
             'retry_no_answer' AS priority_reason, 5 AS priority_score
      FROM crm_contacts c
      WHERE c.status = 'no_answer'
        AND (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) < NOW() - INTERVAL '2 days'
      ORDER BY (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) ASC
      LIMIT 10`)).rows;

    const seen = new Set();
    const callList = [];
    for (const list of [overdue, todayList, hotLeads, newLeads, retries]) {
      for (const item of list) {
        if (!seen.has(item.id)) { seen.add(item.id); callList.push(item); }
      }
    }
    res.json(callList);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== CALENDAR ====================

router.get('/calendar', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const { rows } = await q(`
      SELECT f.*, c.business_name, c.contact_name, c.phone
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      WHERE f.followup_date LIKE $1
      ORDER BY f.followup_date ASC`, [`${month}%`]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== EMAIL TEMPLATES ====================

router.get('/templates', async (req, res) => {
  try { res.json((await q('SELECT * FROM crm_email_templates ORDER BY id')).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.get('/templates/:id', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM crm_email_templates WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) return res.status(400).json({ error: 'Name, subject, and body required' });
    const { rows } = await q(
      'INSERT INTO crm_email_templates (name, subject, body) VALUES ($1,$2,$3) RETURNING id',
      [name, subject, body]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== EMAIL SENT LOG ====================

router.get('/emails/:contactId', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM crm_emails_sent WHERE contact_id = $1 ORDER BY created_at DESC', [req.params.contactId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/emails/send', async (req, res) => {
  try {
    const { contact_id, template_id, to_email, subject, body } = req.body;
    if (!contact_id || !to_email || !subject || !body) return res.status(400).json({ error: 'Missing fields' });
    await q(
      `INSERT INTO crm_emails_sent (contact_id, template_id, to_email, subject, body)
       VALUES ($1,$2,$3,$4,$5)`,
      [contact_id, template_id || null, to_email, subject, body]
    );
    await q(`INSERT INTO crm_activities (contact_id, type, title, detail) VALUES ($1,'email',$2,$3)`,
      [contact_id, `Email sent: ${subject}`, body.substring(0, 200)]);
    await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
