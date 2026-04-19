const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const adminAuth = require('../middleware/auth');
const salesAuth = require('../middleware/sales-auth');

// ---- Image upload (reused multer config) ----
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '..', '..', 'public', 'images', 'uploads')),
  filename: (req, file, cb) => {
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'blog-' + stamp + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(ok ? null : new Error('Only image files allowed'), ok);
  }
});

// ---- Helpers ----
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'post';
}

async function uniqueSlug(base, excludeId) {
  let slug = base, n = 1;
  while (true) {
    const { rows } = await db.query(
      'SELECT id FROM blog_posts WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)',
      [slug, excludeId || null]
    );
    if (!rows.length) return slug;
    n++; slug = `${base}-${n}`;
  }
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString().split(',')[0].trim();
}

const PUBLIC_FILTER = `status = 'published' AND (publish_at IS NULL OR publish_at <= NOW())`;

// ---------- PUBLIC ----------

// GET /api/blog/posts — list published posts
router.get('/posts', async (req, res) => {
  try {
    const { q, tag, category, limit } = req.query;
    const params = [];
    let where = PUBLIC_FILTER;
    if (q)        { params.push(`%${q}%`);     where += ` AND (title ILIKE $${params.length} OR excerpt ILIKE $${params.length} OR body_html ILIKE $${params.length})`; }
    if (tag)      { params.push(tag);          where += ` AND $${params.length} = ANY(tags)`; }
    if (category) { params.push(category);     where += ` AND category = $${params.length}`; }
    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const sql = `
      SELECT id, slug, title, excerpt, featured_image, author_name, author_avatar,
             tags, category, publish_at, like_count, view_count, created_at
      FROM blog_posts WHERE ${where}
      ORDER BY COALESCE(publish_at, created_at) DESC
      LIMIT ${lim}`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/blog/tags — distinct tags from published posts
router.get('/tags', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t AS tag, COUNT(*)::int AS count
      FROM blog_posts, UNNEST(tags) t
      WHERE ${PUBLIC_FILTER}
      GROUP BY t ORDER BY count DESC, tag`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/blog/posts/:slug — single published post (also bumps view_count)
router.get('/posts/:slug', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM blog_posts WHERE slug = $1 AND ${PUBLIC_FILTER}`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    db.query('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1', [rows[0].id])
      .catch(() => {});
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/blog/posts/:slug/comments
router.get('/posts/:slug/comments', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.author_name, c.body, c.created_at
      FROM blog_comments c
      JOIN blog_posts p ON c.post_id = p.id
      WHERE p.slug = $1 AND c.approved = TRUE
      ORDER BY c.created_at ASC`, [req.params.slug]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// POST /api/blog/posts/:slug/comments
router.post('/posts/:slug/comments', async (req, res) => {
  try {
    const { author_name, author_email, body } = req.body || {};
    if (!author_name || !body) return res.status(400).json({ error: 'Name and comment are required' });
    if (body.length > 4000) return res.status(400).json({ error: 'Comment too long' });
    const { rows: posts } = await db.query(
      `SELECT id FROM blog_posts WHERE slug = $1 AND ${PUBLIC_FILTER}`,
      [req.params.slug]
    );
    if (!posts.length) return res.status(404).json({ error: 'Post not found' });
    const { rows } = await db.query(
      `INSERT INTO blog_comments (post_id, author_name, author_email, body)
       VALUES ($1,$2,$3,$4) RETURNING id, author_name, body, created_at`,
      [posts[0].id, author_name.slice(0, 80), (author_email || '').slice(0, 120), body]
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// POST /api/blog/posts/:slug/like — one per IP
router.post('/posts/:slug/like', async (req, res) => {
  try {
    const { rows: posts } = await db.query(
      `SELECT id, like_count FROM blog_posts WHERE slug = $1 AND ${PUBLIC_FILTER}`,
      [req.params.slug]
    );
    if (!posts.length) return res.status(404).json({ error: 'Not found' });
    const ip = clientIp(req) || 'unknown';
    try {
      await db.query('INSERT INTO blog_likes (post_id, ip) VALUES ($1,$2)', [posts[0].id, ip]);
      const { rows } = await db.query(
        'UPDATE blog_posts SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
        [posts[0].id]
      );
      return res.json({ liked: true, like_count: rows[0].like_count });
    } catch (e) {
      if (e.code === '23505') return res.json({ liked: false, like_count: posts[0].like_count, already: true });
      throw e;
    }
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ---------- ADMIN ----------
const adminRouter = express.Router();
adminRouter.use(salesAuth);
adminRouter.use((req, res, next) => {
  if (!req.salesperson || !req.salesperson.is_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
});

adminRouter.get('/posts', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, slug, title, excerpt, featured_image, author_name, tags, category,
              status, publish_at, like_count, view_count, created_at, updated_at
       FROM blog_posts ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

adminRouter.get('/posts/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

adminRouter.post('/posts', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.body_html) return res.status(400).json({ error: 'Title and body required' });
    const slug = await uniqueSlug(slugify(b.slug || b.title), null);
    const tags = Array.isArray(b.tags) ? b.tags : (b.tags ? String(b.tags).split(',').map(s => s.trim()).filter(Boolean) : []);
    const { rows } = await db.query(
      `INSERT INTO blog_posts
        (slug, title, excerpt, body_html, featured_image, author_name, author_bio, author_avatar,
         tags, category, status, publish_at, seo_title, seo_description, og_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [slug, b.title, b.excerpt || null, b.body_html, b.featured_image || null,
       b.author_name || 'Local Heroes Team', b.author_bio || null, b.author_avatar || null,
       tags, b.category || 'Spotlight', b.status || 'draft', b.publish_at || null,
       b.seo_title || null, b.seo_description || null, b.og_image || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

adminRouter.put('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const tags = Array.isArray(b.tags) ? b.tags : (b.tags ? String(b.tags).split(',').map(s => s.trim()).filter(Boolean) : []);
    let slug = b.slug ? slugify(b.slug) : null;
    if (slug) slug = await uniqueSlug(slug, id);
    const { rows } = await db.query(
      `UPDATE blog_posts SET
         slug = COALESCE($1, slug),
         title = COALESCE($2, title),
         excerpt = $3,
         body_html = COALESCE($4, body_html),
         featured_image = $5,
         author_name = COALESCE($6, author_name),
         author_bio = $7,
         author_avatar = $8,
         tags = COALESCE($9, tags),
         category = COALESCE($10, category),
         status = COALESCE($11, status),
         publish_at = $12,
         seo_title = $13,
         seo_description = $14,
         og_image = $15,
         updated_at = NOW()
       WHERE id = $16 RETURNING *`,
      [slug, b.title, b.excerpt ?? null, b.body_html, b.featured_image ?? null,
       b.author_name, b.author_bio ?? null, b.author_avatar ?? null,
       tags.length ? tags : null, b.category, b.status, b.publish_at ?? null,
       b.seo_title ?? null, b.seo_description ?? null, b.og_image ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

adminRouter.delete('/posts/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Image upload (featured image / inline)
adminRouter.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/images/uploads/' + req.file.filename });
});

// Admin comment moderation
adminRouter.get('/comments', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, p.title AS post_title, p.slug AS post_slug
      FROM blog_comments c JOIN blog_posts p ON c.post_id = p.id
      ORDER BY c.created_at DESC LIMIT 200`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

adminRouter.delete('/comments/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM blog_comments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.use('/admin', adminRouter);

module.exports = router;
