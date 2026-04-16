/* Local Heroes - Admin Panel + CRM JS */

let authToken = null;

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginDiv = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const logoutBtn = document.getElementById('logout-btn');

  const saved = sessionStorage.getItem('lh_admin');
  if (saved) {
    authToken = saved;
    showDashboard();
  }

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    const token = btoa('admin:' + password);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + token, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        authToken = token;
        sessionStorage.setItem('lh_admin', token);
        showDashboard();
      } else {
        document.getElementById('login-message').innerHTML =
          '<div class="form-message error" style="margin-top:12px;">Invalid password.</div>';
      }
    } catch (err) {
      document.getElementById('login-message').innerHTML =
        '<div class="form-message error" style="margin-top:12px;">Connection error.</div>';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    authToken = null;
    sessionStorage.removeItem('lh_admin');
    dashboard.style.display = 'none';
    loginDiv.style.display = 'block';
    logoutBtn.style.display = 'none';
  });

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
    });
  });

  // Application filter buttons
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      loadApplications(filter === 'all' ? null : filter);
    });
  });

  // Follow-up filter buttons
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
  if (crmSearch) {
    crmSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadContacts(), 300);
    });
  }
  if (crmStatusFilter) {
    crmStatusFilter.addEventListener('change', () => loadContacts());
  }

  // Add Contact button
  const addContactBtn = document.getElementById('add-contact-btn');
  if (addContactBtn) {
    addContactBtn.addEventListener('click', () => openContactModal());
  }

  // Contact form submit
  const contactFormCRM = document.getElementById('contact-form-crm');
  if (contactFormCRM) {
    contactFormCRM.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(contactFormCRM));
      const id = data.id;
      delete data.id;

      if (id) {
        await adminFetch(`/api/crm/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await adminFetch('/api/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      closeModal();
      loadContacts();
      loadCRMDashboard();
    });
  }

  // Call form submit
  const callForm = document.getElementById('call-form');
  if (callForm) {
    callForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(callForm));
      const contactId = data.contact_id;

      // Log the call
      await adminFetch('/api/crm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: parseInt(contactId),
          call_date: data.call_date || undefined,
          duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : undefined,
          outcome: data.outcome,
          notes: data.notes
        })
      });

      // Update contact status based on outcome
      const statusMap = {
        'no_answer': 'no_answer',
        'voicemail': 'contacted',
        'spoke_interested': 'interested',
        'spoke_not_interested': 'not_interested',
        'spoke_callback': 'contacted',
        'spoke_signed': 'signed',
        'wrong_number': 'not_interested'
      };
      if (statusMap[data.outcome]) {
        const contact = await adminFetch(`/api/crm/contacts/${contactId}`);
        if (contact) {
          await adminFetch(`/api/crm/contacts/${contactId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...contact, status: statusMap[data.outcome], calls: undefined, followups: undefined })
          });
        }
      }

      // Schedule follow-up if date provided
      if (data.followup_date) {
        await adminFetch('/api/crm/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: parseInt(contactId),
            followup_date: data.followup_date,
            followup_type: 'call',
            reason: data.followup_reason || 'Follow up on previous call'
          })
        });
      }

      closeModal();
      loadContacts();
      loadCRMDashboard();
      loadFollowups('pending');
    });
  }

  function showDashboard() {
    loginDiv.style.display = 'none';
    dashboard.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    loadCRMDashboard();
    loadContacts();
    loadFollowups('pending');
    loadApplications('pending');
    loadBusinesses();
    loadMessages();
    loadZipcodes();
  }

  // ==================== CRM DASHBOARD ====================

  async function loadCRMDashboard() {
    const stats = await adminFetch('/api/crm/dashboard');
    if (!stats) return;

    const statsDiv = document.getElementById('crm-stats');
    const statusCount = (s) => (stats.byStatus.find(x => x.status === s) || { count: 0 }).count;

    statsDiv.innerHTML = `
      <div class="crm-stat-card stat-overdue">
        <div class="crm-stat-number">${stats.overdueFollowups}</div>
        <div class="crm-stat-label">Overdue</div>
      </div>
      <div class="crm-stat-card stat-today">
        <div class="crm-stat-number">${stats.todayFollowups}</div>
        <div class="crm-stat-label">Due Today</div>
      </div>
      <div class="crm-stat-card stat-upcoming">
        <div class="crm-stat-number">${stats.upcomingFollowups}</div>
        <div class="crm-stat-label">Upcoming</div>
      </div>
      <div class="crm-stat-card stat-calls">
        <div class="crm-stat-number">${stats.callsThisWeek}</div>
        <div class="crm-stat-label">Calls This Week</div>
      </div>
      <div class="crm-stat-card">
        <div class="crm-stat-number" style="color:var(--color-navy);">${stats.totalContacts}</div>
        <div class="crm-stat-label">Total Contacts</div>
      </div>
      <div class="crm-stat-card">
        <div class="crm-stat-number" style="color:var(--color-success);">${statusCount('interested') + statusCount('negotiating')}</div>
        <div class="crm-stat-label">Hot Leads</div>
      </div>
      <div class="crm-stat-card">
        <div class="crm-stat-number" style="color:var(--color-gold);">${statusCount('signed')}</div>
        <div class="crm-stat-label">Signed</div>
      </div>
    `;

    // Load overdue follow-ups
    const overdue = await adminFetch('/api/crm/followups?completed=0');
    if (overdue) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const today = now.toISOString().split('T')[0];

      const overdueItems = overdue.filter(f => f.followup_date < today);
      const todayItems = overdue.filter(f => f.followup_date.startsWith(today));

      document.getElementById('crm-overdue-table').innerHTML = overdueItems.length
        ? overdueItems.map(f => followupRowHTML(f, true)).join('')
        : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--color-success);">No overdue follow-ups! You\'re on top of it.</td></tr>';

      document.getElementById('crm-today-table').innerHTML = todayItems.length
        ? todayItems.map(f => followupRowHTML(f, false)).join('')
        : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--color-text-light);">Nothing scheduled for today.</td></tr>';
    }
  }

  // ==================== CRM CONTACTS ====================

  async function loadContacts() {
    const search = document.getElementById('crm-search')?.value || '';
    const status = document.getElementById('crm-status-filter')?.value || '';
    let url = '/api/crm/contacts?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    const data = await adminFetch(url);
    if (!data) return;

    document.getElementById('crm-contacts-table').innerHTML = data.length
      ? data.map(c => {
          const fuDate = c.next_followup_date;
          let fuBadge = '';
          if (fuDate) {
            const today = new Date().toISOString().split('T')[0];
            if (fuDate < today) fuBadge = `<span class="badge badge-overdue">${fuDate}</span>`;
            else if (fuDate === today) fuBadge = `<span class="badge badge-due_today">${fuDate}</span>`;
            else fuBadge = `<span class="badge badge-upcoming">${fuDate}</span>`;
          } else {
            fuBadge = '<span style="color:var(--color-text-light);font-size:0.85rem;">None</span>';
          }

          return `<tr>
            <td><strong style="cursor:pointer;color:var(--color-navy);" onclick="viewContact(${c.id})">${esc(c.business_name)}</strong></td>
            <td>${esc(c.contact_name || '-')}</td>
            <td>${esc(c.phone || '-')}</td>
            <td>${esc(c.zipcode || '-')}</td>
            <td><span class="badge badge-${c.status}">${c.status.replace('_', ' ')}</span></td>
            <td>${c.last_call_date ? new Date(c.last_call_date).toLocaleDateString() : '<span style="color:var(--color-text-light);font-size:0.85rem;">Never</span>'}</td>
            <td>${fuBadge}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${c.id},'${esc(c.business_name)}')">Log Call</button>
              <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="openContactModal(${c.id})">Edit</button>
              <button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteContact(${c.id})">Del</button>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:24px;">No contacts yet. Add your first one!</td></tr>';
  }

  // ==================== CRM FOLLOW-UPS ====================

  async function loadFollowups(filter) {
    let url = '/api/crm/followups?';
    if (filter === 'pending') url += 'completed=0';
    else if (filter === 'completed') url += 'completed=1';

    const data = await adminFetch(url);
    if (!data) return;

    document.getElementById('crm-followups-table').innerHTML = data.length
      ? data.map(f => {
          const today = new Date().toISOString().split('T')[0];
          let dateBadge;
          if (f.completed) dateBadge = `<span class="badge badge-completed">${f.followup_date}</span>`;
          else if (f.followup_date < today) dateBadge = `<span class="badge badge-overdue">${f.followup_date}</span>`;
          else if (f.followup_date === today) dateBadge = `<span class="badge badge-due_today">${f.followup_date}</span>`;
          else dateBadge = `<span class="badge badge-upcoming">${f.followup_date}</span>`;

          return `<tr>
            <td>${dateBadge}</td>
            <td><strong>${esc(f.business_name)}</strong></td>
            <td>${esc(f.contact_name || '-')}</td>
            <td>${esc(f.phone || '-')}</td>
            <td>${esc(f.followup_type || 'call')}</td>
            <td>${esc(f.reason || '-')}</td>
            <td>${f.completed ? '<span class="badge badge-completed">Done</span>' : '<span class="badge badge-pending">Pending</span>'}</td>
            <td style="white-space:nowrap;">
              ${!f.completed ? `
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${f.contact_id},'${esc(f.business_name)}')">Call Now</button>
                <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="completeFollowup(${f.id})">Done</button>
              ` : ''}
              <button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteFollowup(${f.id})">Del</button>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:24px;">No follow-ups found.</td></tr>';
  }

  function followupRowHTML(f, isOverdue) {
    return `<tr>
      <td><strong>${esc(f.business_name)}</strong></td>
      <td>${esc(f.contact_name || '-')}</td>
      <td>${f.phone ? `<a href="tel:${esc(f.phone)}" style="color:var(--color-rust);font-weight:600;">${esc(f.phone)}</a>` : '-'}</td>
      ${isOverdue ? `<td><span class="badge badge-overdue">${f.followup_date}</span></td>` : `<td>${esc(f.followup_type || 'call')}</td>`}
      <td>${esc(f.reason || '-')}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="openCallModal(${f.contact_id},'${esc(f.business_name)}')">Call Now</button>
        <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="completeFollowup(${f.id})">Done</button>
      </td>
    </tr>`;
  }

  // ==================== MODAL FUNCTIONS ====================

  window.openContactModal = async function(id) {
    const form = document.getElementById('contact-form-crm');
    form.reset();
    document.getElementById('crm-contact-id').value = '';
    document.getElementById('modal-contact-title').textContent = 'Add Contact';

    if (id) {
      const c = await adminFetch(`/api/crm/contacts/${id}`);
      if (c) {
        document.getElementById('modal-contact-title').textContent = 'Edit Contact';
        document.getElementById('crm-contact-id').value = c.id;
        form.querySelector('[name="business_name"]').value = c.business_name || '';
        form.querySelector('[name="contact_name"]').value = c.contact_name || '';
        form.querySelector('[name="phone"]').value = c.phone || '';
        form.querySelector('[name="email"]').value = c.email || '';
        form.querySelector('[name="website"]').value = c.website || '';
        form.querySelector('[name="address"]').value = c.address || '';
        form.querySelector('[name="zipcode"]').value = c.zipcode || '';
        form.querySelector('[name="category"]').value = c.category || '';
        form.querySelector('[name="source"]').value = c.source || 'manual';
        form.querySelector('[name="status"]').value = c.status || 'new';
        form.querySelector('[name="notes"]').value = c.notes || '';
      }
    }

    showModal('modal-contact');
  };

  window.openCallModal = function(contactId, businessName) {
    const form = document.getElementById('call-form');
    form.reset();
    document.getElementById('call-contact-id').value = contactId;
    document.getElementById('call-business-name').textContent = businessName;
    // Default call date to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.querySelector('#call-form [name="call_date"]').value = now.toISOString().slice(0, 16);
    showModal('modal-call');
  };

  window.viewContact = async function(id) {
    const c = await adminFetch(`/api/crm/contacts/${id}`);
    if (!c) return;

    document.getElementById('detail-title').textContent = c.business_name;
    const content = document.getElementById('detail-content');

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div>
          <strong>Contact:</strong> ${esc(c.contact_name || '-')}<br>
          <strong>Phone:</strong> ${c.phone ? `<a href="tel:${esc(c.phone)}" style="color:var(--color-rust);">${esc(c.phone)}</a>` : '-'}<br>
          <strong>Email:</strong> ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '-'}<br>
          <strong>Website:</strong> ${c.website ? `<a href="${esc(c.website)}" target="_blank">${esc(c.website)}</a>` : '-'}
        </div>
        <div>
          <strong>Zipcode:</strong> ${esc(c.zipcode || '-')}<br>
          <strong>Category:</strong> ${esc(c.category || '-')}<br>
          <strong>Source:</strong> ${esc(c.source || '-')}<br>
          <strong>Status:</strong> <span class="badge badge-${c.status}">${c.status.replace('_', ' ')}</span>
        </div>
      </div>
      ${c.notes ? `<div style="margin-bottom:24px;padding:12px;background:var(--color-bg-warm);border-radius:var(--radius);"><strong>Notes:</strong> ${esc(c.notes)}</div>` : ''}

      <div style="display:flex;gap:8px;margin-bottom:24px;">
        <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.85rem;" onclick="closeModal();openCallModal(${c.id},'${esc(c.business_name)}')">Log a Call</button>
        <button class="btn btn-navy" style="padding:8px 16px;font-size:0.85rem;" onclick="closeModal();openContactModal(${c.id})">Edit Contact</button>
      </div>

      <h4 style="margin-bottom:12px;">Call History (${c.calls.length})</h4>
      ${c.calls.length ? c.calls.map(call => `
        <div class="call-history-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${new Date(call.call_date).toLocaleString()}</strong>
            <span class="badge badge-${call.outcome === 'spoke_signed' ? 'signed' : call.outcome === 'spoke_interested' ? 'interested' : call.outcome === 'no_answer' ? 'no_answer' : 'contacted'}">${call.outcome.replace(/_/g, ' ')}</span>
          </div>
          ${call.duration_minutes ? `<div style="font-size:0.85rem;color:var(--color-text-light);">${call.duration_minutes} min</div>` : ''}
          ${call.notes ? `<div style="margin-top:4px;font-size:0.9rem;">${esc(call.notes)}</div>` : ''}
        </div>
      `).join('') : '<p style="color:var(--color-text-light);">No calls logged yet.</p>'}

      <h4 style="margin:24px 0 12px;">Follow-Ups (${c.followups.length})</h4>
      ${c.followups.length ? c.followups.map(f => {
        const today = new Date().toISOString().split('T')[0];
        let badge;
        if (f.completed) badge = '<span class="badge badge-completed">Done</span>';
        else if (f.followup_date < today) badge = '<span class="badge badge-overdue">Overdue</span>';
        else if (f.followup_date === today) badge = '<span class="badge badge-due_today">Today</span>';
        else badge = '<span class="badge badge-upcoming">Upcoming</span>';
        return `<div class="call-history-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${f.followup_date}</strong> ${badge}
          </div>
          <div style="font-size:0.9rem;">${esc(f.reason || f.followup_type || 'Follow up')}</div>
        </div>`;
      }).join('') : '<p style="color:var(--color-text-light);">No follow-ups scheduled.</p>'}
    `;

    showModal('modal-detail');
  };

  window.deleteContact = async function(id) {
    if (!confirm('Delete this contact and all their call history?')) return;
    await adminFetch(`/api/crm/contacts/${id}`, { method: 'DELETE' });
    loadContacts();
    loadCRMDashboard();
  };

  window.completeFollowup = async function(id) {
    await adminFetch(`/api/crm/followups/${id}/complete`, { method: 'PATCH' });
    loadFollowups('pending');
    loadCRMDashboard();
  };

  window.deleteFollowup = async function(id) {
    if (!confirm('Delete this follow-up?')) return;
    await adminFetch(`/api/crm/followups/${id}`, { method: 'DELETE' });
    loadFollowups('pending');
    loadCRMDashboard();
  };

  function showModal(modalId) {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById(modalId).style.display = 'block';
  }

  window.closeModal = function() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  };

  // Close modal on overlay click
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // ==================== ORIGINAL ADMIN TABS ====================

  async function loadApplications(status) {
    const url = status ? `/api/admin/applications?status=${status}` : '/api/admin/applications';
    const data = await adminFetch(url);
    if (!data) return;
    document.getElementById('applications-table').innerHTML = data.map(a => `
      <tr>
        <td><strong>${esc(a.business_name)}</strong></td>
        <td>${esc(a.contact_name)}<br><small>${esc(a.email)}</small></td>
        <td>${esc(a.category)}</td>
        <td>${esc(a.zipcode)}</td>
        <td>${new Date(a.created_at).toLocaleDateString()}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td>
          ${a.status === 'pending' ? `
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="updateApp(${a.id},'approved')">Approve</button>
            <button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="updateApp(${a.id},'rejected')">Reject</button>
            <button class="btn btn-navy" style="padding:4px 10px;font-size:0.75rem;" onclick="appToCRM(${a.id})">Add to CRM</button>
          ` : ''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;">No applications found.</td></tr>';
  }

  window.updateApp = async function(id, status) {
    await adminFetch(`/api/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    loadApplications('pending');
  };

  // Convert application to CRM contact
  window.appToCRM = async function(id) {
    const apps = await adminFetch('/api/admin/applications');
    const app = apps?.find(a => a.id === id);
    if (!app) return;

    await adminFetch('/api/crm/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: app.business_name,
        contact_name: app.contact_name,
        phone: app.phone,
        email: app.email,
        website: app.website,
        zipcode: app.zipcode,
        category: app.category,
        source: 'application',
        status: 'new',
        notes: app.description ? `From application: ${app.description}` : ''
      })
    });

    alert('Contact added to CRM!');
    loadContacts();
    loadCRMDashboard();
  };

  async function loadBusinesses() {
    const data = await adminFetch('/api/admin/businesses');
    if (!data) return;
    document.getElementById('businesses-table').innerHTML = data.map(b => `
      <tr>
        <td><strong>${esc(b.name)}</strong></td>
        <td>${esc(b.category_name || '-')}</td>
        <td>${esc(b.zipcode || '-')} ${b.neighborhood ? `(${esc(b.neighborhood)})` : ''}</td>
        <td>${b.featured ? '<span class="badge badge-approved">Yes</span>' : 'No'}</td>
        <td>${b.active ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-rejected">Inactive</span>'}</td>
        <td><button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteBiz(${b.id})">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No businesses yet.</td></tr>';
  }

  window.deleteBiz = async function(id) {
    if (!confirm('Delete this business?')) return;
    await adminFetch(`/api/admin/businesses/${id}`, { method: 'DELETE' });
    loadBusinesses();
  };

  async function loadMessages() {
    const data = await adminFetch('/api/admin/messages');
    if (!data) return;
    document.getElementById('messages-table').innerHTML = data.map(m => `
      <tr style="${m.read ? '' : 'font-weight:600;background:var(--color-bg-warm);'}">
        <td>${esc(m.name)}</td>
        <td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
        <td>${esc(m.subject || '-')}</td>
        <td style="max-width:300px;">${esc(m.message).substring(0, 100)}${m.message.length > 100 ? '...' : ''}</td>
        <td>${new Date(m.created_at).toLocaleDateString()}</td>
        <td>${m.read ? '<span class="badge badge-approved">Read</span>' : `<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="markRead(${m.id})">Mark Read</button>`}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No messages yet.</td></tr>';
  }

  window.markRead = async function(id) {
    await adminFetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' });
    loadMessages();
  };

  async function loadZipcodes() {
    const data = await adminFetch('/api/admin/zipcodes');
    if (!data) return;
    document.getElementById('zipcodes-table').innerHTML = data.map(z => `
      <tr>
        <td><strong>${esc(z.zipcode)}</strong></td>
        <td>${esc(z.neighborhood || '-')}</td>
        <td>${z.business_count}</td>
        <td>${z.active ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-rejected">Inactive</span>'}</td>
      </tr>
    `).join('');
  }

  // ==================== HELPERS ====================

  async function adminFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = 'Basic ' + authToken;
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        authToken = null;
        sessionStorage.removeItem('lh_admin');
        location.reload();
        return null;
      }
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
