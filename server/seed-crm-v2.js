// Seed CRM with additional researched Houston local/mom-and-pop businesses.
// Covers all 14 Local Heroes categories across the active Houston zip codes.
// Safely de-duplicates against existing crm_contacts (business_name + zipcode).
//
// Usage:
//   DATABASE_URL=postgres://... node server/seed-crm-v2.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

// Valid zipcodes (must match zipcodes table seeded in db.js)
const VALID_ZIPS = new Set([
  '77001','77002','77003','77004','77005','77006','77007','77008','77009',
  '77019','77024','77025','77027','77030','77035','77040','77042','77056',
  '77057','77077','77079','77080','77081','77084','77096','77098'
]);

const contacts = [
  // ===== RETAIL STORES =====
  { business_name: "All The Feels", phone: "", address: "3223 Milam St, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Independent Midtown/Montrose gift shop with vintage & local goods." },
  { business_name: "Amano Montrose", phone: "", address: "888 Westheimer Rd Ste 156, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Boutique with local artisan goods, run by Myrna Hagelsieb." },
  { business_name: "Bering's Hardware & Gifts", phone: "(713) 665-0500", website: "https://www.berings.com", address: "3900 Bissonnet St, Houston, TX 77005", zipcode: "77005", category: "Retail Stores", notes: "Historic family-owned hardware and gifts store since 1940." },
  { business_name: "Grogan Building Supply", phone: "(713) 862-6623", website: "https://www.groganbuildingsupply.com", address: "2419 Yale St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Family-owned hardware, lumber, home goods in the Heights." },
  { business_name: "Central City Co-Op", phone: "", address: "2515 Harvard St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Texas' oldest food co-op. Organic groceries, locally run." },
  { business_name: "The Amish Craftsman", phone: "(713) 862-3444", website: "https://amishcraftsmanfurniture.com", address: "5555 Washington Ave, Houston, TX 77007", zipcode: "77007", category: "Retail Stores", notes: "Family-owned American handmade furniture showroom." },
  { business_name: "The Guild Shop", phone: "(713) 528-5095", website: "https://theguildshop.org", address: "2009 Dunlavy St, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Consignment & antiques supporting St. John the Divine charity." },
  { business_name: "Manready Mercantile", phone: "", address: "321 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Heights men's goods, candles, leather — locally owned brand." },
  { business_name: "Big Blue Whale Toys & Curiosities", phone: "", address: "237 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Independent toy & curiosity shop on Heights' 19th Street." },
  { business_name: "Vinal Edge Records", phone: "", address: "239 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Long-running independent record store in the Heights." },
  { business_name: "Casa Ramirez FOLKART Gallery", phone: "", address: "241 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Retail Stores", notes: "Heights folk art shop celebrating Mexican & Latin American craft." },
  { business_name: "Emerson Rose Montrose", phone: "(832) 538-3703", address: "1637 Westheimer Rd, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Independent Montrose women's boutique." },
  { business_name: "Space Montrose", phone: "", address: "1706 Westheimer Rd, Houston, TX 77098", zipcode: "77098", category: "Retail Stores", notes: "Locally-owned gift shop featuring indie artists and makers." },
  { business_name: "Pavement", phone: "", address: "1657 Westheimer Rd, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Independent clothing and vintage boutique in Montrose." },
  { business_name: "Leopard Lounge Vintage Clothing", phone: "", address: "1637 Westheimer Rd, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Montrose vintage clothing, locally owned." },
  { business_name: "Saint Lo Boutique", phone: "(832) 968-4050", address: "642 Yale St Ste B, Houston, TX 77007", zipcode: "77007", category: "Retail Stores", notes: "Independent women's apparel boutique on Yale in the Heights." },
  { business_name: "Kaboom Books", phone: "(713) 869-7600", address: "3116 Houston Ave, Houston, TX 77009", zipcode: "77009", category: "Retail Stores", notes: "Beloved independent used-bookstore on the Heights/Northside border." },
  { business_name: "Magick Cauldron", phone: "(713) 523-0069", address: "2424 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Retail Stores", notes: "Longtime independent metaphysical and occult shop in Montrose." },
  { business_name: "Brazos Bookstore", phone: "(713) 523-0701", website: "https://www.brazosbookstore.com", address: "2421 Bissonnet St, Houston, TX 77005", zipcode: "77005", category: "Retail Stores", notes: "Iconic independent bookstore serving West U / Rice Village since 1974." },

  // ===== RESTAURANTS =====
  { business_name: "The Breakfast Klub", phone: "(713) 528-8561", address: "3711 Travis St, Houston, TX 77002", zipcode: "77002", category: "Restaurants", notes: "Family-owned Midtown institution famous for wings & waffles and katfish & grits." },
  { business_name: "Lucille's", phone: "(713) 568-2505", address: "5512 La Branch St, Houston, TX 77004", zipcode: "77004", category: "Restaurants", notes: "Museum District Southern fine-dining, Chef Chris Williams, family-owned." },
  { business_name: "This Is It Soul Food", phone: "(713) 659-1608", address: "2712 Blodgett St, Houston, TX 77004", zipcode: "77004", category: "Restaurants", notes: "Historic Third Ward soul-food institution, family-run since 1959." },
  { business_name: "Mama's Oven", phone: "(713) 661-3656", address: "9295 S Main St, Houston, TX 77025", zipcode: "77025", category: "Restaurants", notes: "Old-school family diner on South Main, mom-and-pop staple." },
  { business_name: "New York Bagel & Coffee Shop", phone: "(713) 723-5879", address: "9720 Hillcroft St, Houston, TX 77096", zipcode: "77096", category: "Restaurants", notes: "Family-owned Jewish deli and bagel shop — Houston institution." },
  { business_name: "Little Matt's", phone: "(832) 831-5919", address: "6203 Edloe St, Houston, TX 77005", zipcode: "77005", category: "Restaurants", notes: "Family-friendly neighborhood kitchen in West U / Bellaire." },
  { business_name: "Nancy's Hustle", phone: "(346) 571-7085", address: "2704 Polk St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Critically acclaimed EaDo bistro, locally owned." },
  { business_name: "Alturas Mexican Cafe", phone: "(713) 229-0009", address: "2409 Airline Dr, Houston, TX 77009", zipcode: "77009", category: "Restaurants", notes: "Family-run Northside Mexican cafe next to Canino's produce market." },
  { business_name: "Pho Binh", phone: "(713) 777-1770", website: "https://phobinh.com", address: "8336 Southwest Fwy, Houston, TX 77074", zipcode: "77081", category: "Restaurants", notes: "Family-owned Vietnamese pho institution since 1983 (serves Sharpstown)." },
  { business_name: "Molina's Cantina - Bellaire", phone: "(713) 432-1626", website: "https://www.molinascantina.com", address: "3801 Bellaire Blvd, Houston, TX 77025", zipcode: "77025", category: "Restaurants", notes: "Family-owned Tex-Mex mainstay since 1941." },
  { business_name: "Molina's Cantina - Westheimer", phone: "(713) 782-0861", website: "https://www.molinascantina.com", address: "7901 Westheimer Rd, Houston, TX 77063", zipcode: "77042", category: "Restaurants", notes: "Family-owned Tex-Mex since 1941, serves Westchase area." },
  { business_name: "Hughie's Tavern & Grille", phone: "(713) 869-7074", website: "https://hughiesgrille.com", address: "1802 W 18th St, Houston, TX 77008", zipcode: "77008", category: "Restaurants", notes: "Family-run Vietnamese-American tavern in the Heights." },

  // ===== MEDICAL PROFESSIONALS =====
  { business_name: "Dr. Heather Hamilton MD - Family Medicine", phone: "(713) 242-2980", address: "1431 Studemont St Ste C2-400, Houston, TX 77007", zipcode: "77007", category: "Medical Professionals", notes: "Independent family-medicine private practice in the Heights." },
  { business_name: "CORE Chiropractic", phone: "(713) 622-3300", website: "https://corechiropractic.net", address: "1770 Saint James Pl Ste 210, Houston, TX 77056", zipcode: "77056", category: "Medical Professionals", notes: "Award-winning independent chiropractic practice serving the Galleria area." },
  { business_name: "URBN Dental Uptown", phone: "(346) 570-0826", website: "https://urbndental.com", address: "2400 Mid Ln #350, Houston, TX 77027", zipcode: "77027", category: "Medical Professionals", notes: "Independent dental group — Uptown location." },
  { business_name: "URBN Dental CityCentre", phone: "(346) 570-0826", website: "https://urbndental.com", address: "12888 Queensbury Ln #124, Houston, TX 77024", zipcode: "77024", category: "Medical Professionals", notes: "Independent dental group — Memorial/CityCentre." },
  { business_name: "Dr. Dixie Yee OD", phone: "", address: "550 Heights Blvd Unit B, Houston, TX 77007", zipcode: "77007", category: "Medical Professionals", notes: "Independent optometry practice on Heights Blvd." },
  { business_name: "Dr. Bimal Patel OD", phone: "", address: "515 Westheimer Rd Ste A-2, Houston, TX 77006", zipcode: "77006", category: "Medical Professionals", notes: "Independent optometrist in Montrose." },
  { business_name: "Dr. Rania Tabet MD - Ophthalmology", phone: "(713) 379-4763", address: "4704 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Medical Professionals", notes: "Private ophthalmology practice in Montrose." },
  { business_name: "Houston Eye Associates - Gramercy", phone: "(713) 668-6828", website: "https://www.houstoneye.com", address: "2855 Gramercy St, Houston, TX 77025", zipcode: "77025", category: "Medical Professionals", notes: "Physician-owned Houston eye care group — Braeswood office." },
  { business_name: "Houston Eye Associates - Memorial City", phone: "(713) 467-6474", website: "https://www.houstoneye.com", address: "915 Gessner Rd Ste 250, Houston, TX 77024", zipcode: "77024", category: "Medical Professionals", notes: "Physician-owned eye care group — Memorial office." },
  { business_name: "Houston Eye Associates - North Loop", phone: "(713) 869-6400", website: "https://www.houstoneye.com", address: "1415 North Loop W Ste 400, Houston, TX 77008", zipcode: "77008", category: "Medical Professionals", notes: "Physician-owned eye care group — Heights/North Loop office." },
  { business_name: "Houston Eye Associates - Tanglewood", phone: "(713) 782-4406", website: "https://www.houstoneye.com", address: "590 Chimney Rock Rd, Houston, TX 77056", zipcode: "77056", category: "Medical Professionals", notes: "Physician-owned eye care group — Tanglewood office." },

  // ===== DRY CLEANERS =====
  { business_name: "River Oaks Cleaners - Memorial", phone: "(713) 650-3636", website: "http://www.riveroakscleaners.com", address: "5535 Memorial Dr Ste N, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Longstanding family-owned dry cleaner, multiple Houston locations." },
  { business_name: "River Oaks Cleaners - Bellaire", phone: "(713) 457-8500", website: "http://www.riveroakscleaners.com", address: "3907 Bellaire Blvd, Houston, TX 77025", zipcode: "77025", category: "Dry Cleaners", notes: "Family-owned dry cleaner serving Braeswood / Bellaire." },
  { business_name: "Twin Oaks Cleaners - Memorial", phone: "(713) 468-6262", website: "https://twinoakscleaners.com", address: "8793 Gaylord St, Houston, TX 77024", zipcode: "77024", category: "Dry Cleaners", notes: "Family-owned Houston dry cleaner since 1954 — Memorial location." },
  { business_name: "Twin Oaks Cleaners - Woodway", phone: "(713) 789-8871", website: "https://twinoakscleaners.com", address: "5750 Woodway Dr, Houston, TX 77057", zipcode: "77057", category: "Dry Cleaners", notes: "Family-owned dry cleaner — Tanglewood / Woodway location." },
  { business_name: "Twin Oaks Cleaners - San Felipe", phone: "(713) 622-1823", website: "https://twinoakscleaners.com", address: "3917 San Felipe St, Houston, TX 77027", zipcode: "77027", category: "Dry Cleaners", notes: "Family-owned dry cleaner — Galleria area." },
  { business_name: "Twin Oaks Cleaners - Richmond", phone: "(713) 629-6530", website: "https://twinoakscleaners.com", address: "3949 Richmond Ave, Houston, TX 77027", zipcode: "77027", category: "Dry Cleaners", notes: "Family-owned dry cleaner — Richmond/Greenway." },
  { business_name: "Twin Oaks Cleaners - Shepherd", phone: "(713) 522-8157", website: "https://twinoakscleaners.com", address: "2611 S Shepherd Dr, Houston, TX 77098", zipcode: "77098", category: "Dry Cleaners", notes: "Family-owned dry cleaner — Upper Kirby / River Oaks." },
  { business_name: "U.S. Cleaners - T.C. Jester", phone: "(713) 861-7733", address: "465 T.C. Jester Blvd, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Family-owned Heights dry cleaner with 30+ years in business." },
  { business_name: "Village Cleaners", phone: "(713) 523-5282", address: "2366 Rice Blvd Ste D, Houston, TX 77005", zipcode: "77005", category: "Dry Cleaners", notes: "Locally owned Rice Village neighborhood dry cleaner." },
  { business_name: "Clean-Smart", phone: "(713) 868-2862", website: "https://cleansmarthouston.com", address: "4808 Washington Ave, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Family-owned eco-friendly dry cleaner on Washington Ave." },
  { business_name: "Eagle Express Dry Cleaners", phone: "(713) 942-2327", address: "1756 Westheimer Rd, Houston, TX 77098", zipcode: "77098", category: "Dry Cleaners", notes: "Locally owned Montrose/Upper Kirby dry cleaner with strong reviews." },
  { business_name: "Prism Cleaners", phone: "(713) 522-6644", address: "2620 S Shepherd Dr Ste A, Houston, TX 77098", zipcode: "77098", category: "Dry Cleaners", notes: "Independent dry cleaner on Shepherd." },

  // ===== CONTRACTORS =====
  { business_name: "Prestige General Contractors", phone: "(832) 690-7240", address: "3401 Navigation Blvd, Houston, TX 77003", zipcode: "77003", category: "Contractors", notes: "Locally owned general contractor based in EaDo." },
  { business_name: "Roof Squad Roofing Contractor", phone: "", address: "19407 Park Row Ste 130, Houston, TX 77084", zipcode: "77084", category: "Contractors", notes: "Independent roofing contractor serving West Houston." },
  { business_name: "RISE Roofing Company", phone: "", address: "1909 W Lamar St, Houston, TX 77019", zipcode: "77019", category: "Contractors", notes: "Locally owned roofing contractor in River Oaks area." },
  { business_name: "Cory The Handyman Service", phone: "(281) 822-6087", address: "Houston, TX 77079", zipcode: "77079", category: "Contractors", notes: "Owner-operated handyman & light remodel service, Memorial/West Houston." },
  { business_name: "Abacus Plumbing, Air Conditioning & Electrical", phone: "(713) 766-3605", website: "https://www.abacusplumbing.net", address: "8 N Loop E, Houston, TX 77008", zipcode: "77008", category: "Contractors", notes: "Family-owned plumbing, HVAC and electrical contractor, multi-generation Houston business." },
  { business_name: "RBG Services LLC", phone: "", address: "14203 Aston St, Houston, TX 77040", zipcode: "77040", category: "Contractors", notes: "Independent electrician in Jersey Village area." },

  // ===== REALTORS =====
  { business_name: "Haussmann International Realty", phone: "", website: "https://www.hirhouston.com", address: "Houston, TX 77056", zipcode: "77056", category: "Realtors", notes: "Boutique firm — residential, retail, commercial brokerage plus investments & property management." },
  { business_name: "16th Street Realty LLC", phone: "", website: "https://www.16thstrealty.com", address: "731 W 16th St, Houston, TX 77008", zipcode: "77008", category: "Realtors", notes: "Locally-owned Heights/Oak Forest/Memorial focused boutique brokerage." },
  { business_name: "The Firm Houston", phone: "", website: "https://firmre.com", address: "Houston, TX 77098", zipcode: "77098", category: "Realtors", notes: "Boutique inside-the-Loop real estate group." },
  { business_name: "The Reyna Group", phone: "(713) 868-9300", website: "https://thereynagroup.com", address: "611 W 22nd St Ste 203, Houston, TX 77008", zipcode: "77008", category: "Realtors", notes: "Heights-based boutique real estate firm covering inner Houston." },
  { business_name: "Delcor International Realty", phone: "(832) 819-6784", website: "https://www.delcorinternationalrealty.com", address: "2603 Augusta Dr #201, Houston, TX 77057", zipcode: "77057", category: "Realtors", notes: "Internationally oriented boutique realty — Tanglewood." },

  // ===== AUTO SALES & SERVICES =====
  { business_name: "Einar's Garage", phone: "(832) 953-1307", address: "1102 Oliver St, Houston, TX 77007", zipcode: "77007", category: "Auto Sales & Services", notes: "Independent auto repair shop in the Heights." },
  { business_name: "Tech Auto Maintenance", phone: "(855) 408-4482", address: "37 Waugh Dr, Houston, TX 77007", zipcode: "77007", category: "Auto Sales & Services", notes: "Independent Houston auto shop near Memorial / Washington." },
  { business_name: "Orion Auto Service", phone: "(713) 364-1086", address: "1542 Yale St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent Heights auto service." },
  { business_name: "Heights Autohaus", phone: "(832) 426-4086", address: "1407 N Shepherd Dr, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent European auto specialist in the Heights." },
  { business_name: "RMS Auto Care", phone: "(713) 529-5855", address: "1759 Westheimer Rd, Houston, TX 77098", zipcode: "77098", category: "Auto Sales & Services", notes: "Family-owned Upper Kirby auto repair." },
  { business_name: "Modern Aircooled", phone: "(832) 582-7344", address: "1025 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent air-cooled VW/Porsche specialist in the Heights." },
  { business_name: "Sphere Motorsports", phone: "(832) 277-7062", address: "3233 W 11th St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent performance and European auto shop." },
  { business_name: "Eurocar Werk", phone: "(713) 661-6428", address: "5103 Gulfton Dr, Houston, TX 77081", zipcode: "77081", category: "Auto Sales & Services", notes: "Independent European auto service in Sharpstown/Gulfton." },
  { business_name: "European Service Center", phone: "(713) 864-5100", address: "4914 Dickson St, Houston, TX 77007", zipcode: "77007", category: "Auto Sales & Services", notes: "Independent European-brand auto repair near Washington Ave." },
  { business_name: "Metroplex Motors", phone: "(713) 777-1045", address: "5720 Bissonnet St, Houston, TX 77081", zipcode: "77081", category: "Auto Sales & Services", notes: "Independent used-car dealer in Sharpstown." },
  { business_name: "Zelaya Auto Sales", phone: "", address: "1511 N Shepherd Dr, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent used-car dealer on Shepherd in the Heights." },
  { business_name: "Uptown Motor Cars", phone: "", address: "1132 N Shepherd Dr, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Independent pre-owned auto dealer in the Heights." },

  // ===== NURSERIES & LANDSCAPING =====
  { business_name: "Tall Plants", phone: "(713) 464-8671", website: "https://tallplants.com", address: "9191 Katy Fwy, Houston, TX 77024", zipcode: "77024", category: "Nurseries & Landscaping", notes: "Family-owned nursery specializing in indoor/outdoor, patio & office plants." },
  { business_name: "Pairadice Gardens", phone: "(281) 728-1300", address: "337 Yale St, Houston, TX 77007", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Independent premium plant supplier serving landscapers & retail." },
  { business_name: "Shaw's A Cut Above", phone: "(713) 492-0445", address: "9243 Main St, Houston, TX 77025", zipcode: "77025", category: "Nurseries & Landscaping", notes: "Locally owned full-service landscaping for 20+ years — South Main." },
  { business_name: "Oak & Stone Landscapes LLC", phone: "(832) 487-6142", address: "Houston, TX 77007", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Locally-owned since 2007 — design, maintenance, irrigation, hardscapes, tree care." },

  // ===== CHURCHES =====
  { business_name: "Grace Tabernacle Church", phone: "(713) 225-4709", address: "2507 Pease St, Houston, TX 77003", zipcode: "77003", category: "Churches", notes: "Small independent neighborhood church in EaDo." },
  { business_name: "The Church at 1548 Heights", phone: "(713) 861-0922", website: "https://www.1548heights.org", address: "1548 Heights Blvd, Houston, TX 77008", zipcode: "77008", category: "Churches", notes: "Independent Heights community church." },
  { business_name: "Joyful Church House of Prayer", phone: "(713) 695-9100", address: "3906 Irvington Blvd, Houston, TX 77009", zipcode: "77009", category: "Churches", notes: "Small Northside neighborhood church." },
  { business_name: "Church of the Living God CWFF", phone: "(713) 694-5951", address: "1711 Shelby St, Houston, TX 77009", zipcode: "77009", category: "Churches", notes: "Small Northside congregation." },
  { business_name: "Joanne Herring Ministries", phone: "(713) 521-7607", address: "2121 Kirby Dr Unit 144, Houston, TX 77019", zipcode: "77019", category: "Churches", notes: "Independent ministry/church gathering in River Oaks area." },

  // ===== POLITICAL CAMPAIGNS =====
  { business_name: "Houston City Council District C - Abbie Kamin", phone: "(832) 393-3004", email: "districtc@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Inner Loop District C (Montrose/Heights/Rice U). Local elected official; potential campaign client." },
  { business_name: "Houston City Council District D - Carolyn Evans-Shabazz", phone: "(832) 393-3001", email: "districtd@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "District D (Third Ward/Museum District)." },
  { business_name: "Houston City Council District H - Mario Castillo", phone: "(832) 393-3003", email: "districth@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "District H (Heights/Northside)." },
  { business_name: "Houston City Council District I - Joaquin Martinez", phone: "(832) 393-3011", email: "districti@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "District I (East End)." },
  { business_name: "Houston City Council At-Large 1 - Julian Ramirez", phone: "(832) 393-3014", email: "atlarge1@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Citywide at-large councilmember." },
  { business_name: "Houston City Council At-Large 2 - Willie Davis", phone: "(832) 393-3013", email: "atlarge2@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Citywide at-large councilmember." },
  { business_name: "Houston City Council At-Large 3 - Twila Carter", phone: "(832) 393-3005", email: "atlarge3@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Citywide at-large councilmember." },
  { business_name: "Houston City Council At-Large 4 - Alejandra Salinas", phone: "(832) 393-3012", email: "atlarge4@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Citywide at-large councilmember." },
  { business_name: "Houston City Council At-Large 5 - Sallie Alcorn", phone: "(832) 393-3017", email: "atlarge5@houstontx.gov", address: "900 Bagby St, Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Citywide at-large councilmember." },
  { business_name: "League of Women Voters of Houston", phone: "", website: "https://www.lwvhouston.org", address: "Houston, TX 77002", zipcode: "77002", category: "Political Campaigns", notes: "Nonpartisan voter education org — publishes Houston Voters Guide." },

  // ===== COFFEE SHOPS =====
  { business_name: "Blackwater Coffee Roasters", phone: "", address: "811 Louisiana St (Lamar Tunnel), Houston, TX 77002", zipcode: "77002", category: "Coffee Shops", notes: "Independent downtown micro-roaster in the tunnels." },
  { business_name: "Common Grounds Uncommon Coffee", phone: "(713) 505-1997", address: "1401 McKinney St Ste 375, Houston, TX 77010", zipcode: "77002", category: "Coffee Shops", notes: "Independent Texas-grown coffeehouse — downtown Houston location." },
  { business_name: "OSO Coffee Co.", phone: "", website: "https://www.oso.coffee", address: "2603 Navigation Blvd, Houston, TX 77003", zipcode: "77003", category: "Coffee Shops", notes: "Independent EaDo coffee roaster and cafe." },
  { business_name: "Corazon Coffee Co.", phone: "(281) 584-3300", address: "3302 Canal St Ste 60, Houston, TX 77003", zipcode: "77003", category: "Coffee Shops", notes: "Independent East End cafe." },
  { business_name: "Retrospect Coffee Bar", phone: "(713) 993-6600", address: "3709 La Branch St, Houston, TX 77004", zipcode: "77004", category: "Coffee Shops", notes: "Independent Midtown / Museum District coffee bar." },
  { business_name: "Khon's", phone: "(713) 523-7775", address: "2808 Milam St, Houston, TX 77006", zipcode: "77006", category: "Coffee Shops", notes: "Montrose cafe/wine bar — independent & family-run." },
  { business_name: "Givral's Sandwich & Cafe", phone: "(713) 529-1736", address: "2704 Milam St, Houston, TX 77006", zipcode: "77006", category: "Coffee Shops", notes: "Family-owned Vietnamese cafe with strong coffee program in Midtown/Montrose." },
  { business_name: "Catalina Coffee", phone: "(713) 861-8448", address: "2201 Washington Ave, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Pioneering Houston third-wave independent cafe on Washington." },
  { business_name: "Antidote Coffee", phone: "", address: "729 Studewood St, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Independent Heights coffee house — longtime local favorite." },
  { business_name: "A 2nd Cup", phone: "", address: "1111 E 11th St, Houston, TX 77009", zipcode: "77009", category: "Coffee Shops", notes: "Nonprofit coffee shop fighting human trafficking — locally run." },

  // ===== FINANCIAL SERVICES =====
  { business_name: "Nguyen CPA Firm PLLC", phone: "(713) 581-8160", website: "https://www.nguyencpafirm.com", address: "5005 Woodway Dr #201, Houston, TX 77056", zipcode: "77056", category: "Financial Services", notes: "Independent CPA firm — tax, financial planning, strategy." },
  { business_name: "Cooper CPA Group", phone: "(713) 522-1040", website: "https://www.coopercpagroup.com", address: "3801 Kirby Dr Ste 720, Houston, TX 77098", zipcode: "77098", category: "Financial Services", notes: "Independent CPA firm — tax prep, planning, advisory." },
  { business_name: "Kenwood & Associates, P.C.", phone: "(713) 789-5464", website: "https://www.kenwoodpc.com", address: "820 Gessner Rd #960, Houston, TX 77024", zipcode: "77024", category: "Financial Services", notes: "Independent Memorial-area CPA and business advisory firm." },
  { business_name: "Sean K Butler, CPA, LLC", phone: "(832) 328-0874", website: "https://houstontaxservice.net", address: "Houston, TX 77007", zipcode: "77007", category: "Financial Services", notes: "Solo CPA — tax strategist and business financial advisor." },
  { business_name: "AAIGOT Insurance Agency", phone: "(713) 270-9373", address: "6633 Hillcroft St Ste 101, Houston, TX 77081", zipcode: "77081", category: "Financial Services", notes: "Independent insurance and tax-prep agency in Sharpstown." },
  { business_name: "Jaime M Humphrey CPA LLC", phone: "(713) 840-9050", address: "4615 Southwest Fwy Ste 622, Houston, TX 77027", zipcode: "77027", category: "Financial Services", notes: "Independent CPA — accounting, tax prep, financial services." },
  { business_name: "Theogony Financial, LLC", phone: "(832) 453-7260", address: "1980 Post Oak Blvd Ste 1, Houston, TX 77056", zipcode: "77056", category: "Financial Services", notes: "Independent tax prep and bookkeeping firm in Uptown." },

  // ===== GALLERIES =====
  { business_name: "Archway Gallery", phone: "(713) 522-2409", website: "https://www.archwaygallery.com", address: "2305 Dunlavy St, Houston, TX 77006", zipcode: "77006", category: "Galleries", notes: "Texas' longest-running artist-owned and operated gallery — 34 local artists." },
  { business_name: "Laura Rathe Fine Art - River Oaks District", phone: "(713) 527-7700", address: "4444 Westheimer Rd, Houston, TX 77027", zipcode: "77027", category: "Galleries", notes: "Owner-operated contemporary gallery — River Oaks District." },
  { business_name: "Laura Rathe Fine Art - Gallery Row", phone: "(713) 527-7700", address: "2707 Colquitt St, Houston, TX 77098", zipcode: "77098", category: "Galleries", notes: "Owner-operated contemporary gallery — Upper Kirby Gallery Row." },
  { business_name: "Sicardi | Ayers | Bacino Gallery", phone: "(713) 529-1313", address: "2246 Richmond Ave, Houston, TX 77098", zipcode: "77098", category: "Galleries", notes: "Independent gallery specializing in modern/contemporary Latin American art." },
  { business_name: "Sawyer Yards Art Galleries", phone: "(646) 849-6917", address: "2101 Winter St Ste A100, Houston, TX 77007", zipcode: "77007", category: "Galleries", notes: "Massive artist studio complex with many artist-owned galleries inside." },
  { business_name: "Serrano Gallery", phone: "(713) 724-0709", website: "https://www.serranogallery.com", address: "2000 Edwards St Studio 317, Houston, TX 77007", zipcode: "77007", category: "Galleries", notes: "Independent contemporary Latin American art gallery at Silver Street Studios." },
  { business_name: "Bisong Art Gallery", phone: "(713) 498-3015", website: "https://bisonggallery.com", address: "1305 Sterrett St, Houston, TX 77002", zipcode: "77002", category: "Galleries", notes: "Locally owned contemporary gallery supporting emerging and mid-career artists." },

  // ===== HOME SERVICES =====
  { business_name: "ABC Home & Commercial Services", phone: "(281) 730-9500", website: "https://www.abchomeandcommercial.com/houston", address: "4807 Katy Fwy, Houston, TX 77007", zipcode: "77007", category: "Home Services", notes: "Family-owned multi-service home business — pest, lawn, pool, painting, cleaning." },
  { business_name: "T&Z All Services", phone: "", website: "https://www.expertise.com/tx/houston/handyman", address: "Houston, TX 77025", zipcode: "77025", category: "Home Services", notes: "Locally owned handyman — plumbing, electrical, cleaning, remodeling." },
  { business_name: "Dub-Ya P Services", phone: "", website: "https://www.dubyapservices.com", address: "Houston, TX 77084", zipcode: "77084", category: "Home Services", notes: "Handyman, lawn care, pressure washing, pool services — owner-operated." },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const c of contacts) {
    if (!VALID_ZIPS.has(c.zipcode)) {
      console.warn(`  ! Skipping ${c.business_name} — zip ${c.zipcode} not in active list`);
      skipped++;
      continue;
    }

    // De-dupe: skip if a crm_contact with same name + zip already exists.
    const dupe = await pool.query(
      'SELECT id FROM crm_contacts WHERE LOWER(business_name) = LOWER($1) AND zipcode = $2 LIMIT 1',
      [c.business_name, c.zipcode]
    );
    if (dupe.rowCount > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO crm_contacts
        (business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'research','new',$9)`,
      [
        c.business_name,
        c.contact_name || '',
        c.phone || '',
        c.email || '',
        c.website || '',
        c.address || '',
        c.zipcode,
        c.category,
        c.notes || '',
      ]
    );
    inserted++;
  }

  console.log(`Inserted ${inserted} new CRM contacts (${skipped} skipped as duplicates or invalid zips).`);

  const byZip = await pool.query(
    `SELECT zipcode, COUNT(*)::int AS count
       FROM crm_contacts
       GROUP BY zipcode
       ORDER BY zipcode`
  );
  console.log('\nTotal contacts by zipcode:');
  for (const r of byZip.rows) console.log(`  ${r.zipcode}: ${r.count}`);

  const byCat = await pool.query(
    `SELECT category, COUNT(*)::int AS count
       FROM crm_contacts
       GROUP BY category
       ORDER BY count DESC`
  );
  console.log('\nTotal contacts by category:');
  for (const r of byCat.rows) console.log(`  ${r.category}: ${r.count}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
