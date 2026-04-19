// Heroes blog — public reader (list + single post)
(function () {
  const isPostPage = !!document.getElementById('blog-post');

  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const getInitials = (name) => (name || 'LH').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();

  // Sanitize body HTML at render-time: strip script/style/iframe/event-handlers.
  function sanitize(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    tpl.content.querySelectorAll('script, style, iframe, object, embed').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(a => {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if (a.name === 'href' && /^javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  }

  // ---------- LIST PAGE ----------
  if (!isPostPage && document.getElementById('blog-grid')) {
    const grid = document.getElementById('blog-grid');
    const empty = document.getElementById('blog-empty');
    const search = document.getElementById('blog-search');
    const tagsWrap = document.getElementById('blog-tags');
    let activeTag = null;
    let searchTimer = null;

    async function loadTags() {
      try {
        const res = await fetch('/api/blog/tags');
        const tags = await res.json();
        if (!tags.length) return;
        tagsWrap.innerHTML = '<button class="blog-tag-btn active" data-tag="">All</button>' +
          tags.map(t => `<button class="blog-tag-btn" data-tag="${escapeHtml(t.tag)}">${escapeHtml(t.tag)} (${t.count})</button>`).join('');
        tagsWrap.querySelectorAll('.blog-tag-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            tagsWrap.querySelectorAll('.blog-tag-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTag = btn.dataset.tag || null;
            loadPosts();
          });
        });
      } catch (e) { /* ignore */ }
    }

    async function loadPosts() {
      const params = new URLSearchParams();
      if (search.value.trim()) params.set('q', search.value.trim());
      if (activeTag) params.set('tag', activeTag);
      grid.innerHTML = '<p class="blog-loading">Loading stories…</p>';
      empty.style.display = 'none';
      try {
        const res = await fetch('/api/blog/posts?' + params.toString());
        const posts = await res.json();
        if (!posts.length) {
          grid.innerHTML = '';
          empty.style.display = 'block';
          return;
        }
        grid.innerHTML = posts.map(p => {
          const img = p.featured_image
            ? `<div class="blog-card-image" style="background-image:url('${escapeHtml(p.featured_image)}')"></div>`
            : `<div class="blog-card-image placeholder">★</div>`;
          return `
            <a href="heroes-post.html?slug=${encodeURIComponent(p.slug)}" class="blog-card">
              ${img}
              <div class="blog-card-body">
                <span class="blog-card-cat">${escapeHtml(p.category || 'Story')}</span>
                <h3 class="blog-card-title">${escapeHtml(p.title)}</h3>
                <p class="blog-card-excerpt">${escapeHtml(p.excerpt || '')}</p>
                <div class="blog-card-meta">
                  <span>${escapeHtml(p.author_name || 'Local Heroes')} • ${fmtDate(p.publish_at || p.created_at)}</span>
                  <span class="blog-card-meta-stat">♥ ${p.like_count || 0}</span>
                </div>
              </div>
            </a>`;
        }).join('');
      } catch (e) {
        grid.innerHTML = '<p class="blog-loading">Could not load stories. Please try again.</p>';
      }
    }

    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadPosts, 300);
    });

    loadTags();
    loadPosts();
  }

  // ---------- SINGLE POST ----------
  if (isPostPage) {
    const wrap = document.getElementById('blog-post');
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) {
      wrap.innerHTML = '<p class="blog-loading">No story specified.</p>';
      return;
    }

    async function loadPost() {
      try {
        const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          wrap.innerHTML = '<p class="blog-loading">Story not found. <a href="heroes.html">Back to Heroes</a></p>';
          return;
        }
        const p = await res.json();

        // SEO
        document.getElementById('post-title-tag').textContent = (p.seo_title || p.title) + ' | Local Heroes Houston';
        const metaDesc = document.getElementById('post-meta-desc');
        const ogTitle = document.getElementById('post-og-title');
        const ogDesc = document.getElementById('post-og-desc');
        const ogImg = document.getElementById('post-og-image');
        if (metaDesc) metaDesc.content = p.seo_description || p.excerpt || '';
        if (ogTitle) ogTitle.content = p.seo_title || p.title;
        if (ogDesc) ogDesc.content = p.seo_description || p.excerpt || '';
        if (ogImg) ogImg.content = p.og_image || p.featured_image || '';

        const avatar = p.author_avatar
          ? `<div class="blog-post-avatar" style="background-image:url('${escapeHtml(p.author_avatar)}')"></div>`
          : `<div class="blog-post-avatar">${escapeHtml(getInitials(p.author_name))}</div>`;

        const tagsHtml = (p.tags && p.tags.length)
          ? `<div class="blog-tags-list blog-tags">${p.tags.map(t => `<span class="blog-tag-btn">${escapeHtml(t)}</span>`).join('')}</div>`
          : '';

        const heroImg = p.featured_image
          ? `<img class="blog-post-hero-img" src="${escapeHtml(p.featured_image)}" alt="">`
          : '';

        wrap.innerHTML = `
          ${heroImg}
          <span class="blog-post-cat">${escapeHtml(p.category || 'Story')}</span>
          <h1>${escapeHtml(p.title)}</h1>
          <div class="blog-post-meta">
            ${avatar}
            <div class="blog-post-meta-text">
              <span class="author-name">${escapeHtml(p.author_name || 'Local Heroes Team')}</span>
              ${fmtDate(p.publish_at || p.created_at)} • ${p.view_count || 1} views
            </div>
          </div>
          <div class="blog-post-body">${sanitize(p.body_html)}</div>
          ${p.author_bio ? `<p style="margin-top:32px;padding:16px;background:var(--color-cream,#fdfaf3);border-radius:8px;font-size:.95rem;color:#444;"><b>${escapeHtml(p.author_name)}</b> — ${escapeHtml(p.author_bio)}</p>` : ''}
          ${tagsHtml}
          <div class="blog-actions">
            <button id="like-btn" class="blog-like-btn">♥ <span id="like-count">${p.like_count || 0}</span></button>
            <button id="share-twitter" class="blog-share-btn">Share on X</button>
            <button id="share-fb" class="blog-share-btn">Share on Facebook</button>
            <button id="share-copy" class="blog-share-btn">Copy Link</button>
          </div>
          <div class="blog-comments">
            <h3 id="comments-heading">Comments</h3>
            <div id="comments-list"></div>
            <form id="comment-form" class="blog-comment-form">
              <div class="blog-comment-row">
                <input type="text" id="c-name" placeholder="Your name" required maxlength="80">
                <input type="email" id="c-email" placeholder="Email (not published)" maxlength="120">
              </div>
              <textarea id="c-body" placeholder="Share your thoughts…" required maxlength="4000"></textarea>
              <button type="submit" class="btn btn-primary">Post Comment</button>
            </form>
          </div>
        `;

        wireActions(p);
        loadComments();
      } catch (e) {
        wrap.innerHTML = '<p class="blog-loading">Could not load this story.</p>';
      }
    }

    function wireActions(post) {
      const likeBtn = document.getElementById('like-btn');
      const likeCount = document.getElementById('like-count');
      const liked = localStorage.getItem('blog-liked-' + post.slug) === '1';
      if (liked) likeBtn.classList.add('liked');
      likeBtn.addEventListener('click', async () => {
        if (likeBtn.classList.contains('liked')) return;
        try {
          const r = await fetch(`/api/blog/posts/${encodeURIComponent(post.slug)}/like`, { method: 'POST' });
          const j = await r.json();
          likeCount.textContent = j.like_count;
          likeBtn.classList.add('liked');
          localStorage.setItem('blog-liked-' + post.slug, '1');
        } catch {}
      });

      const url = location.href;
      const shareText = encodeURIComponent(post.title + ' — Local Heroes');
      document.getElementById('share-twitter').onclick = () =>
        window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(url)}`, '_blank');
      document.getElementById('share-fb').onclick = () =>
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      document.getElementById('share-copy').onclick = () => {
        navigator.clipboard.writeText(url).then(() => {
          const b = document.getElementById('share-copy');
          const orig = b.textContent;
          b.textContent = 'Copied!';
          setTimeout(() => b.textContent = orig, 1500);
        });
      };

      document.getElementById('comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const author_name = document.getElementById('c-name').value.trim();
        const author_email = document.getElementById('c-email').value.trim();
        const body = document.getElementById('c-body').value.trim();
        if (!author_name || !body) return;
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          const r = await fetch(`/api/blog/posts/${encodeURIComponent(post.slug)}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author_name, author_email, body })
          });
          if (!r.ok) throw new Error('Failed');
          document.getElementById('c-body').value = '';
          loadComments();
        } catch {
          alert('Could not post comment. Please try again.');
        } finally {
          btn.disabled = false;
        }
      });
    }

    async function loadComments() {
      try {
        const r = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}/comments`);
        const list = await r.json();
        const wrap = document.getElementById('comments-list');
        document.getElementById('comments-heading').textContent = `Comments (${list.length})`;
        if (!list.length) {
          wrap.innerHTML = '<p style="color:#888;">Be the first to comment.</p>';
          return;
        }
        wrap.innerHTML = list.map(c => `
          <div class="blog-comment">
            <div class="blog-comment-head">
              <span class="blog-comment-author">${escapeHtml(c.author_name)}</span>
              <span class="blog-comment-date">${fmtDate(c.created_at)}</span>
            </div>
            <div class="blog-comment-body">${escapeHtml(c.body)}</div>
          </div>
        `).join('');
      } catch {}
    }

    loadPost();
  }
})();
