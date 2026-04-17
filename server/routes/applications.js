const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');

// Configure file upload for logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'public', 'images', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

function nextMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7); // YYYY-MM
}

// POST /api/applications — submit a new application
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const {
      business_name, contact_name, email, phone,
      website, zipcode, category, years_in_business,
      description, why_featured, referral_code, postcard_design_id,
      mailing_month
    } = req.body;

    if (!business_name || !contact_name || !email || !phone || !zipcode || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const logoPath = req.file ? '/images/uploads/' + req.file.filename : null;
    const month = mailing_month || nextMonth();

    // Look up zipcode + category ids so we can attempt slot claim
    const { rows: zipRows } = await db.query('SELECT id, max_slots FROM zipcodes WHERE zipcode = $1', [zipcode]);
    const { rows: catRows } = await db.query(
      'SELECT id FROM categories WHERE slug = $1 OR name = $1 LIMIT 1',
      [category]
    );
    const zipRow = zipRows[0];
    const catRow = catRows[0];

    // Determine slot availability: exclusive per (zipcode, category, month)
    // AND total claimed slots for the zip/month must be < zip.max_slots
    let slotStatus = 'unknown';
    if (zipRow && catRow) {
      const { rows: existing } = await db.query(
        'SELECT id FROM postcard_slots WHERE zipcode_id=$1 AND category_id=$2 AND mailing_month=$3',
        [zipRow.id, catRow.id, month]
      );
      const { rows: totalRows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM postcard_slots WHERE zipcode_id=$1 AND mailing_month=$2',
        [zipRow.id, month]
      );
      const totalClaimed = totalRows[0].c;
      if (existing[0]) slotStatus = 'category_taken';
      else if (totalClaimed >= (zipRow.max_slots || 6)) slotStatus = 'zip_full';
      else slotStatus = 'available';
    }

    // Validate referral code if supplied
    let referralRow = null;
    if (referral_code) {
      const { rows } = await db.query(
        'SELECT * FROM referral_codes WHERE code = $1 AND active = 1',
        [referral_code.trim().toUpperCase()]
      );
      referralRow = rows[0] || null;
    }

    const initialStatus = slotStatus === 'available' ? 'pending' : 'waitlisted';

    const { rows: inserted } = await db.query(
      `INSERT INTO applications
        (business_name, contact_name, email, phone, website, zipcode, category,
         years_in_business, description, why_featured, logo_path, status,
         referral_code, postcard_design_id, mailing_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [business_name, contact_name, email, phone, website || null, zipcode, category,
       years_in_business ? parseInt(years_in_business) : null, description || null,
       why_featured || null, logoPath, initialStatus,
       referralRow ? referralRow.code : null,
       postcard_design_id ? parseInt(postcard_design_id) : null,
       month]
    );
    const appId = inserted[0].id;

    // Claim slot if available; otherwise add to waitlist
    let placement = null;
    if (slotStatus === 'available' && zipRow && catRow) {
      await db.query(
        `INSERT INTO postcard_slots (zipcode_id, category_id, mailing_month, application_id, status)
         VALUES ($1,$2,$3,$4,'pending_approval')
         ON CONFLICT (zipcode_id, category_id, mailing_month) DO NOTHING`,
        [zipRow.id, catRow.id, month, appId]
      );
      placement = 'slot_claimed';
    } else if ((slotStatus === 'category_taken' || slotStatus === 'zip_full') && zipRow && catRow) {
      await db.query(
        `INSERT INTO waitlist_entries
          (zipcode_id, category_id, mailing_month, application_id, business_name, contact_name, email, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [zipRow.id, catRow.id, month, appId, business_name, contact_name, email, phone]
      );
      placement = 'waitlisted';
    }

    // Record referral usage
    if (referralRow) {
      await db.query(
        `INSERT INTO referrals (code_id, referred_application_id, referred_email, status)
         VALUES ($1, $2, $3, 'pending')`,
        [referralRow.id, appId, email]
      );
      await db.query(
        'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = $1',
        [referralRow.id]
      );
    }

    res.status(201).json({
      id: appId,
      status: initialStatus,
      placement,
      slot_status: slotStatus,
      mailing_month: month,
      message: placement === 'waitlisted'
        ? 'You are on the waitlist for this zipcode/category — we will notify you if a slot opens.'
        : 'Application submitted successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
