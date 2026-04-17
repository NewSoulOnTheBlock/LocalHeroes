/* Local Heroes — sales rep dashboard */
(function () {
  const token = localStorage.getItem('salesToken');
  if (!token) {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('login-gate').style.display = 'block';
    });
    return;
  }
  const authHeaders = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('rep-content').style.display = 'block';

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('salesToken'); location.href = 'admin.html';
    });

    await loadSummary();
    await loadTerritories();
    await loadPipeline();
    await loadCommissions();
  });

  function dollars(c) { return '$' + ((c || 0) / 100).toFixed(2); }

  async function loadSummary() {
    try {
      const r = await fetch('/api/territories/commissions/summary', { headers: authHeaders });
      if (r.status === 401) return gateOut();
      const rows = await r.json();
      const wrap = document.getElementById('comm-summary');
      wrap.innerHTML = '';
      (rows || []).forEach(s => {
        const card = document.createElement('div');
        card.className = 'rep-card';
        card.innerHTML = `<h4>${s.full_name || s.username}</h4>
          <div class="num">${dollars(s.paid_cents)}</div>
          <div style="color:var(--color-text-light);font-size:.85rem;">
            ${dollars(s.pending_cents)} pending · ${s.total_commissions} total
          </div>`;
        wrap.appendChild(card);
      });
      if (!rows.length) wrap.innerHTML = '<p style="color:var(--color-text-light);">No commissions yet.</p>';
    } catch (err) { console.error(err); }
  }

  async function loadTerritories() {
    try {
      const rows = await fetch('/api/territories', { headers: authHeaders }).then(r => r.json());
      const wrap = document.getElementById('territory-list');
      if (!rows.length) { wrap.innerHTML = '<p style="color:var(--color-text-light);">No territories assigned yet. Ask an admin to assign you a zipcode.</p>'; return; }
      wrap.innerHTML = '<table class="rep-table"><thead><tr><th>Zip</th><th>Neighborhood</th><th>Households</th><th>Monthly price</th><th>Rep</th></tr></thead><tbody>'
        + rows.map(t => `<tr>
            <td><strong>${t.zipcode}</strong></td>
            <td>${t.neighborhood || ''}</td>
            <td>${(t.household_count || 0).toLocaleString()}</td>
            <td>${dollars(t.monthly_price_cents)}</td>
            <td>${t.full_name || t.username}</td>
          </tr>`).join('')
        + '</tbody></table>';
    } catch (err) { console.error(err); }
  }

  async function loadPipeline() {
    try {
      const data = await fetch('/api/territories/pipeline', { headers: authHeaders }).then(r => r.json());
      const wrap = document.getElementById('pipeline');
      wrap.innerHTML = '';
      for (const stage of data.stages) {
        const col = document.createElement('div');
        col.className = 'stage';
        col.dataset.stage = stage;
        col.innerHTML = `<h4>${stage} (${(data.board[stage]||[]).length})</h4>`;
        for (const c of (data.board[stage] || [])) {
          const card = document.createElement('div');
          card.className = 'contact-card';
          card.draggable = true;
          card.dataset.id = c.id;
          card.innerHTML = `<div class="name">${c.business_name}</div>
            <div class="meta">${c.zipcode || ''} · ${c.category || ''}${c.owner_username ? ' · '+c.owner_username : ''}</div>`;
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', c.id);
            card.classList.add('dragging');
          });
          card.addEventListener('dragend', () => card.classList.remove('dragging'));
          col.appendChild(card);
        }
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drop-over'));
        col.addEventListener('drop', async (e) => {
          e.preventDefault();
          col.classList.remove('drop-over');
          const id = e.dataTransfer.getData('text/plain');
          const stage = col.dataset.stage;
          try {
            await fetch(`/api/territories/pipeline/${id}`, {
              method: 'PATCH', headers: authHeaders,
              body: JSON.stringify({ stage })
            });
            loadPipeline();
          } catch (err) { alert('Failed to update: ' + err.message); }
        });
        wrap.appendChild(col);
      }
    } catch (err) { console.error(err); }
  }

  async function loadCommissions() {
    try {
      const rows = await fetch('/api/territories/commissions', { headers: authHeaders }).then(r => r.json());
      const wrap = document.getElementById('comm-list');
      if (!rows.length) { wrap.innerHTML = '<p style="color:var(--color-text-light);">No commissions recorded yet.</p>'; return; }
      wrap.innerHTML = '<table class="rep-table"><thead><tr><th>Date</th><th>Rep</th><th>Contact</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead><tbody>'
        + rows.map(c => `<tr>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td>${c.full_name || c.username}</td>
            <td>${c.contact_business_name || '—'}</td>
            <td>${c.period || '—'}</td>
            <td><strong>${dollars(c.amount_cents)}</strong></td>
            <td>${c.status}${c.paid_at ? ' (' + new Date(c.paid_at).toLocaleDateString() + ')' : ''}</td>
          </tr>`).join('')
        + '</tbody></table>';
    } catch (err) { console.error(err); }
  }

  function gateOut() {
    localStorage.removeItem('salesToken');
    document.getElementById('rep-content').style.display = 'none';
    document.getElementById('login-gate').style.display = 'block';
  }
})();
