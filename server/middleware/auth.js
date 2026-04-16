// Simple admin authentication middleware
// In production, replace with proper session-based auth
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'localheroes2026';

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const encoded = authHeader.split(' ')[1];
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [, password] = decoded.split(':');

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }

  next();
}

module.exports = adminAuth;
