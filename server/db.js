const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'localheroes.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS zipcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zipcode TEXT UNIQUE NOT NULL,
    neighborhood TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    description TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    zipcode_id INTEGER REFERENCES zipcodes(id),
    logo_url TEXT,
    featured INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    website TEXT,
    zipcode TEXT NOT NULL,
    category TEXT NOT NULL,
    years_in_business INTEGER,
    description TEXT,
    why_featured TEXT,
    logo_path TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default categories
const categories = [
  ['Home Services', 'home-services'],
  ['Restaurants & Food', 'restaurants-food'],
  ['Health & Wellness', 'health-wellness'],
  ['Auto Services', 'auto-services'],
  ['Beauty & Personal Care', 'beauty-personal-care'],
  ['Professional Services', 'professional-services'],
  ['Fitness & Recreation', 'fitness-recreation'],
  ['Retail & Shopping', 'retail-shopping'],
  ['Pet Services', 'pet-services'],
  ['Education & Tutoring', 'education-tutoring']
];

const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)'
);
for (const [name, slug] of categories) {
  insertCategory.run(name, slug);
}

// Seed some Houston zipcodes
const houstonZips = [
  ['77001', 'Downtown'],
  ['77002', 'Midtown'],
  ['77003', 'East End'],
  ['77004', 'Museum District'],
  ['77005', 'West University'],
  ['77006', 'Montrose'],
  ['77007', 'Heights'],
  ['77008', 'Heights / Shady Acres'],
  ['77009', 'Northside'],
  ['77019', 'River Oaks'],
  ['77024', 'Memorial'],
  ['77025', 'Braeswood'],
  ['77027', 'Galleria'],
  ['77030', 'Medical Center'],
  ['77035', 'Meyerland'],
  ['77040', 'Jersey Village Area'],
  ['77042', 'Westchase'],
  ['77056', 'Uptown'],
  ['77057', 'Tanglewood'],
  ['77077', 'Energy Corridor'],
  ['77079', 'Memorial West'],
  ['77080', 'Spring Branch'],
  ['77081', 'Sharpstown'],
  ['77084', 'West Houston'],
  ['77096', 'Fondren Southwest'],
  ['77098', 'Upper Kirby']
];

const insertZip = db.prepare(
  'INSERT OR IGNORE INTO zipcodes (zipcode, neighborhood) VALUES (?, ?)'
);
for (const [zip, hood] of houstonZips) {
  insertZip.run(zip, hood);
}

// Seed sample businesses for demo
const sampleBusinesses = [
  ['Heights Plumbing Co.', 'home-services', 'Reliable plumbing for the Heights community. Emergency repairs, remodels, and new installations.', '(713) 555-0101', 'info@heightsplumbing.com', 'https://heightsplumbing.com', '1234 Yale St, Houston, TX 77008', '77008'],
  ['Montrose Bistro', 'restaurants-food', 'Farm-to-table dining in the heart of Montrose. Locally sourced, globally inspired.', '(713) 555-0202', 'hello@montrosebistro.com', 'https://montrosebistro.com', '456 Westheimer Rd, Houston, TX 77006', '77006'],
  ['Memorial Fitness Club', 'fitness-recreation', 'Your neighborhood gym with personal training, group classes, and a welcoming community.', '(713) 555-0303', 'join@memorialfitness.com', 'https://memorialfitness.com', '789 Memorial Dr, Houston, TX 77024', '77024'],
  ['West U Pediatric Dentistry', 'health-wellness', 'Gentle dental care for kids in West University. Making smiles brighter since 2010.', '(713) 555-0404', 'smile@westupdentist.com', 'https://westupdentist.com', '321 University Blvd, Houston, TX 77005', '77005'],
  ['Galleria Auto Spa', 'auto-services', 'Premium detailing and car care near the Galleria. Hand wash, ceramic coating, paint correction.', '(713) 555-0505', 'book@galleriaauto.com', 'https://galleriaauto.com', '555 Post Oak Blvd, Houston, TX 77027', '77027'],
  ['River Oaks Pet Resort', 'pet-services', 'Luxury boarding, grooming, and daycare for your four-legged family members.', '(713) 555-0606', 'woof@riveroakspets.com', 'https://riveroakspets.com', '888 Kirby Dr, Houston, TX 77019', '77019']
];

const getCategory = db.prepare('SELECT id FROM categories WHERE slug = ?');
const getZipcode = db.prepare('SELECT id FROM zipcodes WHERE zipcode = ?');
const countBusinesses = db.prepare('SELECT COUNT(*) as count FROM businesses');
const insertBusiness = db.prepare(`
  INSERT INTO businesses (name, category_id, description, phone, email, website, address, zipcode_id, featured, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
`);

if (countBusinesses.get().count === 0) {
  for (const [name, catSlug, desc, phone, email, website, address, zip] of sampleBusinesses) {
    const cat = getCategory.get(catSlug);
    const zc = getZipcode.get(zip);
    if (cat && zc) {
      insertBusiness.run(name, cat.id, desc, phone, email, website, address, zc.id);
    }
  }
}

module.exports = db;
