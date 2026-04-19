const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/local_heroes';
const needsSSL = /render\.com|amazonaws|heroku/.test(connectionString) || process.env.PGSSL === '1';

const pool = new Pool({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false
});

const query = (text, params) => pool.query(text, params);

async function init() {
  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zipcodes (
      id SERIAL PRIMARY KEY,
      zipcode TEXT UNIQUE NOT NULL,
      neighborhood TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_contacts (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_calls (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      call_date TIMESTAMPTZ DEFAULT NOW(),
      duration_minutes INTEGER,
      outcome TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_followups (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      followup_date TEXT NOT NULL,
      followup_type TEXT DEFAULT 'call',
      reason TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_activities (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      metadata TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_email_templates (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_emails_sent (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES crm_email_templates(id),
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS salespeople (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      is_admin INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Postcard slot tracking (feature: waitlist + category exclusivity)
    CREATE TABLE IF NOT EXISTS postcard_slots (
      id SERIAL PRIMARY KEY,
      zipcode_id INTEGER NOT NULL REFERENCES zipcodes(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      mailing_month TEXT NOT NULL,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'claimed',
      claimed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(zipcode_id, category_id, mailing_month)
    );

    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id SERIAL PRIMARY KEY,
      zipcode_id INTEGER NOT NULL REFERENCES zipcodes(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      mailing_month TEXT NOT NULL,
      application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
      business_name TEXT,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      notified INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Referral program (feature: referrals)
    CREATE TABLE IF NOT EXISTS referral_codes (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      owner_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      owner_salesperson_id INTEGER REFERENCES salespeople(id) ON DELETE SET NULL,
      owner_email TEXT,
      reward_cents INTEGER DEFAULT 5000,
      discount_cents INTEGER DEFAULT 5000,
      active INTEGER DEFAULT 1,
      times_used INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      code_id INTEGER NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
      referred_application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      referred_email TEXT,
      status TEXT DEFAULT 'pending',
      reward_paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Sales rep territories + commissions (feature: territory CRM)
    CREATE TABLE IF NOT EXISTS sales_territories (
      id SERIAL PRIMARY KEY,
      salesperson_id INTEGER NOT NULL REFERENCES salespeople(id) ON DELETE CASCADE,
      zipcode_id INTEGER NOT NULL REFERENCES zipcodes(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(salesperson_id, zipcode_id)
    );

    CREATE TABLE IF NOT EXISTS sales_commissions (
      id SERIAL PRIMARY KEY,
      salesperson_id INTEGER NOT NULL REFERENCES salespeople(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      amount_cents INTEGER NOT NULL,
      period TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );
  `);

  // Blog (Heroes) tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      body_html TEXT NOT NULL,
      featured_image TEXT,
      author_name TEXT DEFAULT 'Local Heroes Team',
      author_bio TEXT,
      author_avatar TEXT,
      tags TEXT[] DEFAULT '{}',
      category TEXT DEFAULT 'Spotlight',
      status TEXT NOT NULL DEFAULT 'draft',
      publish_at TIMESTAMPTZ,
      seo_title TEXT,
      seo_description TEXT,
      og_image TEXT,
      like_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status_publish ON blog_posts(status, publish_at);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

    CREATE TABLE IF NOT EXISTS blog_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_email TEXT,
      body TEXT NOT NULL,
      approved BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(post_id, created_at);

    CREATE TABLE IF NOT EXISTS blog_likes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      ip TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (post_id, ip)
    );
  `);

  // Additive columns on pre-existing tables (idempotent)
  await pool.query(`
    ALTER TABLE zipcodes   ADD COLUMN IF NOT EXISTS household_count   INTEGER DEFAULT 3500;
    ALTER TABLE zipcodes   ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER DEFAULT 29900;
    ALTER TABLE zipcodes   ADD COLUMN IF NOT EXISTS max_slots         INTEGER DEFAULT 6;
    ALTER TABLE zipcodes   ADD COLUMN IF NOT EXISTS center_lat        DOUBLE PRECISION;
    ALTER TABLE zipcodes   ADD COLUMN IF NOT EXISTS center_lng        DOUBLE PRECISION;
    ALTER TABLE crm_contacts  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'new';
    ALTER TABLE applications  ADD COLUMN IF NOT EXISTS referral_code TEXT;
    ALTER TABLE applications  ADD COLUMN IF NOT EXISTS mailing_month TEXT;
  `);

  // Additive columns for salesperson attribution (idempotent)
  await pool.query(`
    ALTER TABLE crm_contacts   ADD COLUMN IF NOT EXISTS commission_salesperson_id INTEGER REFERENCES salespeople(id);
    ALTER TABLE crm_contacts   ADD COLUMN IF NOT EXISTS commission_claimed_at     TIMESTAMPTZ;
    ALTER TABLE crm_calls      ADD COLUMN IF NOT EXISTS salesperson_id INTEGER REFERENCES salespeople(id);
    ALTER TABLE crm_followups  ADD COLUMN IF NOT EXISTS salesperson_id INTEGER REFERENCES salespeople(id);
    ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS salesperson_id INTEGER REFERENCES salespeople(id);
    ALTER TABLE crm_emails_sent ADD COLUMN IF NOT EXISTS salesperson_id INTEGER REFERENCES salespeople(id);
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

  for (const [name, subject, body] of defaultTemplates) {
    await pool.query(
      'INSERT INTO crm_email_templates (name, subject, body) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, subject, body]
    );
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

  for (const [name, slug] of categories) {
    await pool.query(
      'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, slug]
    );
  }

  // Seed Houston zipcodes
  const houstonZips = [
    ['77001', 'Downtown'], ['77002', 'Midtown'], ['77003', 'East End'],
    ['77004', 'Museum District'], ['77005', 'West University'], ['77006', 'Montrose'],
    ['77007', 'Heights'], ['77008', 'Heights / Shady Acres'], ['77009', 'Northside'],
    ['77019', 'River Oaks'], ['77024', 'Memorial'], ['77025', 'Braeswood'],
    ['77027', 'Galleria'], ['77030', 'Medical Center'], ['77035', 'Meyerland'],
    ['77040', 'Jersey Village Area'], ['77042', 'Westchase'], ['77056', 'Uptown'],
    ['77057', 'Tanglewood'], ['77077', 'Energy Corridor'], ['77079', 'Memorial West'],
    ['77080', 'Spring Branch'], ['77081', 'Sharpstown'], ['77084', 'West Houston'],
    ['77096', 'Fondren Southwest'], ['77098', 'Upper Kirby']
  ];

  for (const [zip, hood] of houstonZips) {
    await pool.query(
      'INSERT INTO zipcodes (zipcode, neighborhood) VALUES ($1, $2) ON CONFLICT (zipcode) DO NOTHING',
      [zip, hood]
    );
  }

  // Seed Houston zip centroids + household estimates (approximate real-world values)
  const zipGeo = {
    '77001': { lat: 29.7589, lng: -95.3677, hh: 50,   price: 19900, max: 4 },
    '77002': { lat: 29.7570, lng: -95.3634, hh: 6500, price: 34900, max: 6 },
    '77003': { lat: 29.7498, lng: -95.3468, hh: 5200, price: 27900, max: 6 },
    '77004': { lat: 29.7259, lng: -95.3637, hh: 14200, price: 29900, max: 6 },
    '77005': { lat: 29.7169, lng: -95.4227, hh: 9800,  price: 34900, max: 6 },
    '77006': { lat: 29.7413, lng: -95.3905, hh: 13500, price: 32900, max: 6 },
    '77007': { lat: 29.7739, lng: -95.4007, hh: 18200, price: 32900, max: 6 },
    '77008': { lat: 29.8017, lng: -95.4120, hh: 15500, price: 32900, max: 6 },
    '77009': { lat: 29.7998, lng: -95.3612, hh: 14400, price: 27900, max: 6 },
    '77019': { lat: 29.7530, lng: -95.4094, hh: 10600, price: 36900, max: 5 },
    '77024': { lat: 29.7656, lng: -95.5234, hh: 18800, price: 36900, max: 6 },
    '77025': { lat: 29.6832, lng: -95.4432, hh: 12900, price: 29900, max: 6 },
    '77027': { lat: 29.7431, lng: -95.4428, hh: 10200, price: 34900, max: 6 },
    '77030': { lat: 29.7089, lng: -95.4002, hh: 4900,  price: 27900, max: 6 },
    '77035': { lat: 29.6531, lng: -95.4755, hh: 14300, price: 25900, max: 6 },
    '77040': { lat: 29.8611, lng: -95.5498, hh: 16700, price: 24900, max: 6 },
    '77042': { lat: 29.7437, lng: -95.5739, hh: 21500, price: 26900, max: 6 },
    '77056': { lat: 29.7498, lng: -95.4637, hh: 11800, price: 34900, max: 6 },
    '77057': { lat: 29.7391, lng: -95.4930, hh: 19200, price: 29900, max: 6 },
    '77077': { lat: 29.7503, lng: -95.6128, hh: 22400, price: 27900, max: 6 },
    '77079': { lat: 29.7698, lng: -95.6078, hh: 17300, price: 32900, max: 6 },
    '77080': { lat: 29.8212, lng: -95.5367, hh: 20100, price: 24900, max: 6 },
    '77081': { lat: 29.7098, lng: -95.4897, hh: 18900, price: 23900, max: 6 },
    '77084': { lat: 29.8353, lng: -95.6657, hh: 31200, price: 26900, max: 6 },
    '77096': { lat: 29.6712, lng: -95.4987, hh: 15100, price: 26900, max: 6 },
    '77098': { lat: 29.7356, lng: -95.4180, hh: 9400,  price: 32900, max: 5 }
  };
  for (const [zip, g] of Object.entries(zipGeo)) {
    await pool.query(
      `UPDATE zipcodes SET center_lat = $1, center_lng = $2,
         household_count = COALESCE(NULLIF(household_count,0), $3),
         monthly_price_cents = COALESCE(NULLIF(monthly_price_cents,0), $4),
         max_slots = COALESCE(NULLIF(max_slots,0), $5)
       WHERE zipcode = $6`,
      [g.lat, g.lng, g.hh, g.price, g.max, zip]
    );
  }

  // Seed sample businesses (only if empty)
  const { rows: bizCount } = await pool.query('SELECT COUNT(*) as count FROM businesses');
  if (parseInt(bizCount[0].count) === 0) {
    const sampleBusinesses = [
      ['Heights Plumbing Co.', 'home-services', 'Reliable plumbing for the Heights community. Emergency repairs, remodels, and new installations.', '(713) 555-0101', 'info@heightsplumbing.com', 'https://heightsplumbing.com', '1234 Yale St, Houston, TX 77008', '77008'],
      ['Montrose Bistro', 'restaurants-food', 'Farm-to-table dining in the heart of Montrose. Locally sourced, globally inspired.', '(713) 555-0202', 'hello@montrosebistro.com', 'https://montrosebistro.com', '456 Westheimer Rd, Houston, TX 77006', '77006'],
      ['Memorial Fitness Club', 'fitness-recreation', 'Your neighborhood gym with personal training, group classes, and a welcoming community.', '(713) 555-0303', 'join@memorialfitness.com', 'https://memorialfitness.com', '789 Memorial Dr, Houston, TX 77024', '77024'],
      ['West U Pediatric Dentistry', 'health-wellness', 'Gentle dental care for kids in West University. Making smiles brighter since 2010.', '(713) 555-0404', 'smile@westupdentist.com', 'https://westupdentist.com', '321 University Blvd, Houston, TX 77005', '77005'],
      ['Galleria Auto Spa', 'auto-services', 'Premium detailing and car care near the Galleria. Hand wash, ceramic coating, paint correction.', '(713) 555-0505', 'book@galleriaauto.com', 'https://galleriaauto.com', '555 Post Oak Blvd, Houston, TX 77027', '77027'],
      ['River Oaks Pet Resort', 'pet-services', 'Luxury boarding, grooming, and daycare for your four-legged family members.', '(713) 555-0606', 'woof@riveroakspets.com', 'https://riveroakspets.com', '888 Kirby Dr, Houston, TX 77019', '77019']
    ];

    for (const [name, catSlug, desc, phone, email, website, address, zip] of sampleBusinesses) {
      const catRes = await pool.query('SELECT id FROM categories WHERE slug = $1', [catSlug]);
      const zipRes = await pool.query('SELECT id FROM zipcodes WHERE zipcode = $1', [zip]);
      if (catRes.rows[0] && zipRes.rows[0]) {
        await pool.query(
          'INSERT INTO businesses (name, category_id, description, phone, email, website, address, zipcode_id, featured, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1)',
          [name, catRes.rows[0].id, desc, phone, email, website, address, zipRes.rows[0].id]
        );
      }
    }
  }

  // Seed CRM contacts (only if empty)
  const { rows: crmCount } = await pool.query('SELECT COUNT(*) as count FROM crm_contacts');
  if (parseInt(crmCount[0].count) === 0) {
    const contacts = [
      { business_name: "Huynh Restaurant", phone: "(713) 224-8964", address: "912 St Emanuel St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Beloved neighborhood Vietnamese restaurant near convention center." },
      { business_name: "Tiny Champions", phone: "(713) 228-2252", address: "2 Cleburne St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Small-but-mighty EaDo spot with imaginative pizza, pasta, and sorbet." },
      { business_name: "Brothers Taco House", phone: "(713) 231-5953", address: "1604 Telephone Rd, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "One of Houston's most famous Mexican eateries." },
      { business_name: "J-Bar-M Barbecue", phone: "(832) 380-4827", address: "2117 Leeland St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Beautiful brisket, snappy jalapeno-cheddar sausage." },
      { business_name: "District 7 Grill", phone: "(713) 225-0510", address: "1508 Hutchins St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Serving EaDo for 15+ years." },
      { business_name: "Acadian Coast", phone: "(832) 919-2000", address: "901 Hutchins St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Acadian Creole blended with American South cooking." },
      { business_name: "Tout Suite", phone: "(713) 224-1211", address: "314 Main St, Houston, TX 77003", zipcode: "77003", category: "Coffee Shops", notes: "Excellent coffee, beautiful pastries, macarons." },
      { business_name: "Montrose Chinese Restaurant", phone: "(713) 527-0568", address: "1952 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Small, quaint mom and pop American Chinese food." },
      { business_name: "Niko Niko's", phone: "(713) 528-4976", address: "2520 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Houston institution for Greek food. Family-owned." },
      { business_name: "Dolce Vita Pizzeria Enoteca", phone: "(713) 520-8222", address: "500 Westheimer Rd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Authentic Neapolitan pizza in Montrose." },
      { business_name: "Cuchara Restaurant", phone: "(713) 942-0000", address: "214 Fairview St, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Mexico City-inspired cuisine. Family-run." },
      { business_name: "Nobie's", phone: "(713) 401-4333", address: "2048 Colquitt St, Houston, TX 77098", zipcode: "77006", category: "Restaurants", notes: "Tiny house restaurant serving creative American food." },
      { business_name: "La Colombe d'Or", phone: "(713) 524-7999", address: "3410 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Luxury boutique hotel restaurant." },
      { business_name: "The Auto Doc", phone: "(713) 524-3400", address: "1208 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Auto Sales & Services", notes: "Full range auto repairs. 2yr/24k mile warranty." },
      { business_name: "Montrose Tire & Wheel", phone: "(713) 521-0200", address: "2001 West Gray St, Houston, TX 77019", zipcode: "77006", category: "Auto Sales & Services", notes: "Leading mechanic serving Montrose, Heights, River Oaks." },
      { business_name: "Autohaus K&H", phone: "(713) 523-6400", address: "1717 Bissonnet St, Houston, TX 77005", zipcode: "77006", category: "Auto Sales & Services", notes: "Independent mechanic serving Midtown, Downtown, Montrose." },
      { business_name: "Coltivare", phone: "(713) 637-4095", address: "3320 White Oak Dr, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Italian restaurant with lush garden patio." },
      { business_name: "Handies Douzo", phone: "(346) 360-7654", address: "3510 White Oak Dr, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Sushi handroll specialist in a converted house." },
      { business_name: "Revival Market", phone: "(713) 880-8463", address: "550 Heights Blvd, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Houston craft butcher shop and cafe." },
      { business_name: "The Coffee Garden", phone: "", address: "1920 Houston Ave, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Dialed-in espresso, craft lattes on Houston Ave." },
      { business_name: "Forth and Nomad", phone: "", address: "731 Yale St, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Popular Heights coffee shop on Yale St." },
      { business_name: "Cafeza Coffee", phone: "", address: "1720 Houston Ave, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Vibrant coffee shop with live music and churros." },
      { business_name: "Brite Touch Cleaners - Heights", phone: "(713) 868-2961", address: "822 Durham Dr, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Family-owned dry cleaning." },
      { business_name: "Wolfe Cleaners", phone: "(713) 862-9382", address: "811 Studewood St, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Heights location. Independent." },
      { business_name: "Boulevard Realty", phone: "(713) 862-6161", address: "1633 W Alabama St, Houston, TX 77006", zipcode: "77007", category: "Realtors", notes: "Houston's premier Heights real estate firm. 20+ year legacy." },
      { business_name: "Norhill Realty", phone: "(713) 868-1288", address: "1535 Heights Blvd, Houston, TX 77008", zipcode: "77007", category: "Realtors", notes: "15+ years, top-rated Heights real estate team." },
      { business_name: "Joshua's Native Plants & Gardens", phone: "(713) 862-7444", address: "502 W 18th St, Houston, TX 77008", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Family-run nursery specializing in Gulf Coast natives." },
      { business_name: "Buchanan's Native Plants", phone: "(713) 861-5702", address: "611 E 11th St, Houston, TX 77008", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Serving Houstonians for nearly 40 years." },
      { business_name: "Squable", phone: "(832) 834-7675", address: "632 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Restaurants", notes: "American restaurant from the team behind Anvil, Theodore Rex." },
      { business_name: "Boomtown Coffee", phone: "(713) 880-8663", address: "242 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "Local favorite for small-batch, house-roasted beans." },
      { business_name: "Jo's Coffee - Heights", phone: "", address: "1023 Studewood St, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "Heights location on Studewood." },
      { business_name: "Roast and Brew Cafe", phone: "", address: "1015 Heights Blvd, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "European cafe serving Heights/Shady Acres." },
      { business_name: "Heights Expert Automotive", phone: "(713) 869-1146", address: "1622 W 18th St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "All makes and models, foreign and domestic." },
      { business_name: "Heights Auto Repair", phone: "(713) 864-2553", address: "1209 Yale St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Honest work, affordable pricing." },
      { business_name: "Northwest Houston Auto Repair", phone: "(713) 697-8757", address: "1927 N Durham Dr, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Car repair and maintenance in the Heights area." },
      { business_name: "New Leaf Real Estate", phone: "(713) 523-5300", address: "3737 Buffalo Speedway, Houston, TX 77098", zipcode: "77005", category: "Realtors", notes: "Most productive single-office residential firm in Houston." },
      { business_name: "RCW Nurseries", phone: "(281) 354-8892", address: "15809 Conroe Huffsmith Rd, Conroe, TX 77302", zipcode: "77005", category: "Nurseries & Landscaping", notes: "Leading independently owned garden center." },
      { business_name: "Lankford's Grocery & Market", phone: "(713) 522-9555", address: "88 Dennis St, Houston, TX 77006", zipcode: "77001", category: "Restaurants", notes: "Legendary Houston burger joint." },
      { business_name: "Roost", phone: "(713) 523-7667", address: "1972 Fairview St, Houston, TX 77019", zipcode: "77002", category: "Restaurants", notes: "Quaint neighborhood bistro, farm-to-table." },
      { business_name: "Mi Luna Tapas", phone: "(713) 520-5025", address: "2441 University Blvd, Houston, TX 77005", zipcode: "77004", category: "Restaurants", notes: "Tapas restaurant near the Museum District." },
      { business_name: "Candelari's Pizzeria", phone: "(713) 861-6295", address: "936 Gardenia Dr, Houston, TX 77018", zipcode: "77009", category: "Restaurants", notes: "Family-owned pizzeria. New York-style pizza." },
      { business_name: "Greenwood King Properties", phone: "(713) 524-0888", address: "1616 S Voss Rd, Houston, TX 77057", zipcode: "77019", category: "Realtors", notes: "Founded 1984, 170+ agents. Houston institution." },
      { business_name: "Memorial Cleaners", phone: "(713) 468-3947", address: "14090 Memorial Dr, Houston, TX 77079", zipcode: "77024", category: "Dry Cleaners", notes: "Independent dry cleaner serving Memorial." },
      { business_name: "HTX Group Real Estate", phone: "(832) 892-5023", address: "2200 Post Oak Blvd, Houston, TX 77056", zipcode: "77027", category: "Realtors", notes: "35+ years experience in greater Houston." },
      { business_name: "Maas Nursery", phone: "(281) 474-2488", address: "5511 Todville Rd, Seabrook, TX 77586", zipcode: "77030", category: "Nurseries & Landscaping", notes: "Est. 1951. 8-acre family-owned nursery." },
      { business_name: "Upscale Cleaners", phone: "(713) 622-1411", address: "5535 Memorial Dr, Houston, TX 77007", zipcode: "77056", category: "Dry Cleaners", notes: "Multiple Houston locations. Premium independent." },
      { business_name: "Plants for All Seasons", phone: "(281) 376-1646", address: "22331 Tomball Pkwy, Tomball, TX 77375", zipcode: "77080", category: "Nurseries & Landscaping", notes: "Serving Houstonians since 1973." },
      { business_name: "Shawn Manderscheid Team Realty", phone: "(713) 728-1475", address: "3939 Montrose Blvd, Houston, TX 77006", zipcode: "77098", category: "Realtors", notes: "Specializes in historic bungalows, new construction, luxury homes." }
    ];

    for (const c of contacts) {
      await pool.query(
        `INSERT INTO crm_contacts (business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'research', 'new', $9)`,
        [c.business_name, c.contact_name || '', c.phone || '', c.email || '', c.website || '', c.address || '', c.zipcode, c.category, c.notes || '']
      );
    }
  }

  console.log('Database initialized and seeded.');
}

module.exports = { query, init, pool };
