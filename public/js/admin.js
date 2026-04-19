/* Local Heroes - Sales Panel JS (JWT auth) */

let authToken = null;
let currentUser = null;
let calendarMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginDiv = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const logoutBtn = document.getElementById('logout-btn');

  // Toggle login <-> signup
  document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none'; signupForm.style.display = 'block';
    document.getElementById('auth-title').textContent = 'Create Salesperson Account';
  });
  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none'; loginForm.style.display = 'block';
    document.getElementById('auth-title').textContent = 'Salesperson Login';
  });

  const savedToken = sessionStorage.getItem('lh_token') || localStorage.getItem('lh_token');
  const savedUser  = sessionStorage.getItem('lh_user')  || localStorage.getItem('lh_user');
  if (savedToken && savedUser) { authToken = savedToken; currentUser = JSON.parse(savedUser); showDashboard(); }
  else if (location.hash === '#signup') {
    // Jump straight to signup when linked via /admin.html#signup (Sales Staff button)
    loginForm.style.display = 'none'; signupForm.style.display = 'block';
    document.getElementById('auth-title').textContent = 'Create Salesperson Account';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        authToken = data.token; currentUser = data.user;
        localStorage.setItem('lh_token', authToken);
        localStorage.setItem('lh_user', JSON.stringify(currentUser));
        showDashboard();
      } else {
        document.getElementById('login-message').innerHTML = `<div class="form-message error" style="margin-top:12px;">${data.error || 'Invalid credentials.'}</div>`;
      }
    } catch (err) { document.getElementById('login-message').innerHTML = '<div class="form-message error" style="margin-top:12px;">Connection error.</div>'; }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (res.ok) {
        authToken = body.token; currentUser = body.user;
        localStorage.setItem('lh_token', authToken);
        localStorage.setItem('lh_user', JSON.stringify(currentUser));
        showDashboard();
      } else {
        document.getElementById('signup-message').innerHTML = `<div class="form-message error" style="margin-top:12px;">${body.error || 'Signup failed.'}</div>`;
      }
    } catch (err) { document.getElementById('signup-message').innerHTML = '<div class="form-message error" style="margin-top:12px;">Connection error.</div>'; }
  });

  logoutBtn.addEventListener('click', () => {
    authToken = null; currentUser = null;
    localStorage.removeItem('lh_token'); localStorage.removeItem('lh_user');
    sessionStorage.removeItem('lh_admin'); sessionStorage.removeItem('lh_token'); sessionStorage.removeItem('lh_user');
    dashboard.style.display = 'none'; loginDiv.style.display = 'block'; logoutBtn.style.display = 'none';
  });

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
      // Lazy-load tab data
      if (tab.dataset.tab === 'crm-pipeline') loadPipeline();
      if (tab.dataset.tab === 'crm-calllist') loadCallList();
      if (tab.dataset.tab === 'crm-calendar') loadCalendar();
      if (tab.dataset.tab === 'crm-emails') loadEmailTab();
      if (tab.dataset.tab === 'territories') loadTerritories();
      if (tab.dataset.tab === 'commissions') loadCommissions();
      if (tab.dataset.tab === 'referrals') loadReferralsAdmin();
      if (tab.dataset.tab === 'heroes' && typeof loadHeroPosts === 'function') { loadHeroPosts(); loadHeroComments(); }
    });
  });

  // Application filters
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => loadApplications(btn.dataset.filter === 'all' ? null : btn.dataset.filter));
  });

  // Follow-up filters
  document.querySelectorAll('.crm-fu-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.crm-fu-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadFollowups(btn.dataset.fuFilter);
    });
  });

  // CRM Search
  const crmSearch = document.getElementById('crm-search');
  const crmStatusFilter = document.getElementById('crm-status-filter');
  let searchTimeout;
  if (crmSearch) crmSearch.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => loadContacts(), 300); });
  if (crmStatusFilter) crmStatusFilter.addEventListener('change', () => loadContacts());

  // Add Contact button
  document.getElementById('add-contact-btn')?.addEventListener('click', () => openContactModal());

  // Contact form submit
  document.getElementById('contact-form-crm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const id = data.id; delete data.id;
    if (id) { await adminFetch(`/api/crm/contacts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
    else { await adminFetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
    closeModal(); loadContacts(); loadCRMDashboard(); loadPipeline();
  });

  // Call form submit
  document.getElementById('call-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const contactId = data.contact_id;

    await adminFetch('/api/crm/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      contact_id: parseInt(contactId), call_date: data.call_date || undefined,
      duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : undefined, outcome: data.outcome, notes: data.notes
    })});

    const statusMap = { 'no_answer':'no_answer','voicemail':'contacted','spoke_interested':'interested','spoke_not_interested':'not_interested','spoke_callback':'contacted','spoke_signed':'signed','wrong_number':'not_interested' };
    if (statusMap[data.outcome]) {
      const contact = await adminFetch(`/api/crm/contacts/${contactId}`);
      if (contact) { await adminFetch(`/api/crm/contacts/${contactId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...contact, status: statusMap[data.outcome], calls: undefined, followups: undefined }) }); }
    }

    if (data.followup_date) {
      await adminFetch('/api/crm/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        contact_id: parseInt(contactId), followup_date: data.followup_date, followup_type: 'call', reason: data.followup_reason || 'Follow up on previous call'
      })});
    }

    closeModal(); loadContacts(); loadCRMDashboard(); loadFollowups('pending'); loadPipeline(); loadCallList();
  });

  // Calendar navigation
  document.getElementById('cal-prev')?.addEventListener('click', () => { calendarMonth = shiftMonth(calendarMonth, -1); loadCalendar(); });
  document.getElementById('cal-next')?.addEventListener('click', () => { calendarMonth = shiftMonth(calendarMonth, 1); loadCalendar(); });

  // Email compose form
  document.getElementById('email-compose-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const contact = allContactsCache.find(c => c.id === parseInt(data.contact_id));
    if (!contact || !contact.email) { document.getElementById('email-send-msg').innerHTML = '<div class="form-message error">Contact has no email address.</div>'; return; }

    await adminFetch('/api/crm/emails/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      contact_id: parseInt(data.contact_id), template_id: data.template_id ? parseInt(data.template_id) : null,
      to_email: contact.email, subject: data.subject, body: data.body
    })});

    document.getElementById('email-send-msg').innerHTML = '<div class="form-message success">Email logged! (Note: actual sending requires SMTP integration)</div>';
    e.target.reset();
  });

  function showDashboard() {
    loginDiv.style.display = 'none'; dashboard.style.display = 'block'; logoutBtn.style.display = 'inline-block';

    // Label + admin-only tab visibility
    const meLabel = document.getElementById('me-label');
    if (meLabel && currentUser) {
      meLabel.textContent = `— ${currentUser.full_name || currentUser.username}${currentUser.is_admin ? ' (admin)' : ''}`;
    }
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = (currentUser && currentUser.is_admin) ? '' : 'none';
    });

    loadCRMDashboard(); loadContacts(); loadFollowups('pending');
    if (currentUser && currentUser.is_admin) {
      loadApplications('pending'); loadBusinesses(); loadMessages(); loadZipcodes();
    }

    // Deep-link tab via #hash (e.g. admin.html#heroes from public Editor Login button)
    if (location.hash && location.hash.length > 1) {
      const target = location.hash.slice(1);
      const btn = document.querySelector(`.admin-tab[data-tab="${target}"]`);
      if (btn && btn.offsetParent !== null) setTimeout(() => btn.click(), 0);
    }
  }

  // ==================== CRM DASHBOARD ====================
  async function loadCRMDashboard() {
    const stats = await adminFetch('/api/crm/dashboard');
    if (!stats) return;
    const sc = (s) => (stats.byStatus.find(x => x.status === s) || { count: 0 }).count;

    document.getElementById('crm-stats').innerHTML = `
      <div class="crm-stat-card stat-overdue"><div class="crm-stat-number">${stats.overdueFollowups}</div><div class="crm-stat-label">Overdue</div></div>
      <div class="crm-stat-card stat-today"><div class="crm-stat-number">${stats.todayFollowups}</div><div class="crm-stat-label">Due Today</div></div>
      <div class="crm-stat-card stat-upcoming"><div class="crm-stat-number">${stats.upcomingFollowups}</div><div class="crm-stat-label">Upcoming</div></div>
      <div class="crm-stat-card stat-calls"><div class="crm-stat-number">${stats.callsThisWeek}</div><div class="crm-stat-label">Calls This Week</div></div>
      <div class="crm-stat-card"><div class="crm-stat-number" style="color:var(--color-navy);">${stats.totalContacts}</div><div class="crm-stat-label">Total Contacts</div></div>
      <div class="crm-stat-card"><div class="crm-stat-number" style="color:var(--color-success);">${sc('interested') + sc('negotiating')}</div><div class="crm-stat-label">Hot Leads</div></div>
      <div class="crm-stat-card"><div class="crm-stat-number" style="color:var(--color-gold);">${sc('signed')}</div><div class="crm-stat-label">Signed</div></div>`;

    const overdue = await adminFetch('/api/crm/followups?completed=0');
    if (overdue) {
      const today = new Date().toISOString().split('T')[0];
      const od = overdue.filter(f => f.followup_date < today);
      const td = overdue.filter(f => f.followup_date.startsWith(today));
      document.getElementById('crm-overdue-table').innerHTML = od.length ? od.map(f => fuRowHTML(f, true)).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--color-success);">No overdue follow-ups!</td></tr>';
      document.getElementById('crm-today-table').innerHTML = td.length ? td.map(f => fuRowHTML(f, false)).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--color-text-light);">Nothing scheduled for today.</td></tr>';
    }
  }

  function fuRowHTML(f, isOverdue) {
    return `<tr><td><strong>${esc(f.business_name)}</strong></td><td>${esc(f.contact_name||'-')}</td>
    <td>${f.phone?`<a href="tel:${esc(f.phone)}" style="color:var(--color-rust);font-weight:600;">${esc(f.phone)}</a>`:'-'}</td>
    ${isOverdue?`<td><span class="badge badge-overdue">${f.followup_date}</span></td>`:`<td>${esc(f.followup_type||'call')}</td>`}
    <td>${esc(f.reason||'-')}</td>
    <td style="white-space:nowrap;"><button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${f.contact_id},'${esc(f.business_name)}')">Call Now</button>
    <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="completeFollowup(${f.id})">Done</button></td></tr>`;
  }

  // ==================== PIPELINE ====================
  let _pipelineListenersAttached = false;
  function attachPipelineDropListeners() {
    if (_pipelineListenersAttached) return;
    document.querySelectorAll('.pipeline-cards').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.style.background = 'rgba(212,168,67,0.1)'; });
      col.addEventListener('dragleave', () => { col.style.background = ''; });
      col.addEventListener('drop', async (e) => {
        e.preventDefault(); col.style.background = '';
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        const newStatus = col.parentElement.dataset.status;
        // Optimistically remove the dragged card from its old column so it never appears in two places.
        const dragged = document.querySelector(`.pipeline-card[data-id="${id}"]`);
        if (dragged && dragged.parentElement !== col) dragged.remove();
        try {
          const r = await adminFetch(`/api/crm/contacts/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          if (!r) throw new Error('Update failed');
        } catch (err) {
          alert('Could not move lead: ' + (err.message || err));
        }
        loadPipeline(); loadCRMDashboard(); loadContacts();
      });
    });
    _pipelineListenersAttached = true;
  }

  window.loadPipeline = async function() {
    const data = await adminFetch('/api/crm/contacts');
    if (!data) return;

    const statuses = ['new','contacted','interested','negotiating','signed','not_interested'];
    const groups = {};
    statuses.forEach(s => groups[s] = []);
    // De-dupe by id in case the API ever returns duplicates from a JOIN.
    const seen = new Set();
    data.forEach(c => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      const s = groups[c.status] ? c.status : (c.status === 'no_answer' ? 'contacted' : null);
      if (s) groups[s].push(c);
    });

    statuses.forEach(s => {
      document.getElementById('pipe-' + s).innerHTML = groups[s].map(c => `
        <div class="pipeline-card" draggable="true" data-id="${c.id}" ondragstart="dragStart(event)" onclick="viewContact(${c.id})">
          <div class="pc-name">${esc(c.business_name)}</div>
          <div class="pc-meta">${esc(c.contact_name||'')} ${c.zipcode?'· '+c.zipcode:''}</div>
          <div class="pc-meta">${esc(c.category||'')}</div>
          <div class="pc-actions">
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:0.7rem;" onclick="event.stopPropagation();openCallModal(${c.id},'${esc(c.business_name)}')">Call</button>
            <button class="btn btn-navy" style="padding:2px 8px;font-size:0.7rem;" onclick="event.stopPropagation();openEmailForContact(${c.id})">Email</button>
          </div>
        </div>`).join('');
      document.getElementById('count-' + s).textContent = groups[s].length;
    });

    attachPipelineDropListeners();
  };

  window.dragStart = function(e) {
    // Find the .pipeline-card ancestor in case the drag started on an inner element
    const card = e.target.closest ? e.target.closest('.pipeline-card') : e.target;
    if (card && card.dataset && card.dataset.id) {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  // ==================== DAILY CALL LIST ====================
  window.loadCallList = async function() {
    const data = await adminFetch('/api/crm/calllist');
    if (!data || !data.length) {
      document.getElementById('calllist-container').innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-light);"><h3>No calls queued!</h3><p>All caught up. Add new leads or schedule follow-ups to populate the call list.</p></div>';
      return;
    }

    const reasonLabels = { overdue_followup: 'Overdue Follow-Up', today_followup: "Today's Follow-Up", hot_lead: 'Hot Lead - No Recent Contact', new_lead: 'New Lead - Never Called', retry_no_answer: 'Retry - Previous No Answer' };
    const reasonBadges = { overdue_followup: 'badge-overdue', today_followup: 'badge-due_today', hot_lead: 'badge-interested', new_lead: 'badge-new', retry_no_answer: 'badge-no_answer' };

    document.getElementById('calllist-container').innerHTML = data.map(c => `
      <div class="calllist-card priority-${c.priority_score}">
        <div class="calllist-info">
          <div class="cl-name">${esc(c.business_name)}</div>
          <div class="cl-meta">${esc(c.contact_name||'')} ${c.category?'· '+esc(c.category):''} ${c.zipcode?'· '+c.zipcode:''}</div>
          <div class="cl-reason"><span class="badge ${reasonBadges[c.priority_reason]||'badge-pending'}">${reasonLabels[c.priority_reason]||c.priority_reason}</span>
            ${c.followup_reason ? ' — ' + esc(c.followup_reason) : ''}</div>
        </div>
        <div class="calllist-phone">${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:'<span style="color:var(--color-text-light);">No phone</span>'}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary" style="padding:8px 14px;font-size:0.8rem;" onclick="openCallModal(${c.id},'${esc(c.business_name)}')">Log Call</button>
          <button class="btn btn-navy" style="padding:8px 14px;font-size:0.8rem;" onclick="viewContact(${c.id})">View</button>
        </div>
      </div>`).join('');
  };

  // ==================== CALENDAR ====================
  window.loadCalendar = async function() {
    const [year, month] = calendarMonth.split('-').map(Number);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-title').textContent = `${monthNames[month-1]} ${year}`;

    const data = await adminFetch(`/api/crm/calendar?month=${calendarMonth}`);
    const events = {};
    if (data) data.forEach(f => { const d = f.followup_date; if (!events[d]) events[d] = []; events[d].push(f); });

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-header">${d}</div>`).join('');

    // Previous month padding
    const prevDays = new Date(year, month - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${prevDays - i}</div></div>`;
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = events[dateStr] || [];
      html += `<div class="cal-day${isToday?' today':''}">
        <div class="cal-day-num">${d}</div>
        ${dayEvents.map(f => {
          const cls = f.completed ? 'completed' : (f.followup_date < todayStr ? 'overdue' : 'pending');
          return `<div class="cal-event ${cls}" title="${esc(f.business_name)}: ${esc(f.reason||f.followup_type)}" onclick="viewContact(${f.contact_id})">${esc(f.business_name)}</div>`;
        }).join('')}
      </div>`;
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }

    document.getElementById('calendar-grid').innerHTML = html;
  };

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.toISOString().slice(0, 7);
  }

  // ==================== EMAIL TAB ====================
  let allContactsCache = [];
  let allTemplatesCache = [];

  async function loadEmailTab() {
    // Load templates
    allTemplatesCache = await adminFetch('/api/crm/templates') || [];
    document.getElementById('template-list').innerHTML = allTemplatesCache.map(t => `
      <div class="template-item" onclick="selectTemplate(${t.id})" id="tmpl-${t.id}">
        <div class="ti-name">${esc(t.name)}</div>
        <div class="ti-subject">${esc(t.subject)}</div>
      </div>`).join('');

    // Load contacts into select
    const contacts = await adminFetch('/api/crm/contacts');
    allContactsCache = contacts || [];
    const sel = document.getElementById('email-contact-select');
    sel.innerHTML = '<option value="">Select a contact...</option>' + allContactsCache.filter(c => c.email).map(c =>
      `<option value="${c.id}">${esc(c.business_name)} (${esc(c.email)})</option>`).join('');
  }

  window.selectTemplate = function(id) {
    const tmpl = allTemplatesCache.find(t => t.id === id);
    if (!tmpl) return;
    document.querySelectorAll('.template-item').forEach(el => el.classList.remove('active'));
    document.getElementById('tmpl-' + id).classList.add('active');
    document.getElementById('email-template-id').value = id;
    document.getElementById('email-subject').value = tmpl.subject;
    document.getElementById('email-body').value = tmpl.body;
  };

  window.openEmailForContact = async function(contactId) {
    // Switch to email tab
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    document.querySelector('[data-tab="crm-emails"]').classList.add('active');
    document.getElementById('tab-crm-emails').style.display = 'block';
    await loadEmailTab();
    document.getElementById('email-contact-select').value = contactId;

    // Auto-fill template variables
    const contact = allContactsCache.find(c => c.id === contactId);
    if (contact) fillTemplateVars(contact);
  };

  // Replace template variables
  document.getElementById('email-contact-select')?.addEventListener('change', function() {
    const contact = allContactsCache.find(c => c.id === parseInt(this.value));
    if (contact) fillTemplateVars(contact);
  });

  function fillTemplateVars(contact) {
    const subj = document.getElementById('email-subject');
    const body = document.getElementById('email-body');
    const vars = { '{{business_name}}': contact.business_name||'', '{{contact_name}}': contact.contact_name||'there', '{{zipcode}}': contact.zipcode||'your area', '{{email}}': contact.email||'' };
    for (const [k, v] of Object.entries(vars)) {
      subj.value = subj.value.replaceAll(k, v);
      body.value = body.value.replaceAll(k, v);
    }
  }

  // ==================== CONTACTS ====================
  async function loadContacts() {
    const search = document.getElementById('crm-search')?.value || '';
    const status = document.getElementById('crm-status-filter')?.value || '';
    let url = '/api/crm/contacts?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    const data = await adminFetch(url);
    if (!data) return;
    allContactsCache = data;

    document.getElementById('crm-contacts-table').innerHTML = data.length ? data.map(c => {
      const fuDate = c.next_followup_date;
      let fuBadge = '';
      if (fuDate) { const today = new Date().toISOString().split('T')[0]; fuBadge = fuDate<today?`<span class="badge badge-overdue">${fuDate}</span>`:fuDate===today?`<span class="badge badge-due_today">${fuDate}</span>`:`<span class="badge badge-upcoming">${fuDate}</span>`; }
      else { fuBadge = '<span style="color:var(--color-text-light);font-size:0.85rem;">None</span>'; }

      const myId = currentUser ? currentUser.id : null;
      const ownedByMe = c.commission_salesperson_id && myId && c.commission_salesperson_id === myId;
      const ownedByOther = c.commission_salesperson_id && !ownedByMe;
      const ownerBadge = c.commission_salesperson_id
        ? (ownedByMe ? '<span class="badge badge-signed">You</span>' : `<span class="badge badge-pending">${esc(c.commission_username||'#'+c.commission_salesperson_id)}</span>`)
        : '<span class="badge badge-new">Unclaimed</span>';

      const canEdit = !ownedByOther || (currentUser && currentUser.is_admin);
      const canDelete = currentUser && currentUser.is_admin;

      return `<tr${ownedByOther?' style="opacity:0.6;"':''}>
        <td><strong style="cursor:pointer;color:var(--color-navy);" onclick="viewContact(${c.id})">${esc(c.business_name)}</strong></td>
        <td>${esc(c.contact_name||'-')}</td><td>${esc(c.phone||'-')}</td><td>${esc(c.zipcode||'-')}</td>
        <td>${ownerBadge}</td>
        <td><span class="badge badge-${c.status}">${c.status.replace('_',' ')}</span></td>
        <td>${c.last_call_date?new Date(c.last_call_date).toLocaleDateString():'<span style="color:var(--color-text-light);font-size:0.85rem;">Never</span>'}</td>
        <td>${fuBadge}</td>
        <td style="white-space:nowrap;">
          ${canEdit?`<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${c.id},'${esc(c.business_name)}')">Call</button>
          <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="openContactModal(${c.id})">Edit</button>`:''}
          ${canDelete?`<button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteContact(${c.id})">Del</button>`:''}
        </td></tr>`;
    }).join('') : '<tr><td colspan="9" style="text-align:center;padding:24px;">No contacts yet.</td></tr>';
  }

  // ==================== FOLLOW-UPS ====================
  async function loadFollowups(filter) {
    let url = '/api/crm/followups?';
    if (filter === 'pending') url += 'completed=0'; else if (filter === 'completed') url += 'completed=1';
    const data = await adminFetch(url);
    if (!data) return;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('crm-followups-table').innerHTML = data.length ? data.map(f => {
      let dateBadge;
      if (f.completed) dateBadge = `<span class="badge badge-completed">${f.followup_date}</span>`;
      else if (f.followup_date < today) dateBadge = `<span class="badge badge-overdue">${f.followup_date}</span>`;
      else if (f.followup_date === today) dateBadge = `<span class="badge badge-due_today">${f.followup_date}</span>`;
      else dateBadge = `<span class="badge badge-upcoming">${f.followup_date}</span>`;
      return `<tr><td>${dateBadge}</td><td><strong>${esc(f.business_name)}</strong></td><td>${esc(f.contact_name||'-')}</td><td>${esc(f.phone||'-')}</td>
        <td>${esc(f.followup_type||'call')}</td><td>${esc(f.reason||'-')}</td>
        <td>${f.completed?'<span class="badge badge-completed">Done</span>':'<span class="badge badge-pending">Pending</span>'}</td>
        <td style="white-space:nowrap;">${!f.completed?`<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${f.contact_id},'${esc(f.business_name)}')">Call</button>
          <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="completeFollowup(${f.id})">Done</button>`:''}<button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteFollowup(${f.id})">Del</button></td></tr>`;
    }).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;">No follow-ups found.</td></tr>';
  }

  // ==================== CONTACT DETAIL + ACTIVITY TIMELINE ====================
  window.viewContact = async function(id) {
    const c = await adminFetch(`/api/crm/contacts/${id}`);
    if (!c) return;

    // Fetch activity timeline
    const activities = await adminFetch(`/api/crm/activities/${id}`) || [];
    const emails = await adminFetch(`/api/crm/emails/${id}`) || [];

    // Merge calls, emails, follow-ups into timeline
    const timeline = [];
    (c.calls||[]).forEach(call => timeline.push({ type: 'call', time: call.call_date, title: `Call: ${(call.outcome||'').replace(/_/g,' ')}`, detail: call.notes, extra: call.duration_minutes ? `${call.duration_minutes} min` : '' }));
    emails.forEach(e => timeline.push({ type: 'email', time: e.created_at, title: `Email: ${e.subject}`, detail: e.body?.substring(0,150) }));
    activities.forEach(a => timeline.push({ type: a.type, time: a.created_at, title: a.title, detail: a.detail }));
    (c.followups||[]).forEach(f => timeline.push({ type: 'followup', time: f.created_at, title: `Follow-up ${f.completed?'completed':'scheduled'}: ${f.followup_date}`, detail: f.reason }));
    timeline.sort((a, b) => b.time?.localeCompare(a.time));

    document.getElementById('detail-title').textContent = c.business_name;
    document.getElementById('detail-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div>
          <strong>Contact:</strong> ${esc(c.contact_name||'-')}<br>
          <strong>Phone:</strong> ${c.phone?`<a href="tel:${esc(c.phone)}" style="color:var(--color-rust);">${esc(c.phone)}</a>`:'-'}<br>
          <strong>Email:</strong> ${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:'-'}<br>
          <strong>Website:</strong> ${c.website?`<a href="${esc(c.website)}" target="_blank">${esc(c.website)}</a>`:'-'}
        </div>
        <div>
          <strong>Zipcode:</strong> ${esc(c.zipcode||'-')}<br>
          <strong>Category:</strong> ${esc(c.category||'-')}<br>
          <strong>Source:</strong> ${esc(c.source||'-')}<br>
          <strong>Status:</strong> <span class="badge badge-${c.status}">${c.status.replace('_',' ')}</span>
        </div>
      </div>
      ${c.notes?`<div style="margin-bottom:24px;padding:12px;background:var(--color-bg-warm);border-radius:var(--radius);"><strong>Notes:</strong> ${esc(c.notes)}</div>`:''}
      <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.85rem;" onclick="closeModal();openCallModal(${c.id},'${esc(c.business_name)}')">Log Call</button>
        <button class="btn btn-navy" style="padding:8px 16px;font-size:0.85rem;" onclick="closeModal();openContactModal(${c.id})">Edit</button>
        <button class="btn btn-primary" style="padding:8px 16px;font-size:0.85rem;" onclick="closeModal();openEmailForContact(${c.id})">Send Email</button>
        <button class="btn btn-outline" style="padding:8px 16px;font-size:0.85rem;color:var(--color-navy);border-color:var(--color-border);" onclick="addNote(${c.id})">Add Note</button>
      </div>
      <h4 style="margin-bottom:16px;">Activity Timeline (${timeline.length})</h4>
      <div class="activity-timeline">
        ${timeline.length ? timeline.map(a => `
          <div class="activity-item type-${a.type}">
            <div class="ai-time">${a.time ? new Date(a.time).toLocaleString() : ''} ${a.extra||''}</div>
            <div class="ai-title">${esc(a.title)}</div>
            ${a.detail ? `<div class="ai-detail">${esc(a.detail)}</div>` : ''}
          </div>`).join('') : '<p style="color:var(--color-text-light);">No activity yet.</p>'}
      </div>`;

    showModal('modal-detail');
  };

  window.addNote = async function(contactId) {
    const note = prompt('Add a note:');
    if (!note) return;
    await adminFetch('/api/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, title: 'Note added', detail: note }) });
    viewContact(contactId);
  };

  // ==================== MODAL FUNCTIONS ====================
  window.openContactModal = async function(id) {
    const form = document.getElementById('contact-form-crm');
    form.reset(); document.getElementById('crm-contact-id').value = '';
    document.getElementById('modal-contact-title').textContent = 'Add Contact';
    if (id) {
      const c = await adminFetch(`/api/crm/contacts/${id}`);
      if (c) {
        document.getElementById('modal-contact-title').textContent = 'Edit Contact';
        document.getElementById('crm-contact-id').value = c.id;
        ['business_name','contact_name','phone','email','website','address','zipcode','category','source','status','notes'].forEach(f => { const el = form.querySelector(`[name="${f}"]`); if (el) el.value = c[f]||''; });
      }
    }
    showModal('modal-contact');
  };

  window.openCallModal = function(contactId, businessName) {
    const form = document.getElementById('call-form');
    form.reset();
    document.getElementById('call-contact-id').value = contactId;
    document.getElementById('call-business-name').textContent = businessName;
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    form.querySelector('[name="call_date"]').value = now.toISOString().slice(0, 16);
    showModal('modal-call');
  };

  window.deleteContact = async function(id) { if (!confirm('Delete this contact and all history?')) return; await adminFetch(`/api/crm/contacts/${id}`, { method: 'DELETE' }); loadContacts(); loadCRMDashboard(); loadPipeline(); };
  window.completeFollowup = async function(id) { await adminFetch(`/api/crm/followups/${id}/complete`, { method: 'PATCH' }); loadFollowups('pending'); loadCRMDashboard(); loadCallList(); };
  window.deleteFollowup = async function(id) { if (!confirm('Delete?')) return; await adminFetch(`/api/crm/followups/${id}`, { method: 'DELETE' }); loadFollowups('pending'); loadCRMDashboard(); };

  function showModal(modalId) {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById(modalId).style.display = 'block';
  }
  window.closeModal = function() { document.getElementById('modal-overlay').style.display = 'none'; document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); };
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  // ==================== ORIGINAL ADMIN TABS ====================
  async function loadApplications(status) {
    const url = status ? `/api/admin/applications?status=${status}` : '/api/admin/applications';
    const data = await adminFetch(url); if (!data) return;
    document.getElementById('applications-table').innerHTML = data.map(a => `<tr>
      <td><strong>${esc(a.business_name)}</strong></td><td>${esc(a.contact_name)}<br><small>${esc(a.email)}</small></td>
      <td>${esc(a.category)}</td><td>${esc(a.zipcode)}</td><td>${new Date(a.created_at).toLocaleDateString()}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td>${a.status==='pending'?`<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="updateApp(${a.id},'approved')">Approve</button>
        <button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="updateApp(${a.id},'rejected')">Reject</button>
        <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="appToCRM(${a.id})">Add to CRM</button>`:''}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;">No applications found.</td></tr>';
  }

  window.updateApp = async function(id, status) { await adminFetch(`/api/admin/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); loadApplications('pending'); };

  window.appToCRM = async function(id) {
    const apps = await adminFetch('/api/admin/applications');
    const app = apps?.find(a => a.id === id); if (!app) return;
    await adminFetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      business_name: app.business_name, contact_name: app.contact_name, phone: app.phone, email: app.email,
      website: app.website, zipcode: app.zipcode, category: app.category, source: 'application', status: 'new',
      notes: app.description ? `From application: ${app.description}` : '' }) });
    alert('Contact added to CRM!'); loadContacts(); loadCRMDashboard();
  };

  async function loadBusinesses() {
    const data = await adminFetch('/api/admin/businesses'); if (!data) return;
    document.getElementById('businesses-table').innerHTML = data.map(b => `<tr><td><strong>${esc(b.name)}</strong></td><td>${esc(b.category_name||'-')}</td>
      <td>${esc(b.zipcode||'-')} ${b.neighborhood?`(${esc(b.neighborhood)})`:''}</td>
      <td>${b.featured?'<span class="badge badge-approved">Yes</span>':'No'}</td>
      <td>${b.active?'<span class="badge badge-approved">Active</span>':'<span class="badge badge-rejected">Inactive</span>'}</td>
      <td><button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteBiz(${b.id})">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No businesses yet.</td></tr>';
  }
  window.deleteBiz = async function(id) { if (!confirm('Delete?')) return; await adminFetch(`/api/admin/businesses/${id}`, { method: 'DELETE' }); loadBusinesses(); };

  async function loadMessages() {
    const data = await adminFetch('/api/admin/messages'); if (!data) return;
    document.getElementById('messages-table').innerHTML = data.map(m => `<tr style="${m.read?'':'font-weight:600;background:var(--color-bg-warm);'}">
      <td>${esc(m.name)}</td><td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td><td>${esc(m.subject||'-')}</td>
      <td style="max-width:300px;">${esc(m.message).substring(0,100)}${m.message.length>100?'...':''}</td>
      <td>${new Date(m.created_at).toLocaleDateString()}</td>
      <td>${m.read?'<span class="badge badge-approved">Read</span>':`<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="markRead(${m.id})">Mark Read</button>`}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No messages yet.</td></tr>';
  }
  window.markRead = async function(id) { await adminFetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' }); loadMessages(); };

  async function loadZipcodes() {
    const data = await adminFetch('/api/admin/zipcodes'); if (!data) return;
    document.getElementById('zipcodes-table').innerHTML = data.map(z => `<tr><td><strong>${esc(z.zipcode)}</strong></td><td>${esc(z.neighborhood||'-')}</td>
      <td>${z.business_count}</td><td>${z.active?'<span class="badge badge-approved">Active</span>':'<span class="badge badge-rejected">Inactive</span>'}</td></tr>`).join('');
  }

  // ==================== TERRITORIES / COMMISSIONS / REFERRALS ====================
  let _zipsCache = null, _repsCache = null;
  async function loadZipOptions(selectEl) {
    if (!_zipsCache) _zipsCache = await adminFetch('/api/zipcodes') || [];
    selectEl.innerHTML = '<option value="">— Select zipcode —</option>' +
      _zipsCache.map(z => `<option value="${esc(z.zipcode)}">${esc(z.zipcode)} — ${esc(z.neighborhood||'')}</option>`).join('');
  }
  async function loadRepOptions(selectEl) {
    if (!_repsCache) _repsCache = await adminFetch('/api/auth/salespeople') || [];
    selectEl.innerHTML = '<option value="">— Select salesperson —</option>' +
      _repsCache.map(r => `<option value="${r.id}">${esc(r.full_name || r.username)} (${esc(r.username)})</option>`).join('');
  }

  async function loadTerritories() {
    await loadZipOptions(document.getElementById('territory-zip'));
    await loadRepOptions(document.getElementById('territory-rep'));
    const data = await adminFetch('/api/territories'); if (!data) return;
    const tbody = document.getElementById('territories-table');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No territories assigned yet.</td></tr>'; return; }
    tbody.innerHTML = data.map(t => `<tr>
      <td><strong>${esc(t.zipcode)}</strong></td>
      <td>${esc(t.neighborhood||'-')}</td>
      <td>${esc(t.full_name || t.username)}</td>
      <td>${t.assigned_at ? new Date(t.assigned_at).toLocaleDateString() : '-'}</td>
      <td><button class="btn btn-sm btn-outline" onclick="removeTerritory(${t.id})">Remove</button></td>
    </tr>`).join('');
  }
  window.removeTerritory = async function(id) {
    if (!confirm('Remove this territory assignment?')) return;
    await adminFetch('/api/territories/' + id, { method: 'DELETE' });
    loadTerritories();
  };
  document.getElementById('territory-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const zipOpt = document.getElementById('territory-zip').selectedOptions[0];
    const body = {
      salesperson_id: parseInt(fd.get('salesperson_id')),
      zipcode: zipOpt ? zipOpt.value : null
    };
    const msg = document.getElementById('territory-msg');
    const res = await adminFetch('/api/territories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res && res.success !== false) {
      msg.innerHTML = '<div class="form-message success">Territory assigned.</div>';
      e.target.reset();
      loadTerritories();
    } else {
      msg.innerHTML = `<div class="form-message error">${esc((res && res.error) || 'Failed to assign.')}</div>`;
    }
  });

  async function loadCommissions() {
    await loadRepOptions(document.getElementById('commission-rep'));
    const [list, summary] = await Promise.all([
      adminFetch('/api/territories/commissions'),
      adminFetch('/api/territories/commissions/summary')
    ]);
    if (!list) return;
    const tbody = document.getElementById('commissions-table');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">No commissions logged yet.</td></tr>'; }
    else {
      tbody.innerHTML = list.map(c => `<tr>
        <td>${new Date(c.created_at).toLocaleDateString()}</td>
        <td>${esc(c.full_name || c.username)}</td>
        <td>${c.application_id || '-'}</td>
        <td><strong>$${((c.amount_cents||0)/100).toFixed(2)}</strong></td>
        <td>${c.status === 'paid'
          ? '<span class="badge badge-approved">Paid</span>'
          : '<span class="badge badge-pending">Pending</span>'}</td>
        <td>${esc(c.notes || '-')}</td>
        <td>${c.status === 'paid' ? '' : `<button class="btn btn-sm btn-primary" onclick="markCommissionPaid(${c.id})">Mark Paid</button>`}</td>
      </tr>`).join('');
    }
  }
  window.markCommissionPaid = async function(id) {
    await adminFetch('/api/territories/commissions/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' })
    });
    loadCommissions();
  };
  document.getElementById('commission-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      salesperson_id: parseInt(fd.get('salesperson_id')),
      application_id: fd.get('application_id') ? parseInt(fd.get('application_id')) : null,
      amount_cents: Math.round(parseFloat(fd.get('amount_dollars')) * 100),
      notes: fd.get('note') || null
    };
    const msg = document.getElementById('commission-msg');
    const res = await adminFetch('/api/territories/commissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res && res.id) {
      msg.innerHTML = '<div class="form-message success">Commission added.</div>';
      e.target.reset();
      loadCommissions();
    } else {
      msg.innerHTML = `<div class="form-message error">${esc((res && res.error) || 'Failed to create.')}</div>`;
    }
  });

  async function loadReferralsAdmin() {
    const data = await adminFetch('/api/referrals/admin/all'); if (!data) return;
    const tbody = document.getElementById('referrals-table');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No referral codes yet.</td></tr>'; return; }
    tbody.innerHTML = data.map(r => `<tr>
      <td><strong>${esc(r.code)}</strong></td>
      <td>${esc(r.owner_username || r.owner_email || '-')}</td>
      <td>$${((r.discount_cents||0)/100).toFixed(0)}</td>
      <td>${r.times_used || 0}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td>${r.active
        ? '<span class="badge badge-approved">Active</span>'
        : '<span class="badge badge-rejected">Inactive</span>'}</td>
    </tr>`).join('');
  }
  document.getElementById('referral-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      owner_email: fd.get('owner_email') || null,
      discount_cents: Math.round(parseFloat(fd.get('discount_dollars')) * 100),
      reward_cents: Math.round(parseFloat(fd.get('discount_dollars')) * 100)
    };
    const msg = document.getElementById('referral-msg');
    const res = await adminFetch('/api/referrals/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res && res.code) {
      msg.innerHTML = `<div class="form-message success">Generated code: <strong>${esc(res.code)}</strong></div>`;
      e.target.reset();
      loadReferralsAdmin();
    } else {
      msg.innerHTML = `<div class="form-message error">${esc((res && res.error) || 'Failed to generate.')}</div>`;
    }
  });

  // ==================== HELPERS ====================
  async function adminFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (authToken) options.headers['Authorization'] = 'Bearer ' + authToken;
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        if (res.status === 401) {
          authToken = null; currentUser = null;
          localStorage.removeItem('lh_token'); localStorage.removeItem('lh_user');
          location.reload();
        }
        return null;
      }
      return await res.json();
    } catch (err) { return null; }
  }

  function esc(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
});
