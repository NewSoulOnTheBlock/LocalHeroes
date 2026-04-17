/* Local Heroes - Main Frontend JS */

// Inject site-wide video background (runs before DOMContentLoaded paint)
(function injectBgVideo() {
  if (document.querySelector('.bg-video')) return;
  const tint = document.createElement('div');
  tint.className = 'bg-video-tint';
  const v = document.createElement('video');
  v.className = 'bg-video';
  v.src = '/images/bg-video.mp4';
  v.autoplay = true;
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('aria-hidden', 'true');
  const insert = () => {
    document.body.prepend(tint);
    document.body.prepend(v);
  };
  if (document.body) insert();
  else document.addEventListener('DOMContentLoaded', insert, { once: true });
})();

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      nav.classList.toggle('open');
    });
    // Close nav when clicking a link
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        nav.classList.remove('open');
      });
    });
  }

  // Header scroll effect
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 10
        ? '0 4px 20px rgba(0,0,0,0.15)'
        : '0 4px 12px rgba(0,0,0,0.1)';
    });
  }

  // --- Homepage Zipcode Quick Lookup ---
  const heroZipInput = document.getElementById('hero-zip-input');
  const heroZipBtn = document.getElementById('hero-zip-btn');
  const heroZipResults = document.getElementById('hero-zip-results');

  if (heroZipBtn && heroZipInput) {
    heroZipBtn.addEventListener('click', () => searchHeroZip());
    heroZipInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchHeroZip();
    });
  }

  async function searchHeroZip() {
    const zip = heroZipInput.value.trim();
    if (!/^\d{5}$/.test(zip)) {
      heroZipResults.innerHTML = '<div class="zip-no-results">Please enter a valid 5-digit zipcode.</div>';
      return;
    }

    try {
      const res = await fetch(`/api/businesses?zipcode=${zip}`);
      const businesses = await res.json();

      if (businesses.length === 0) {
        heroZipResults.innerHTML = `
          <div class="zip-no-results">
            <p>No Local Heroes in <strong>${zip}</strong> yet.</p>
            <p style="margin-top:8px;"><a href="apply.html" style="color:var(--color-rust);font-weight:600;">Know a great business here? Tell them to apply!</a></p>
          </div>`;
        return;
      }

      heroZipResults.innerHTML = `
        <p style="margin-bottom:16px;font-weight:600;">${businesses.length} Local Hero${businesses.length > 1 ? 'es' : ''} in ${zip} (${businesses[0].neighborhood || ''}):</p>
        <div class="card-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">
          ${businesses.map(b => businessCardHTML(b)).join('')}
        </div>
        <div style="text-align:center;margin-top:24px;">
          <a href="find.html" class="btn btn-navy">See All Neighborhoods</a>
        </div>`;
    } catch (err) {
      heroZipResults.innerHTML = '<div class="zip-no-results">Something went wrong. Please try again.</div>';
    }
  }

  // --- Find Page: Zipcode Search ---
  const zipInput = document.getElementById('zip-input');
  const zipSearchBtn = document.getElementById('zip-search-btn');
  const searchResults = document.getElementById('search-results');
  const noResults = document.getElementById('no-results');
  const resultsTitle = document.getElementById('results-title');
  const resultsSubtitle = document.getElementById('results-subtitle');
  const resultsGrid = document.getElementById('results-grid');
  const zipcodeList = document.getElementById('zipcode-list');

  if (zipSearchBtn && zipInput) {
    zipSearchBtn.addEventListener('click', () => searchZip());
    zipInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchZip();
    });

    // Load zipcode grid
    loadZipcodes();
  }

  async function loadZipcodes() {
    try {
      const res = await fetch('/api/zipcodes');
      const zips = await res.json();
      if (zipcodeList) {
        zipcodeList.innerHTML = zips.map(z => `
          <div class="card" style="padding:20px;cursor:pointer;text-align:center;" onclick="document.getElementById('zip-input').value='${z.zipcode}';document.getElementById('zip-search-btn').click();">
            <h4 style="margin-bottom:4px;">${z.zipcode}</h4>
            <p style="font-size:0.85rem;color:var(--color-text-light);margin-bottom:4px;">${z.neighborhood || ''}</p>
            <span style="font-size:0.8rem;color:var(--color-rust);font-weight:600;">${z.business_count} hero${z.business_count !== 1 ? 'es' : ''}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      // Silent fail for zipcode grid
    }
  }

  async function searchZip() {
    const zip = zipInput.value.trim();
    if (!/^\d{5}$/.test(zip)) return;

    try {
      const res = await fetch(`/api/businesses?zipcode=${zip}`);
      const businesses = await res.json();

      if (businesses.length === 0) {
        searchResults.style.display = 'none';
        noResults.style.display = 'block';
        return;
      }

      noResults.style.display = 'none';
      searchResults.style.display = 'block';
      resultsTitle.textContent = `Local Heroes in ${zip}`;
      resultsSubtitle.textContent = businesses[0].neighborhood
        ? `${businesses[0].neighborhood} — ${businesses.length} featured business${businesses.length > 1 ? 'es' : ''}`
        : `${businesses.length} featured business${businesses.length > 1 ? 'es' : ''}`;
      resultsGrid.innerHTML = businesses.map(b => businessCardHTML(b)).join('');
    } catch (err) {
      noResults.style.display = 'block';
      searchResults.style.display = 'none';
    }
  }

  // --- Apply Page: Load Categories ---
  const applyCategory = document.getElementById('apply-category');
  if (applyCategory) {
    fetch('/api/categories')
      .then(res => res.json())
      .then(cats => {
        cats.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          applyCategory.appendChild(opt);
        });
      });
  }

  // --- Apply Form: zipcode prefill, live availability, referral validation ---
  const applyZip = document.getElementById('apply-zipcode');
  const applyCat = document.getElementById('apply-category');
  const applyAvail = document.getElementById('apply-availability');
  const applyRef = document.getElementById('apply-referral');
  const applyRefMsg = document.getElementById('apply-referral-msg');

  if (applyZip) {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('zipcode');
    if (prefill && /^\d{5}$/.test(prefill)) applyZip.value = prefill;

    const refresh = async () => {
      if (!applyAvail) return;
      const z = applyZip.value.trim();
      const catName = applyCat && applyCat.value ? applyCat.value : '';
      if (!/^\d{5}$/.test(z)) { applyAvail.innerHTML = ''; return; }
      try {
        const r = await fetch(`/api/slots/availability?zipcode=${z}`);
        if (!r.ok) { applyAvail.innerHTML = ''; return; }
        const d = await r.json();
        const price = d.monthly_price_cents ? `$${(d.monthly_price_cents/100).toFixed(0)}/mo` : '';
        let header = `<div style="color:var(--color-text-light);">${d.neighborhood || z} · ~${(d.household_count||0).toLocaleString()} households · ${price} · ${d.slots_remaining}/${d.max_slots} slots left for ${d.mailing_month}</div>`;
        let line = '';
        if (catName) {
          const cat = (d.categories || []).find(c => c.name === catName || c.slug === catName);
          if (cat && cat.available) {
            line = `<div style="color:#0a7d3a;font-weight:600;">✓ "${catName}" is open for ${d.mailing_month}.</div>`;
          } else if (cat && cat.taken) {
            line = `<div style="color:#b5532a;font-weight:600;">"${catName}" is taken in ${z} for ${d.mailing_month}. You'll be added to the waitlist (${cat.waitlist_count} ahead).</div>`;
          } else if (d.zip_full) {
            line = `<div style="color:#b5532a;font-weight:600;">All slots filled in ${z} for ${d.mailing_month}. You'll join the waitlist.</div>`;
          }
        }
        applyAvail.innerHTML = header + line;
      } catch (e) { applyAvail.innerHTML = ''; }
    };
    applyZip.addEventListener('blur', refresh);
    if (applyCat) applyCat.addEventListener('change', refresh);
    if (prefill) refresh();
  }

  if (applyRef && applyRefMsg) {
    applyRef.addEventListener('blur', async () => {
      const code = applyRef.value.trim().toUpperCase();
      if (!code) { applyRefMsg.innerHTML = ''; return; }
      try {
        const r = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const d = await r.json();
        if (r.ok && d.valid) {
          applyRefMsg.innerHTML = `<span style="color:#0a7d3a;">✓ Valid — $${(d.discount_cents/100).toFixed(0)} credit will be applied.</span>`;
        } else {
          applyRefMsg.innerHTML = `<span style="color:#b5532a;">${d.error || 'Invalid or expired code.'}</span>`;
        }
      } catch (e) { applyRefMsg.innerHTML = ''; }
    });
  }

  // --- Apply Form Submission ---
  const applyForm = document.getElementById('apply-form');
  if (applyForm) {
    applyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgDiv = document.getElementById('apply-message');
      const formData = new FormData(applyForm);

      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (res.ok) {
          const waitlisted = data.placement === 'waitlisted' || data.status === 'waitlisted';
          msgDiv.innerHTML = waitlisted
            ? '<div class="form-message success">You\'re on the waitlist! That slot is currently taken — we\'ll email you the moment it opens up.</div>'
            : '<div class="form-message success">Application submitted! We\'ll review it within 48 hours and get back to you.</div>';
          applyForm.reset();
          if (applyAvail) applyAvail.innerHTML = '';
          if (applyRefMsg) applyRefMsg.innerHTML = '';
        } else {
          msgDiv.innerHTML = `<div class="form-message error">${data.error || 'Something went wrong. Please try again.'}</div>`;
        }
      } catch (err) {
        msgDiv.innerHTML = '<div class="form-message error">Network error. Please check your connection and try again.</div>';
      }
    });
  }

  // --- Contact Form Submission ---
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgDiv = document.getElementById('contact-message');
      const formData = Object.fromEntries(new FormData(contactForm));

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (res.ok) {
          msgDiv.innerHTML = '<div class="form-message success">Message sent! We\'ll get back to you soon.</div>';
          contactForm.reset();
        } else {
          msgDiv.innerHTML = `<div class="form-message error">${data.error || 'Something went wrong.'}</div>`;
        }
      } catch (err) {
        msgDiv.innerHTML = '<div class="form-message error">Network error. Please try again.</div>';
      }
    });
  }
});

// Shared business card HTML template
function businessCardHTML(b) {
  return `
    <div class="card business-card">
      <div class="business-category">${b.category_name || 'Local Business'}</div>
      <h3>${escapeHTML(b.name)}</h3>
      <p class="business-desc">${escapeHTML(b.description || '')}</p>
      <div class="business-meta">
        ${b.phone ? `<span>&#9742; ${escapeHTML(b.phone)}</span>` : ''}
        ${b.address ? `<span>&#9873; ${escapeHTML(b.address)}</span>` : ''}
        ${b.website ? `<span>&#127760; <a href="${escapeHTML(b.website)}" target="_blank" rel="noopener">${escapeHTML(b.website)}</a></span>` : ''}
      </div>
    </div>`;
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
