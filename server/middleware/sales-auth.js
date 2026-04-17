const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'local-heroes-dev-secret-change-me';

// Verifies a salesperson JWT and attaches `req.salesperson = { id, username, is_admin }`.
// Also accepts HTTP Basic admin password (ADMIN_PASSWORD) as a super-admin bypass,
// in which case `req.salesperson = { id: null, username: 'admin', is_admin: 1 }`.
async function salesAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    // Bearer JWT
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET);
      const { rows } = await db.query(
        'SELECT id, username, email, full_name, is_admin, active FROM salespeople WHERE id = $1',
        [payload.id]
      );
      if (!rows[0] || !rows[0].active) return res.status(401).json({ error: 'Invalid session' });
      req.salesperson = rows[0];
      return next();
    }

    // HTTP Basic — admin-only bypass (for the legacy super-admin panel)
    if (header.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      const adminPass = process.env.ADMIN_PASSWORD || 'localheroes2026';
      if (pass === adminPass) {
        req.salesperson = { id: null, username: 'admin', full_name: 'Super Admin', is_admin: 1 };
        return next();
      }
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

salesAuth.JWT_SECRET = JWT_SECRET;

module.exports = salesAuth;
