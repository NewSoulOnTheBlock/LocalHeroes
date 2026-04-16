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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST /api/applications — submit a new application
router.post('/', upload.single('logo'), (req, res) => {
  const {
    business_name, contact_name, email, phone,
    website, zipcode, category, years_in_business,
    description, why_featured
  } = req.body;

  if (!business_name || !contact_name || !email || !phone || !zipcode || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const logoPath = req.file ? '/images/uploads/' + req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO applications (business_name, contact_name, email, phone, website, zipcode, category, years_in_business, description, why_featured, logo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(business_name, contact_name, email, phone, website, zipcode, category, years_in_business || null, description, why_featured, logoPath);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Application submitted successfully' });
});

module.exports = router;
