const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'localheroes.db');
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

  CREATE TABLE IF NOT EXISTS crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    zipcode TEXT,
    category TEXT,
    source TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'new',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    call_date TEXT DEFAULT (datetime('now')),
    duration_minutes INTEGER,
    outcome TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    followup_date TEXT NOT NULL,
    followup_type TEXT DEFAULT 'call',
    reason TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_emails_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES crm_email_templates(id),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default email templates
const defaultTemplates = [
  ['Introduction', 'Local Heroes - Get Your Business on Every Door in {{zipcode}}',
    `Hi {{contact_name}},\n\nI'm reaching out from Local Heroes — we help Houston's best local businesses get in front of every household in their neighborhood through premium EDDM postcards.\n\nI noticed {{business_name}} in the {{zipcode}} area and think your business would be a perfect fit for our next mailing.\n\nHere's how it works:\n• We design a beautiful postcard featuring your business\n• USPS delivers it to EVERY door in your target zipcode\n• You get thousands of impressions for one flat monthly rate of $299\n\nWould you be open to a quick 5-minute call this week? I'd love to show you what our postcards look like and how other local businesses are seeing results.\n\nBest,\nLocal Heroes Team\n(713) 555-0000\nlocalheroes.com`],
  ['Pricing Follow-Up', 'Pricing Details - Local Heroes EDDM Postcards',
    `Hi {{contact_name}},\n\nGreat speaking with you! As promised, here are the details on Local Heroes:\n\n📬 Local Hero Plan — $299/month per zipcode\n\nWhat's included:\n• Featured on monthly EDDM postcard\n• Professional design (we handle everything)\n• Premium glossy card stock printing\n• USPS Every Door Direct Mail delivery\n• Listed on our LocalHeroes.com directory\n• Proof approval before printing\n• Cancel anytime — no contracts\n\nEach postcard reaches every household in your target zipcode (typically 2,000-8,000 homes). You share space with 4-6 other curated local businesses.\n\nWant to lock in a spot on next month's mailing? Just reply to this email or call us at (713) 555-0000.\n\nBest,\nLocal Heroes Team`],
  ['Follow-Up Check-In', 'Checking In - Local Heroes',
    `Hi {{contact_name}},\n\nJust checking in on our conversation about getting {{business_name}} featured on Local Heroes postcards in the {{zipcode}} area.\n\nI know things get busy — just wanted to make sure this didn't fall off your radar. Our next mailing cycle is coming up and I'd love to include you.\n\nAny questions I can answer? Happy to jump on a quick call whenever works for you.\n\nBest,\nLocal Heroes Team\n(713) 555-0000`],
  ['Post-Sign Welcome', 'Welcome to Local Heroes! 🌟',
    `Hi {{contact_name}},\n\nWelcome to Local Heroes! We're thrilled to have {{business_name}} on the team.\n\nHere's what happens next:\n\n1. Our design team will reach out within 48 hours to get your logo, photos, and the info you want featured\n2. We'll send you a proof to review and approve\n3. Your postcard goes to print and hits every door in {{zipcode}} on the next mailing cycle\n\nYou're also now listed on our LocalHeroes.com directory where residents can find you by zipcode.\n\nIf you need anything at all, just reply to this email or call (713) 555-0000.\n\nProud to have you as a Local Hero,\nThe Local Heroes Team`],
  ['Re-Engagement', 'Still interested? Special offer for {{business_name}}',
    `Hi {{contact_name}},\n\nIt's been a little while since we chatted about Local Heroes, and I wanted to reach out one more time.\n\nWe're about to finalize the postcard for the {{zipcode}} area, and there's still a spot open. I'd hate for {{business_name}} to miss out.\n\nIf timing was the issue before, I totally get it. But if you're ready to give it a shot, we'd love to have you.\n\nJust reply "I'm in" and we'll get you set up.\n\nBest,\nLocal Heroes Team\n(713) 555-0000`]
];

const insertTemplate = db.prepare(
  'INSERT OR IGNORE INTO crm_email_templates (name, subject, body) VALUES (?, ?, ?)'
);
for (const [name, subject, body] of defaultTemplates) {
  insertTemplate.run(name, subject, body);
}

// Seed default categories
const categories = [
  ['Retail Stores', 'retail-stores'],
  ['Restaurants', 'restaurants'],
  ['Medical Professionals', 'medical-professionals'],
  ['Dry Cleaners', 'dry-cleaners'],
  ['Contractors', 'contractors'],
  ['Realtors', 'realtors'],
  ['Auto Sales & Services', 'auto-sales-services'],
  ['Nurseries & Landscaping', 'nurseries-landscaping'],
  ['Churches', 'churches'],
  ['Political Campaigns', 'political-campaigns'],
  ['Coffee Shops', 'coffee-shops'],
  ['Financial Services', 'financial-services'],
  ['Galleries', 'galleries'],
  ['Home Services', 'home-services']
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
