/* Local Heroes — coverage map */
(async function () {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('map', { zoomControl: true }).setView([29.76, -95.42], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  let data;
  try {
    data = await fetch('/api/zipcodes/geojson').then(r => r.json());
  } catch (err) {
    document.getElementById('zip-hint').textContent = 'Failed to load map data.';
    return;
  }

  const priceColor = (cents) => {
    if (cents >= 34000) return '#1e3a5f';
    if (cents >= 28000) return '#b5532a';
    return '#6c8e4d';
  };

  const markers = [];
  for (const f of (data.features || [])) {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const radius = Math.max(900, Math.sqrt(p.household_count || 3000) * 25);
    const remaining = p.slots_remaining;
    const fill = remaining === 0 ? '#aa3939' : priceColor(p.monthly_price_cents);

    const circle = L.circle([lat, lng], {
      radius,
      color: fill,
      fillColor: fill,
      fillOpacity: 0.28,
      weight: 2
    }).addTo(map);

    const label = L.divIcon({
      className: 'zip-marker-wrap',
      html: `<div style="background:${fill};color:#fff;padding:4px 8px;border-radius:12px;font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);">${p.zipcode}${remaining === 0 ? ' · FULL' : ''}</div>`,
      iconSize: [60, 20],
      iconAnchor: [30, 10]
    });
    const marker = L.marker([lat, lng], { icon: label }).addTo(map);

    const select = () => selectZip(p);
    circle.on('click', select);
    marker.on('click', select);
    markers.push({ circle, marker, props: p });
  }

  async function selectZip(p) {
    document.getElementById('zip-hint').style.display = 'none';
    document.getElementById('zip-stats').style.display = 'block';
    document.getElementById('zip-title').textContent = p.zipcode;
    document.getElementById('zip-neighborhood').textContent = p.neighborhood || '';
    document.getElementById('stat-households').textContent = (p.household_count || 0).toLocaleString();
    document.getElementById('stat-price').textContent = '$' + ((p.monthly_price_cents || 0) / 100).toFixed(0) + '/mo';
    document.getElementById('stat-slots').textContent = `${p.slots_claimed} claimed · ${p.slots_remaining} open`;
    document.getElementById('stat-month').textContent = p.mailing_month;
    document.getElementById('apply-btn').href = `apply.html?zipcode=${p.zipcode}`;

    const catList = document.getElementById('cat-list');
    catList.innerHTML = '<div style="color:var(--color-text-light);font-size:.85rem;">Loading categories…</div>';
    try {
      const avail = await fetch(`/api/slots/availability?zipcode=${p.zipcode}&month=${p.mailing_month}`)
        .then(r => r.json());
      catList.innerHTML = '';
      for (const c of avail.categories) {
        const row = document.createElement('div');
        row.className = 'cat-row';
        const status = c.taken
          ? `<span class="cat-taken">Taken${c.waitlist_count ? ` · ${c.waitlist_count} waiting` : ''}</span>`
          : `<span class="cat-avail">Available</span>`;
        row.innerHTML = `<span>${c.name}</span>${status}`;
        catList.appendChild(row);
      }
    } catch (err) {
      catList.innerHTML = '<div style="color:#a33;">Could not load category availability.</div>';
    }
  }
})();
