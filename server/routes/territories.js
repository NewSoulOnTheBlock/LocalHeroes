const express = require('express');
const router = express.Router();
const db = require('../db');
const salesAuth = require('../middleware/sales-auth');

router.use(salesAuth);

const isAdmin = (req) => !!(req.salesperson && req.salesperson.is_admin);

// GET /api/territories — list all assignments (admin sees all, rep sees own)
router.get('/', async (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT t.id, t.salesperson_id, t.zipcode_id, t.assigned_at,
             sp.username, sp.full_name,
             z.zipcode, z.neighborhood, z.household_count, z.monthly_price_cents
      FROM sales_territories t
      JOIN salespeople sp ON t.salesperson_id = sp.id
      JOIN zipcodes z ON t.zipcode_id = z.id
    `;
    if (!isAdmin(req)) {
      params.push(req.salesperson.id);
      sql += ` WHERE t.salesperson_id = $${params.length}`;
    }
    sql += ' ORDER BY z.zipcode';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/territories — assign a zip to a rep (admin only)
router.post('/', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const { salesperson_id, zipcode } = req.body;
    if (!salesperson_id || !zipcode) return res.status(400).json({ error: 'salesperson_id and zipcode required' });
    const { rows: zipRows } = await db.query('SELECT id FROM zipcodes WHERE zipcode=$1', [zipcode]);
    if (!zipRows[0]) return res.status(404).json({ error: 'Zipcode not found' });
    const { rows } = await db.query(
      `INSERT INTO sales_territories (salesperson_id, zipcode_id)
       VALUES ($1, $2)
       ON CONFLICT (salesperson_id, zipcode_id) DO NOTHING
       RETURNING id`,
      [salesperson_id, zipRows[0].id]
    );
    res.status(201).json({ id: rows[0]?.id, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/territories/:id (admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    await db.query('DELETE FROM sales_territories WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Commissions ----------

// GET /api/territories/commissions — admin sees all, rep sees own
router.get('/commissions', async (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT c.*, sp.username, sp.full_name,
             cc.business_name AS contact_business_name
      FROM sales_commissions c
      JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN crm_contacts cc ON c.contact_id = cc.id
    `;
    if (!isAdmin(req)) {
      params.push(req.salesperson.id);
      sql += ` WHERE c.salesperson_id = $${params.length}`;
    }
    sql += ' ORDER BY c.created_at DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/territories/commissions (admin logs a commission)
router.post('/commissions', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const { salesperson_id, contact_id, application_id, business_id, amount_cents, period, notes } = req.body;
    if (!salesperson_id || !amount_cents) return res.status(400).json({ error: 'salesperson_id and amount_cents required' });
    const { rows } = await db.query(
      `INSERT INTO sales_commissions
        (salesperson_id, contact_id, application_id, business_id, amount_cents, period, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [salesperson_id, contact_id || null, application_id || null, business_id || null,
       amount_cents, period || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/territories/commissions/:id — mark paid (admin)
router.patch('/commissions/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const { status, notes } = req.body;
    const paidAt = status === 'paid' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE sales_commissions
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $3`,
      [status || null, notes || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/territories/commissions/summary — totals per rep
router.get('/commissions/summary', async (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT sp.id, sp.username, sp.full_name,
        COALESCE(SUM(CASE WHEN c.status='paid'    THEN c.amount_cents ELSE 0 END),0)::int AS paid_cents,
        COALESCE(SUM(CASE WHEN c.status='pending' THEN c.amount_cents ELSE 0 END),0)::int AS pending_cents,
        COUNT(c.id)::int AS total_commissions
      FROM salespeople sp
      LEFT JOIN sales_commissions c ON c.salesperson_id = sp.id
    `;
    if (!isAdmin(req)) {
      params.push(req.salesperson.id);
      sql += ` WHERE sp.id = $${params.length}`;
    }
    sql += ' GROUP BY sp.id ORDER BY paid_cents DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Pipeline ----------

const PIPELINE_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

// GET /api/territories/pipeline — kanban view of contacts by stage
router.get('/pipeline', async (req, res) => {
  try {
    const params = [];
    let scope = '';
    if (!isAdmin(req)) {
      params.push(req.salesperson.id);
      scope = ` AND (c.commission_salesperson_id = $${params.length} OR c.commission_salesperson_id IS NULL)`;
    }
    const { rows } = await db.query(
      `SELECT c.id, c.business_name, c.contact_name, c.phone, c.email, c.zipcode, c.category,
              COALESCE(c.pipeline_stage, 'new') AS pipeline_stage, c.updated_at,
              sp.username AS owner_username
       FROM crm_contacts c
       LEFT JOIN salespeople sp ON c.commission_salesperson_id = sp.id
       WHERE 1=1 ${scope}
       ORDER BY c.updated_at DESC`,
      params
    );
    const board = Object.fromEntries(PIPELINE_STAGES.map(s => [s, []]));
    for (const r of rows) {
      const stage = PIPELINE_STAGES.includes(r.pipeline_stage) ? r.pipeline_stage : 'new';
      board[stage].push(r);
    }
    res.json({ stages: PIPELINE_STAGES, board });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/territories/pipeline/:contactId — move contact to new stage
router.patch('/pipeline/:contactId', async (req, res) => {
  try {
    const { stage } = req.body;
    if (!PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
    await db.query(
      `UPDATE crm_contacts SET pipeline_stage = $1, updated_at = NOW() WHERE id = $2`,
      [stage, req.params.contactId]
    );
    await db.query(
      `INSERT INTO crm_activities (contact_id, type, title, detail, salesperson_id)
       VALUES ($1, 'pipeline', 'Moved to ' || $2, NULL, $3)`,
      [req.params.contactId, stage, req.salesperson.id || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
