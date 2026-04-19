const express = require('express');
const router = express.Router();
const db = require('../db');
const salesAuth = require('../middleware/sales-auth');

router.use(salesAuth);

const q = (text, params) => db.query(text, params);

// Whether the current principal can see/edit work that isn't theirs
const isAdmin = (req) => !!(req.salesperson && req.salesperson.is_admin);

// ==================== CONTACTS ====================

router.get('/contacts', async (req, res) => {
  try {
    const { status, search, zipcode, mine, unclaimed } = req.query;
    const me = req.salesperson.id;
    const params = [];
    let where = 'WHERE 1=1';

    if (status)  { params.push(status);  where += ` AND c.status = $${params.length}`; }
    if (zipcode) { params.push(zipcode); where += ` AND c.zipcode = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      where += ` AND (c.business_name ILIKE $${i} OR c.contact_name ILIKE $${i} OR c.phone ILIKE $${i})`;
    }

    // Scope: non-admins default to "mine + unclaimed". ?mine=1 forces strictly mine.
    // ?unclaimed=1 forces only unclaimed. Admin sees everything unless filters applied.
    if (mine === '1' && me) {
      params.push(me);
      where += ` AND c.commission_salesperson_id = $${params.length}`;
    } else if (unclaimed === '1') {
      where += ` AND c.commission_salesperson_id IS NULL`;
    } else if (!isAdmin(req) && me) {
      params.push(me);
      where += ` AND (c.commission_salesperson_id IS NULL OR c.commission_salesperson_id = $${params.length})`;
    }

    const sql = `
      SELECT c.*,
        sp.username AS commission_username,
        sp.full_name AS commission_full_name,
        (SELECT call_date  FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) AS last_call_date,
        (SELECT outcome    FROM crm_calls WHERE contact_id = c.id ORDER BY call_date DESC LIMIT 1) AS last_call_outcome,
        (SELECT COUNT(*)::int FROM crm_calls WHERE contact_id = c.id) AS total_calls,
        (SELECT followup_date FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) AS next_followup_date,
        (SELECT reason        FROM crm_followups WHERE contact_id = c.id AND completed = 0 ORDER BY followup_date ASC LIMIT 1) AS next_followup_reason
      FROM crm_contacts c
      LEFT JOIN salespeople sp ON c.commission_salesperson_id = sp.id
      ${where}
      ORDER BY c.updated_at DESC
    `;
    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT c.*, sp.username AS commission_username, sp.full_name AS commission_full_name
      FROM crm_contacts c
      LEFT JOIN salespeople sp ON c.commission_salesperson_id = sp.id
      WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
    const contact = rows[0];

    const me = req.salesperson.id;
    // Non-admins only see calls/followups scoped to themselves for other people's leads
    const scopeSelf = !isAdmin(req) && contact.commission_salesperson_id && contact.commission_salesperson_id !== me;

    const callsSql = scopeSelf
      ? 'SELECT cl.*, sp.username AS salesperson_username FROM crm_calls cl LEFT JOIN salespeople sp ON cl.salesperson_id = sp.id WHERE cl.contact_id = $1 AND cl.salesperson_id = $2 ORDER BY cl.call_date DESC'
      : 'SELECT cl.*, sp.username AS salesperson_username FROM crm_calls cl LEFT JOIN salespeople sp ON cl.salesperson_id = sp.id WHERE cl.contact_id = $1 ORDER BY cl.call_date DESC';
    const fuSql = scopeSelf
      ? 'SELECT * FROM crm_followups WHERE contact_id = $1 AND salesperson_id = $2 ORDER BY followup_date ASC'
      : 'SELECT * FROM crm_followups WHERE contact_id = $1 ORDER BY followup_date ASC';
    const params = scopeSelf ? [req.params.id, me] : [req.params.id];

    contact.calls     = (await q(callsSql, params)).rows;
    contact.followups = (await q(fuSql, params)).rows;
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
    // Only admin or the commission owner can edit a claimed lead
    const existing = (await q('SELECT commission_salesperson_id FROM crm_contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    if (!isAdmin(req) && existing.commission_salesperson_id && existing.commission_salesperson_id !== req.salesperson.id) {
      return res.status(403).json({ error: 'This lead is owned by another salesperson' });
    }

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
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    await q('DELETE FROM crm_contacts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Lightweight status-only update for kanban drag-and-drop (avoids round-tripping the whole record)
router.patch('/contacts/:id/status', async (req, res) => {
  try {
    const ALLOWED = new Set(['new','contacted','interested','negotiating','signed','not_interested','no_answer']);
    const { status } = req.body || {};
    if (!ALLOWED.has(status)) return res.status(400).json({ error: 'Invalid status' });
    const existing = (await q('SELECT commission_salesperson_id FROM crm_contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    if (!isAdmin(req) && existing.commission_salesperson_id && existing.commission_salesperson_id !== req.salesperson.id) {
      return res.status(403).json({ error: 'This lead is owned by another salesperson' });
    }
    await q('UPDATE crm_contacts SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== CALLS ====================
// Logging a call claims the commission for this salesperson (first-come-first-serve,
// permanent once set). Admin calls (no salesperson.id) never claim.

router.post('/calls', async (req, res) => {
  try {
    const { contact_id, call_date, duration_minutes, outcome, notes } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'Contact ID is required' });
    const me = req.salesperson.id;

    // Check existing claim — non-admin may only call on unclaimed or own leads
    const existing = (await q('SELECT commission_salesperson_id FROM crm_contacts WHERE id = $1', [contact_id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    if (!isAdmin(req) && existing.commission_salesperson_id && existing.commission_salesperson_id !== me) {
      return res.status(403).json({ error: 'This lead is owned by another salesperson' });
    }

    const { rows } = await q(
      `INSERT INTO crm_calls (contact_id, call_date, duration_minutes, outcome, notes, salesperson_id)
       VALUES ($1, COALESCE($2, NOW()), $3, $4, $5, $6) RETURNING id`,
      [contact_id, call_date || null, duration_minutes || null, outcome || null, notes || null, me || null]
    );

    // Atomically claim commission if still unclaimed (only for real salespeople, not admin bypass)
    let claimed = false;
    if (me) {
      const claim = await q(
        `UPDATE crm_contacts
            SET commission_salesperson_id = $1, commission_claimed_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND commission_salesperson_id IS NULL
          RETURNING id`,
        [me, contact_id]
      );
      claimed = claim.rowCount > 0;
      if (!claimed) {
        await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
      }
    } else {
      await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    }

    await q(
      `INSERT INTO crm_activities (contact_id, type, title, detail, salesperson_id)
       VALUES ($1, 'call', $2, $3, $4)`,
      [contact_id, `Call logged: ${outcome || 'unknown'}`, notes || null, me || null]
    );
    res.status(201).json({ id: rows[0].id, commission_claimed: claimed });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== FOLLOW-UPS ====================

router.get('/followups', async (req, res) => {
  try {
    const { completed, upcoming, all } = req.query;
    const me = req.salesperson.id;
    const params = [];
    let where = 'WHERE 1=1';

    if (completed === '0') where += ' AND f.completed = 0';
    else if (completed === '1') where += ' AND f.completed = 1';
    if (upcoming === '1') where += ` AND f.completed = 0 AND f.followup_date >= to_char(CURRENT_DATE, 'YYYY-MM-DD')`;

    // Non-admins see only their own followups; admin sees all by default
    if (!isAdmin(req) && me) {
      params.push(me);
      where += ` AND f.salesperson_id = $${params.length}`;
    } else if (isAdmin(req) && all !== '1' && req.query.salesperson_id) {
      params.push(parseInt(req.query.salesperson_id, 10));
      where += ` AND f.salesperson_id = $${params.length}`;
    }

    const sql = `
      SELECT f.*, c.business_name, c.contact_name, c.phone, c.email, c.status AS contact_status,
             sp.username AS salesperson_username
      FROM crm_followups f
      JOIN crm_contacts c ON f.contact_id = c.id
      LEFT JOIN salespeople sp ON f.salesperson_id = sp.id
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
    const me = req.salesperson.id;
    const { rows } = await q(
      `INSERT INTO crm_followups (contact_id, followup_date, followup_type, reason, salesperson_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [contact_id, followup_date, followup_type || 'call', reason || null, me || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/followups/:id/complete', async (req, res) => {
  try {
    // Non-admins can only complete their own followups
    if (!isAdmin(req)) {
      const fu = (await q('SELECT salesperson_id FROM crm_followups WHERE id = $1', [req.params.id])).rows[0];
      if (!fu) return res.status(404).json({ error: 'Not found' });
      if (fu.salesperson_id !== req.salesperson.id) return res.status(403).json({ error: 'Not yours' });
    }
    await q('UPDATE crm_followups SET completed = 1, completed_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/followups/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      const fu = (await q('SELECT salesperson_id FROM crm_followups WHERE id = $1', [req.params.id])).rows[0];
      if (!fu) return res.status(404).json({ error: 'Not found' });
      if (fu.salesperson_id !== req.salesperson.id) return res.status(403).json({ error: 'Not yours' });
    }
    await q('DELETE FROM crm_followups WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard', async (req, res) => {
  try {
    const me = req.salesperson.id;
    const scopeParams = [];
    let contactScope = '';
    let callScope = '';
    let fuScope = '';
    if (!isAdmin(req) && me) {
      scopeParams.push(me);
      contactScope = ' WHERE commission_salesperson_id = $1';
      callScope    = ' WHERE salesperson_id = $1';
      fuScope      = ' AND salesperson_id = $1';
    }

    const totalContacts = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_contacts${contactScope}`, scopeParams)).rows[0].count, 10);
    const byStatus = (await q(`SELECT status, COUNT(*)::int AS count FROM crm_contacts${contactScope} GROUP BY status`, scopeParams)).rows;
    const callsThisWeek    = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_calls WHERE call_date >= NOW() - INTERVAL '7 days'${callScope ? ' AND ' + callScope.slice(7) : ''}`, scopeParams)).rows[0].count, 10);
    const overdueFollowups = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date <  to_char(CURRENT_DATE,'YYYY-MM-DD')${fuScope}`, scopeParams)).rows[0].count, 10);
    const todayFollowups   = parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date  = to_char(CURRENT_DATE,'YYYY-MM-DD')${fuScope}`, scopeParams)).rows[0].count, 10);
    const upcomingFollowups= parseInt((await q(`SELECT COUNT(*)::int AS count FROM crm_followups WHERE completed = 0 AND followup_date >= to_char(CURRENT_DATE,'YYYY-MM-DD')${fuScope}`, scopeParams)).rows[0].count, 10);

    // Leaderboard: claimed commissions per salesperson (admin view)
    let leaderboard = [];
    if (isAdmin(req)) {
      leaderboard = (await q(`
        SELECT sp.id, sp.username, sp.full_name,
               COUNT(c.id)::int AS claimed_leads,
               COUNT(c.id) FILTER (WHERE c.status = 'signed')::int AS signed_count
        FROM salespeople sp
        LEFT JOIN crm_contacts c ON c.commission_salesperson_id = sp.id
        GROUP BY sp.id
        ORDER BY claimed_leads DESC`)).rows;
    }

    res.json({ totalContacts, byStatus, callsThisWeek, overdueFollowups, todayFollowups, upcomingFollowups, leaderboard, me: req.salesperson });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== ACTIVITIES ====================

router.get('/activities/:contactId', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT a.*, sp.username AS salesperson_username
      FROM crm_activities a
      LEFT JOIN salespeople sp ON a.salesperson_id = sp.id
      WHERE a.contact_id = $1 ORDER BY a.created_at DESC`, [req.params.contactId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/activities', async (req, res) => {
  try {
    const { contact_id, title, detail } = req.body;
    if (!contact_id || !title) return res.status(400).json({ error: 'Contact ID and title required' });
    const me = req.salesperson.id;
    await q(`INSERT INTO crm_activities (contact_id, type, title, detail, salesperson_id) VALUES ($1,'note',$2,$3,$4)`,
      [contact_id, title, detail || null, me || null]);
    await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ==================== DAILY CALL LIST ====================
// Scoped to self + unclaimed for non-admins.

router.get('/calllist', async (req, res) => {
  try {
    const me = req.salesperson.id;
    const today = `to_char(CURRENT_DATE,'YYYY-MM-DD')`;
    const mineFilter = (!isAdmin(req) && me) ? ` AND (c.commission_salesperson_id IS NULL OR c.commission_salesperson_id = ${parseInt(me,10)})` : '';
    const fuMine = (!isAdmin(req) && me) ? ` AND f.salesperson_id = ${parseInt(me,10)}` : '';

    const overdue = (await q(`
      SELECT c.*, f.followup_date, f.reason AS followup_reason, f.id AS followup_id,
             'overdue_followup' AS priority_reason, 1 AS priority_score
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      WHERE f.completed = 0 AND f.followup_date < ${today}${fuMine}
      ORDER BY f.followup_date ASC`)).rows;

    const todayList = (await q(`
      SELECT c.*, f.followup_date, f.reason AS followup_reason, f.id AS followup_id,
             'today_followup' AS priority_reason, 2 AS priority_score
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      WHERE f.completed = 0 AND f.followup_date = ${today}${fuMine}
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
        )${mineFilter}
      ORDER BY c.updated_at DESC`)).rows;

    const newLeads = (await q(`
      SELECT c.*, 'new_lead' AS priority_reason, 4 AS priority_score
      FROM crm_contacts c
      WHERE c.status = 'new'
        AND (SELECT COUNT(*) FROM crm_calls WHERE contact_id = c.id) = 0${mineFilter}
      ORDER BY c.created_at ASC
      LIMIT 20`)).rows;

    const retries = (await q(`
      SELECT c.*,
             (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) AS last_call,
             'retry_no_answer' AS priority_reason, 5 AS priority_score
      FROM crm_contacts c
      WHERE c.status = 'no_answer'
        AND (SELECT MAX(call_date) FROM crm_calls WHERE contact_id = c.id) < NOW() - INTERVAL '2 days'${mineFilter}
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
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const me = req.salesperson.id;
    const params = [`${month}%`];
    let where = 'WHERE f.followup_date LIKE $1';
    if (!isAdmin(req) && me) { params.push(me); where += ` AND f.salesperson_id = $${params.length}`; }
    const { rows } = await q(`
      SELECT f.*, c.business_name, c.contact_name, c.phone
      FROM crm_followups f JOIN crm_contacts c ON f.contact_id = c.id
      ${where}
      ORDER BY f.followup_date ASC`, params);
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
    const me = req.salesperson.id;
    await q(
      `INSERT INTO crm_emails_sent (contact_id, template_id, to_email, subject, body, salesperson_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [contact_id, template_id || null, to_email, subject, body, me || null]
    );
    await q(`INSERT INTO crm_activities (contact_id, type, title, detail, salesperson_id) VALUES ($1,'email',$2,$3,$4)`,
      [contact_id, `Email sent: ${subject}`, body.substring(0, 200), me || null]);
    await q('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [contact_id]);
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
