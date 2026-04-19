/* Local Heroes — Admin Heroes Blog editor */
(function () {
  function token() {
    return localStorage.getItem('lh_token') || sessionStorage.getItem('lh_token');
  }

  async function api(url, options = {}) {
    options.headers = options.headers || {};
    const t = token();
    if (t) options.headers['Authorization'] = 'Bearer ' + t;
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
      console.warn('Heroes admin: not authorized');
      return null;
    }
    if (!res.ok) {
      let msg = 'Request failed';
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const fmtDateTimeInput = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    const off = dt.getTimezoneOffset();
    const local = new Date(dt.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  };

  function renderStatusPill(status, publish_at) {
    if (status === 'published' && publish_at && new Date(publish_at) > new Date())
      return '<span class="heroes-status-pill scheduled">Scheduled</span>';
    return `<span class="heroes-status-pill ${status}">${status}</span>`;
  }

  // ---- LIST ----
  window.loadHeroPosts = async function () {
    const wrap = document.getElementById('heroes-list');
    if (!wrap) return;
    const filter = document.getElementById('heroes-filter')?.value;
    wrap.innerHTML = '<p style="text-align:center;color:#888;">Loading…</p>';
    let posts;
    try { posts = await api('/api/blog/admin/posts'); } catch (e) { wrap.innerHTML = `<p style="color:#B71C1C;">${e.message}</p>`; return; }
    if (!posts) { wrap.innerHTML = '<p style="color:#888;">Sign in as an admin to manage Hero stories.</p>'; return; }
    const list = filter ? posts.filter(p => p.status === filter) : posts;
    if (!list.length) {
      wrap.innerHTML = '<p style="text-align:center;color:#888;padding:24px;">No posts yet. Click <b>+ New Story</b> to create one.</p>';
      return;
    }
    wrap.innerHTML = list.map(p => `
      <div class="heroes-list-row">
        <div class="heroes-thumb" ${p.featured_image ? `style="background-image:url('${escapeHtml(p.featured_image)}')"` : ''}></div>
        <div>
          <div style="font-weight:600;color:var(--color-navy);">${escapeHtml(p.title)}</div>
          <div style="font-size:.85rem;color:#777;">
            ${escapeHtml(p.category || 'Story')} • ${fmtDate(p.publish_at || p.created_at)} • ♥ ${p.like_count || 0} • 👁 ${p.view_count || 0}
          </div>
        </div>
        <div>${renderStatusPill(p.status, p.publish_at)}</div>
        <button class="btn btn-secondary" style="padding:6px 12px;font-size:.85rem;" onclick="openHeroPostModal(${p.id})">Edit</button>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary" style="padding:6px 10px;font-size:.8rem;" onclick="viewHeroPost('${escapeHtml(p.slug)}','${p.status}')">View</button>
          <button class="btn btn-secondary" style="padding:6px 10px;font-size:.8rem;color:#B71C1C;" onclick="deleteHeroPost(${p.id})">✕</button>
        </div>
      </div>
    `).join('') + `<p style="font-size:.8rem;color:#888;margin-top:12px;">Tip: only published posts are visible publicly. Schedule by setting a future publish date.</p>`;
  };

  window.viewHeroPost = function (slug, status) {
    if (status !== 'published') {
      alert('This post is a draft. Set status to Published to view it on the public site.');
      return;
    }
    window.open('/heroes-post.html?slug=' + encodeURIComponent(slug), '_blank');
  };

  window.deleteHeroPost = async function (id) {
    if (!confirm('Delete this story permanently? This cannot be undone.')) return;
    try { await api('/api/blog/admin/posts/' + id, { method: 'DELETE' }); loadHeroPosts(); }
    catch (e) { alert(e.message); }
  };

  window.loadHeroComments = async function () {
    const section = document.getElementById('heroes-comments-section');
    const wrap = document.getElementById('heroes-comments-list');
    if (!wrap) return;
    let comments;
    try { comments = await api('/api/blog/admin/comments'); }
    catch { if (section) section.style.display = 'none'; return; }
    if (!comments) return;
    if (section) section.style.display = ''; // user is admin
    if (!comments.length) { wrap.innerHTML = '<p style="color:#888;">No comments yet.</p>'; return; }
    wrap.innerHTML = comments.slice(0, 50).map(c => `
      <div class="blog-comment" style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start;">
        <div>
          <div class="blog-comment-head">
            <span class="blog-comment-author">${escapeHtml(c.author_name)}</span>
            <span class="blog-comment-date">${fmtDate(c.created_at)} on <b>${escapeHtml(c.post_title)}</b></span>
          </div>
          <div class="blog-comment-body">${escapeHtml(c.body)}</div>
        </div>
        <button class="btn btn-secondary" style="padding:4px 10px;font-size:.8rem;" onclick="deleteHeroComment(${c.id})">Delete</button>
      </div>
    `).join('');
  };

  window.deleteHeroComment = async function (id) {
    if (!confirm('Delete this comment?')) return;
    try { await api('/api/blog/admin/comments/' + id, { method: 'DELETE' }); loadHeroComments(); } catch (e) { alert(e.message); }
  };

  // ---- INTERVIEW KIT (25 questions) ----
  const INTERVIEW_SECTIONS = [
    { title: '🌱 Origin Story', questions: [
      'What were you doing before you started this business — and what was the moment you decided to go for it?',
      'Where did the name come from? Is there a story behind it?',
      'What did the very first day, week, or sale feel like? Be specific — sights, sounds, nerves.',
      'Who believed in you early on, and who didn\'t? How did that shape you?',
      'What\'s one thing you wish someone had told you on day one?'
    ]},
    { title: '⚙️ The Craft', questions: [
      'Walk me through your typical day from open to close — what\'s the rhythm?',
      'What\'s the one detail in your product or service that customers usually don\'t notice but matters most to you?',
      'Where do your ingredients, materials, or tools come from? Any local partnerships?',
      'What\'s a skill you\'ve had to teach yourself the hard way?',
      'If you had to demonstrate the heart of what you do in 60 seconds, what would you show?'
    ]},
    { title: '❤️ The Customers', questions: [
      'Tell me about a customer who became a regular — what hooked them?',
      'What\'s the most memorable thing a customer has ever said or done?',
      'Have you ever had a customer in tears (good or bad)? What happened?',
      'Who is your "perfect-fit" customer — and what should they know before walking in?',
      'What\'s a misconception people have about your business that you\'d love to clear up?'
    ]},
    { title: '🛠️ Houston Roots', questions: [
      'Why this neighborhood? What does it mean to you to be here specifically?',
      'How has Houston (the people, the weather, the culture) shaped what you do?',
      'Are there other local businesses you collaborate with, refer to, or just love?',
      'What\'s your favorite thing about your block or zipcode that nobody talks about?',
      'If a tourist had one hour in your neighborhood, where should they go?'
    ]},
    { title: '🌟 The Mission & The Future', questions: [
      'When the day is hard, what keeps you going?',
      'What does success look like for you 12 months from now? 5 years?',
      'What\'s something you\'re proud of that nobody knows about?',
      'How can the community support you beyond just buying from you?',
      'If someone reads this story and walks through your door tomorrow — what do you want them to leave with?'
    ]}
  ];

  function flattenQuestions() {
    const lines = [];
    let n = 1;
    INTERVIEW_SECTIONS.forEach(sec => {
      lines.push('');
      lines.push(sec.title);
      sec.questions.forEach(q => { lines.push(`${n}. ${q}`); n++; });
    });
    return lines.join('\n').trim();
  }

  window.openInterviewKit = function () {
    const wrap = document.getElementById('interview-kit-content');
    if (wrap) {
      let n = 1;
      wrap.innerHTML = INTERVIEW_SECTIONS.map(sec => `
        <h3 style="color:var(--color-rust);margin:18px 0 8px;border-bottom:1px solid #f0e6dc;padding-bottom:6px;">${escapeHtml(sec.title)}</h3>
        <ol start="${n}" style="line-height:1.7;color:#333;padding-left:22px;">
          ${sec.questions.map(q => { const li = `<li style="margin-bottom:6px;">${escapeHtml(q)}</li>`; n++; return li; }).join('')}
        </ol>
      `).join('');
    }
    document.getElementById('modal-overlay').style.display = 'flex';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById('modal-hero-interview').style.display = 'block';
  };

  window.copyInterviewQuestions = async function () {
    const text = 'LOCAL HEROES — INTERVIEW QUESTIONS\n' + flattenQuestions();
    try { await navigator.clipboard.writeText(text); alert('All 25 questions copied to clipboard.'); }
    catch { prompt('Copy these questions:', text); }
  };

  window.copyInterviewEmail = async function () {
    const text =
`Subject: We'd love to feature you in a Local Heroes spotlight 🌟

Hi [Owner Name],

We'd like to write a Hero Spotlight feature about [Business Name] for LocalHeroes.com — a free way to share your story with thousands of households in your neighborhood.

We'll handle the writing and publishing. All we need from you is some answers to the questions below — reply by email, or schedule a 30-minute call and we'll do the interview live.

If you have a few photos (you, your space, your product), please send those too.

` + flattenQuestions() + `

Thanks for what you do for the neighborhood — looking forward to telling your story.

— Local Heroes`;
    try { await navigator.clipboard.writeText(text); alert('Email template copied to clipboard.'); }
    catch { prompt('Copy this email:', text); }
  };

  // ---- EDITOR MODAL ----
  let currentEditor = null;

  window.openHeroPostModal = async function (id) {
    document.getElementById('hero-post-id').value = id || '';
    document.getElementById('hero-modal-title').textContent = id ? 'Edit Hero Story' : 'New Hero Story';

    // Reset
    ['hero-title','hero-slug','hero-excerpt','hero-featured-image','hero-tags',
     'hero-author-name','hero-author-avatar','hero-author-bio',
     'hero-seo-title','hero-seo-description','hero-og-image','hero-publish-at'
    ].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
    document.getElementById('hero-category').value = 'Spotlight';
    document.getElementById('hero-status').value = 'draft';
    document.getElementById('hero-body-editor').innerHTML = '';
    document.getElementById('hero-image-preview').innerHTML = '';

    if (id) {
      try {
        const p = await api('/api/blog/admin/posts/' + id);
        if (p) {
          document.getElementById('hero-title').value = p.title || '';
          document.getElementById('hero-slug').value = p.slug || '';
          document.getElementById('hero-excerpt').value = p.excerpt || '';
          document.getElementById('hero-featured-image').value = p.featured_image || '';
          document.getElementById('hero-body-editor').innerHTML = p.body_html || '';
          document.getElementById('hero-category').value = p.category || 'Spotlight';
          document.getElementById('hero-tags').value = (p.tags || []).join(', ');
          document.getElementById('hero-status').value = p.status || 'draft';
          document.getElementById('hero-publish-at').value = fmtDateTimeInput(p.publish_at);
          document.getElementById('hero-author-name').value = p.author_name || '';
          document.getElementById('hero-author-avatar').value = p.author_avatar || '';
          document.getElementById('hero-author-bio').value = p.author_bio || '';
          document.getElementById('hero-seo-title').value = p.seo_title || '';
          document.getElementById('hero-seo-description').value = p.seo_description || '';
          document.getElementById('hero-og-image').value = p.og_image || '';
          if (p.featured_image) document.getElementById('hero-image-preview').innerHTML = `<img src="${p.featured_image}" style="max-height:140px;border-radius:6px;">`;
        }
      } catch (e) { alert(e.message); return; }
    }

    document.getElementById('modal-overlay').style.display = 'flex';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById('modal-hero-post').style.display = 'block';
  };

  window.saveHeroPost = async function (forcedStatus) {
    const id = document.getElementById('hero-post-id').value;
    const data = {
      title: document.getElementById('hero-title').value.trim(),
      slug: document.getElementById('hero-slug').value.trim() || undefined,
      excerpt: document.getElementById('hero-excerpt').value.trim(),
      body_html: document.getElementById('hero-body-editor').innerHTML.trim(),
      featured_image: document.getElementById('hero-featured-image').value.trim() || null,
      category: document.getElementById('hero-category').value,
      tags: document.getElementById('hero-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      status: forcedStatus || document.getElementById('hero-status').value,
      publish_at: document.getElementById('hero-publish-at').value
        ? new Date(document.getElementById('hero-publish-at').value).toISOString() : null,
      author_name: document.getElementById('hero-author-name').value.trim() || 'Local Heroes Team',
      author_avatar: document.getElementById('hero-author-avatar').value.trim() || null,
      author_bio: document.getElementById('hero-author-bio').value.trim() || null,
      seo_title: document.getElementById('hero-seo-title').value.trim() || null,
      seo_description: document.getElementById('hero-seo-description').value.trim() || null,
      og_image: document.getElementById('hero-og-image').value.trim() || null
    };
    if (!data.title) return alert('Title is required.');
    if (!data.body_html || data.body_html === '<br>') return alert('Body cannot be empty.');

    try {
      if (id) {
        await api('/api/blog/admin/posts/' + id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
      } else {
        await api('/api/blog/admin/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
      }
      window.closeModal();
      loadHeroPosts();
    } catch (e) { alert(e.message); }
  };

  // ---- WIRING (after DOM ready) ----
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('hero-post-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveHeroPost('published');
    });

    document.getElementById('heroes-filter')?.addEventListener('change', loadHeroPosts);

    // Editor toolbar
    const editor = document.getElementById('hero-body-editor');
    document.querySelectorAll('.heroes-editor-toolbar button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        editor.focus();
        const cmd = btn.dataset.cmd;
        const arg = btn.dataset.arg;
        if (cmd === 'createLink') {
          const url = prompt('Link URL:', 'https://');
          if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'insertImage') {
          insertImageInBody();
        } else if (arg) {
          document.execCommand(cmd, false, arg);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });

    // Featured image upload
    document.getElementById('hero-image-upload')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await fetch('/api/blog/admin/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token() },
          body: fd
        });
        if (!res.ok) throw new Error('Upload failed');
        const j = await res.json();
        document.getElementById('hero-featured-image').value = j.url;
        document.getElementById('hero-image-preview').innerHTML = `<img src="${j.url}" style="max-height:140px;border-radius:6px;">`;
      } catch (err) { alert(err.message); }
    });

    // Auto-fill SEO from title if empty
    document.getElementById('hero-title')?.addEventListener('blur', () => {
      const t = document.getElementById('hero-title').value;
      const seo = document.getElementById('hero-seo-title');
      if (seo && !seo.value) seo.value = t;
      const slug = document.getElementById('hero-slug');
      if (slug && !slug.value) {
        slug.value = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
      }
    });
  });

  async function insertImageInBody() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await fetch('/api/blog/admin/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token() },
          body: fd
        });
        if (!res.ok) throw new Error('Upload failed');
        const j = await res.json();
        document.getElementById('hero-body-editor').focus();
        document.execCommand('insertImage', false, j.url);
      } catch (e) { alert(e.message); }
    };
    input.click();
  }
})();
