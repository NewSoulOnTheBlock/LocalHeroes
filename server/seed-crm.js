// Seed CRM with researched Houston local businesses
// Run: node server/seed-crm.js

const db = require('./db');

const contacts = [
  // ===== 77003 - EAST END / EADO =====
  { business_name: "Huynh Restaurant", phone: "(713) 224-8964", address: "912 St Emanuel St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Beloved neighborhood Vietnamese restaurant near convention center. Every diner treated like a regular." },
  { business_name: "Tiny Champions", phone: "(713) 228-2252", address: "2 Cleburne St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Small-but-mighty EaDo spot with imaginative pizza, pasta, and sorbet. Sizable patio." },
  { business_name: "Brothers Taco House", phone: "(713) 231-5953", address: "1604 Telephone Rd, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "One of Houston's most famous Mexican eateries. Famous for picadillo, chicken chipotle, and chicharron tacos." },
  { business_name: "J-Bar-M Barbecue", phone: "(832) 380-4827", address: "2117 Leeland St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Beautiful brisket, snappy jalapeno-cheddar sausage, tender pork ribs. Magnolia Home-style interior." },
  { business_name: "District 7 Grill", phone: "(713) 225-0510", address: "1508 Hutchins St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Serving EaDo for 15+ years. Casual Urban American - oysters, Angus burgers, red fish, tenderloin steaks." },
  { business_name: "Acadian Coast", phone: "(832) 919-2000", address: "901 Hutchins St, Houston, TX 77003", zipcode: "77003", category: "Restaurants", notes: "Acadian Creole blended with American South cooking traditions." },
  { business_name: "Tout Suite", phone: "(713) 224-1211", address: "314 Main St, Houston, TX 77003", zipcode: "77003", category: "Coffee Shops", notes: "Excellent coffee and tea, beautiful pastries, strawberries & creme croissants, macarons." },

  // ===== 77006 - MONTROSE =====
  { business_name: "Montrose Chinese Restaurant", phone: "(713) 527-0568", address: "1952 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Small, quaint mom and pop serving American Chinese food. Neighborhood staple." },
  { business_name: "Niko Niko's", phone: "(713) 528-4976", address: "2520 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Houston institution for Greek food. Family-owned, been around for decades." },
  { business_name: "Dolce Vita Pizzeria Enoteca", phone: "(713) 520-8222", address: "500 Westheimer Rd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Authentic Neapolitan pizza in Montrose. Locally owned Italian." },
  { business_name: "Cuchara Restaurant", phone: "(713) 942-0000", address: "214 Fairview St, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Mexico City-inspired cuisine in Montrose. Family-run." },
  { business_name: "Nobie's", phone: "(713) 401-4333", address: "2048 Colquitt St, Houston, TX 77098", zipcode: "77006", category: "Restaurants", notes: "Tiny house restaurant serving creative American food. Neighborhood gem." },
  { business_name: "La Colombe d'Or", phone: "(713) 524-7999", address: "3410 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Restaurants", notes: "Luxury boutique hotel restaurant. Fine dining in Montrose." },
  { business_name: "The Auto Doc", phone: "(713) 524-3400", address: "1208 Montrose Blvd, Houston, TX 77006", zipcode: "77006", category: "Auto Sales & Services", notes: "Full range auto repairs, all makes and models. 2yr/24k mile warranty on parts and labor." },
  { business_name: "Montrose Tire & Wheel", phone: "(713) 521-0200", address: "2001 West Gray St, Houston, TX 77019", zipcode: "77006", category: "Auto Sales & Services", notes: "Leading mechanic shop serving Montrose, Heights, and River Oaks areas." },
  { business_name: "Autohaus K&H", phone: "(713) 523-6400", address: "1717 Bissonnet St, Houston, TX 77005", zipcode: "77006", category: "Auto Sales & Services", notes: "Independent mechanic shop serving Midtown, Downtown, and Montrose." },

  // ===== 77007 - HEIGHTS =====
  { business_name: "Coltivare", phone: "(713) 637-4095", address: "3320 White Oak Dr, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Italian restaurant with lush garden patio, minimal lighting, dark wooden walls. Locally owned." },
  { business_name: "Handies Douzo", phone: "(346) 360-7654", address: "3510 White Oak Dr, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Sushi handroll specialist in a converted house with a porch. Unique Heights spot." },
  { business_name: "Revival Market", phone: "(713) 880-8463", address: "550 Heights Blvd, Houston, TX 77007", zipcode: "77007", category: "Restaurants", notes: "Houston craft butcher shop and cafe. Breakfast and lunch. Locally sourced." },
  { business_name: "The Coffee Garden", phone: "", website: "https://thecoffeegarden.com", address: "1920 Houston Ave, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Dialed-in espresso, craft lattes, and loose leaf tea on Houston Ave." },
  { business_name: "Forth and Nomad", phone: "", website: "https://forthandnomad.com", address: "731 Yale St, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Popular Heights coffee shop on Yale St. Independent, locally owned." },
  { business_name: "Cafeza Coffee", phone: "", address: "1720 Houston Ave, Houston, TX 77007", zipcode: "77007", category: "Coffee Shops", notes: "Vibrant coffee shop with live music and homemade churros. Barcelona/Buenos Aires inspired." },
  { business_name: "Brite Touch Cleaners - Heights", phone: "(713) 868-2961", address: "822 Durham Dr, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Family-owned dry cleaning serving River Oaks, Memorial, Montrose, Heights, West U." },
  { business_name: "Wolfe Cleaners", phone: "(713) 862-9382", address: "811 Studewood St, Houston, TX 77007", zipcode: "77007", category: "Dry Cleaners", notes: "Heights location. Weekdays 7am-6:30pm, Saturday 8am-3pm. Independent." },
  { business_name: "Boulevard Realty", phone: "(713) 862-6161", website: "https://www.yourblvd.com", address: "1633 W Alabama St, Houston, TX 77006", zipcode: "77007", category: "Realtors", notes: "Houston's premier Heights real estate firm. 20+ year legacy. Led by Broker Bill Baldwin." },
  { business_name: "Norhill Realty", phone: "(713) 868-1288", website: "https://norhillrealty.com", address: "1535 Heights Blvd, Houston, TX 77008", zipcode: "77007", category: "Realtors", notes: "15+ years, top-rated Heights real estate team. Heights, River Oaks, Montrose expertise." },
  { business_name: "Joshua's Native Plants & Gardens", phone: "(713) 862-7444", address: "502 W 18th St, Houston, TX 77008", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Family-run nursery specializing in plants native to the Gulf Coast. Heights location." },
  { business_name: "Buchanan's Native Plants", phone: "(713) 861-5702", address: "611 E 11th St, Houston, TX 77008", zipcode: "77007", category: "Nurseries & Landscaping", notes: "Serving Houstonians for nearly 40 years. Native plants specialist in the Heights." },

  // ===== 77008 - HEIGHTS / SHADY ACRES =====
  { business_name: "Squable", phone: "(832) 834-7675", address: "632 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Restaurants", notes: "American restaurant from the team behind Better Luck Tomorrow, Anvil, Theodore Rex." },
  { business_name: "Boomtown Coffee", phone: "(713) 880-8663", address: "242 W 19th St, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "Local favorite for small-batch, house-roasted beans. Laid-back, artsy atmosphere." },
  { business_name: "Jo's Coffee - Heights", phone: "", website: "https://www.joscoffee.com", address: "1023 Studewood St, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "Open 7am-7pm daily. Heights location on Studewood." },
  { business_name: "Roast and Brew Cafe", phone: "", website: "https://www.roastandbrewcafetx.com", address: "1015 Heights Blvd, Houston, TX 77008", zipcode: "77008", category: "Coffee Shops", notes: "European cafe and coffeehouse serving Heights/Shady Acres community." },
  { business_name: "Heights Expert Automotive", phone: "(713) 869-1146", website: "https://www.heightsmobilcarcare.com", address: "1622 W 18th St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Proudly serving the Heights. All makes and models, foreign and domestic." },
  { business_name: "Heights Auto Repair", phone: "(713) 864-2553", website: "https://heightsautorepair.com", address: "1209 Yale St, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Honest work, affordable pricing. Independent Heights shop." },
  { business_name: "Northwest Houston Auto Repair", phone: "(713) 697-8757", website: "https://nwhoustonautorepair.com", address: "1927 N Durham Dr, Houston, TX 77008", zipcode: "77008", category: "Auto Sales & Services", notes: "Car repair and maintenance in the Heights area." },

  // ===== 77005 - WEST UNIVERSITY =====
  { business_name: "New Leaf Real Estate", phone: "(713) 523-5300", website: "https://www.newleafre.com", address: "3737 Buffalo Speedway, Houston, TX 77098", zipcode: "77005", category: "Realtors", notes: "Since 2006, most productive single-office residential real estate firm in Houston. West U, Montrose, Heights expertise." },
  { business_name: "RCW Nurseries", phone: "(281) 354-8892", address: "15809 Conroe Huffsmith Rd, Conroe, TX 77302", zipcode: "77005", category: "Nurseries & Landscaping", notes: "Leading independently owned garden center. Large selection of herbs, perennials, roses, natives." },

  // ===== 77001 - DOWNTOWN =====
  { business_name: "Lankford's Grocery & Market", phone: "(713) 522-9555", address: "88 Dennis St, Houston, TX 77006", zipcode: "77001", category: "Restaurants", notes: "Legendary Houston burger joint. Old-school diner vibes, been around for decades." },

  // ===== 77002 - MIDTOWN =====
  { business_name: "Roost", phone: "(713) 523-7667", website: "https://www.iloveroost.com", address: "1972 Fairview St, Houston, TX 77019", zipcode: "77002", category: "Restaurants", notes: "Quaint neighborhood bistro featuring farm-to-table dining. Locally owned." },

  // ===== 77004 - MUSEUM DISTRICT =====
  { business_name: "Mi Luna Tapas", phone: "(713) 520-5025", address: "2441 University Blvd, Houston, TX 77005", zipcode: "77004", category: "Restaurants", notes: "Tapas restaurant near the Museum District. Locally owned, Houston institution." },

  // ===== 77009 - NORTHSIDE =====
  { business_name: "Candelari's Pizzeria", phone: "(713) 861-6295", address: "936 Gardenia Dr, Houston, TX 77018", zipcode: "77009", category: "Restaurants", notes: "Family-owned pizzeria serving Northside. New York-style pizza." },

  // ===== 77019 - RIVER OAKS =====
  { business_name: "Greenwood King Properties", phone: "(713) 524-0888", website: "https://greenwoodking.com", address: "1616 S Voss Rd, Houston, TX 77057", zipcode: "77019", category: "Realtors", notes: "Founded 1984, privately-owned firm with 170+ agents. Houston institution." },

  // ===== 77024 - MEMORIAL =====
  { business_name: "Memorial Cleaners", phone: "(713) 468-3947", address: "14090 Memorial Dr, Houston, TX 77079", zipcode: "77024", category: "Dry Cleaners", notes: "Independent dry cleaner serving the Memorial area." },

  // ===== 77027 - GALLERIA =====
  { business_name: "HTX Group Real Estate", phone: "(832) 892-5023", website: "https://htxgroup.com", address: "2200 Post Oak Blvd, Houston, TX 77056", zipcode: "77027", category: "Realtors", notes: "Top-producing, award-winning team. 35+ years experience in greater Houston." },

  // ===== 77030 - MEDICAL CENTER =====
  { business_name: "Maas Nursery", phone: "(281) 474-2488", address: "5511 Todville Rd, Seabrook, TX 77586", zipcode: "77030", category: "Nurseries & Landscaping", notes: "Est. 1951. Full-service, 8-acre family-owned nursery in parklike setting. Serves Houston metro." },

  // ===== 77056 - UPTOWN =====
  { business_name: "Upscale Cleaners", phone: "(713) 622-1411", website: "https://www.upscalecleaners.com", address: "5535 Memorial Dr, Houston, TX 77007", zipcode: "77056", category: "Dry Cleaners", notes: "Multiple Houston locations. Premium independent dry cleaning." },

  // ===== 77080 - SPRING BRANCH =====
  { business_name: "Plants for All Seasons", phone: "(281) 376-1646", address: "22331 Tomball Pkwy, Tomball, TX 77375", zipcode: "77080", category: "Nurseries & Landscaping", notes: "Serving Houstonians since 1973. Delivery, planting, and custom potting services." },

  // ===== 77098 - UPPER KIRBY =====
  { business_name: "Shawn Manderscheid Team Realty", phone: "(713) 728-1475", address: "3939 Montrose Blvd, Houston, TX 77006", zipcode: "77098", category: "Realtors", notes: "Specializes in historic bungalows, new construction, and luxury homes. Heights, Montrose, Norhill." },
];

// Insert all contacts
const insert = db.prepare(`
  INSERT INTO crm_contacts (business_name, contact_name, phone, email, website, address, zipcode, category, source, status, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'research', 'new', ?)
`);

let count = 0;
const insertAll = db.transaction(() => {
  for (const c of contacts) {
    insert.run(
      c.business_name,
      c.contact_name || '',
      c.phone || '',
      c.email || '',
      c.website || '',
      c.address || '',
      c.zipcode,
      c.category,
      c.notes || ''
    );
    count++;
  }
});

insertAll();
console.log(`Seeded ${count} CRM contacts across Houston zipcodes.`);

// Print summary by zipcode
const summary = db.prepare(`
  SELECT zipcode, COUNT(*) as count
  FROM crm_contacts
  WHERE source = 'research'
  GROUP BY zipcode
  ORDER BY zipcode
`).all();

console.log('\nBy zipcode:');
for (const s of summary) {
  console.log(`  ${s.zipcode}: ${s.count} contacts`);
}

const catSummary = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM crm_contacts
  WHERE source = 'research'
  GROUP BY category
  ORDER BY count DESC
`).all();

console.log('\nBy category:');
for (const s of catSummary) {
  console.log(`  ${s.category}: ${s.count}`);
}
