/* Local Heroes - Admin Panel JS */

let authToken = null;

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginDiv = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const logoutBtn = document.getElementById('logout-btn');

  // Check if already logged in
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

  function showDashboard() {
    loginDiv.style.display = 'none';
    dashboard.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    loadApplications('pending');
    loadBusinesses();
    loadMessages();
    loadZipcodes();
  }

  // --- Applications ---
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

  // --- Businesses ---
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
        <td>
          <button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteBiz(${b.id})">Delete</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No businesses yet.</td></tr>';
  }

  window.deleteBiz = async function(id) {
    if (!confirm('Delete this business?')) return;
    await adminFetch(`/api/admin/businesses/${id}`, { method: 'DELETE' });
    loadBusinesses();
  };

  // --- Messages ---
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
        <td>
          ${m.read ? '<span class="badge badge-approved">Read</span>' : `<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="markRead(${m.id})">Mark Read</button>`}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;">No messages yet.</td></tr>';
  }

  window.markRead = async function(id) {
    await adminFetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' });
    loadMessages();
  };

  // --- Zipcodes ---
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

  // --- Helpers ---
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
