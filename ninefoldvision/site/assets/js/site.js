// Shared behavior for every page: navigation, footer details, scroll reveals, reading progress, spoilers and
// the update/game renderers. Pages call into window.NFV.
(function () {
  document.documentElement.classList.remove('no-js');

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: progress just isn't kept */ } },
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // A small, safe subset of Markdown: **bold** and [label](url).
  const md = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => /^(https?:|mailto:|[\w./#?=-]+$)/.test(url) ? `<a href="${url}">${label}</a>` : label);

  const games = () => window.NFV_GAMES || [];
  const game = slug => games().find(g => g.slug === slug);
  const statusLabel = { live: 'Out now', dev: 'In development', soon: 'Coming soon' };

  /** Every game update the page has loaded, newest first within each game. */
  function gameUpdates(slug) {
    const generated = (window.NFV_GAME_UPDATES || {});
    const list = [];
    for (const g of games()) {
      if (slug && g.slug !== slug) continue;
      const items = generated[g.slug] || g.updates || [];
      items.forEach((u, i) => list.push({ ...u, game: g.slug, number: u.number || items.length - i }));
    }
    return list;
  }

  function renderUpdate(u, { open = false } = {}) {
    const g = game(u.game);
    const heads = (u.items || []).map(i => i.head).filter(Boolean);
    return `<details class="card update"${open ? ' open' : ''} style="--c:${g ? g.accent : 'var(--orange)'}">
      <summary>
        <div class="update-badge" style="border-color:${g ? g.accent : 'var(--line)'}"><span style="color:${g ? g.accent : 'var(--orange)'}">${esc(g ? g.name : 'Update')}</span><b>#${u.number}</b></div>
        <div><h3>${esc(u.title)}</h3><div class="heads">${esc(heads.slice(0, 6).join(' · '))}${heads.length > 6 ? ' …' : ''}</div></div>
        <span class="chev" aria-hidden="true">▾</span>
      </summary>
      <div class="update-body"><ul>${(u.items || []).map(i => `<li>${md(i.text)}</li>`).join('')}</ul></div>
    </details>`;
  }

  function renderNews(n) {
    const g = n.game && game(n.game);
    const date = new Date(`${n.date}T12:00:00`);
    return `<article class="card news-card">
      <time datetime="${esc(n.date)}">${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}${g ? ` · ${esc(g.name)}` : ' · Studio'}</time>
      <h3 style="margin-top:8px">${esc(n.title)}</h3>
      <p class="muted">${md(n.text)}</p>
      ${n.link ? `<a href="${esc(n.link.url)}">${esc(n.link.label)} →</a>` : ''}
    </article>`;
  }

  function renderGameCard(g) {
    const play = (g.links || []).find(l => l.primary);
    return `<article class="card game-card reveal">
      <a class="cover" href="game.html?g=${encodeURIComponent(g.slug)}" aria-label="${esc(g.name)}"><img src="${esc(g.cover)}" alt="${esc(g.name)} cover art" loading="lazy" width="1200" height="630"></a>
      <div class="body">
        <span class="status status-${esc(g.status)}">${statusLabel[g.status] || esc(g.status)}</span>
        <h3>${esc(g.name)}</h3>
        <p class="muted" style="margin:0">${esc(g.tagline)}</p>
        <div class="tags">${[g.genre, g.price, ...(g.platforms || [])].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="btn-row" style="margin-top:auto">
          ${play ? `<a class="btn btn-primary" href="${esc(play.url)}" rel="noopener">${esc(play.label)}</a>` : ''}
          <a class="btn btn-ghost" href="game.html?g=${encodeURIComponent(g.slug)}">Details &amp; updates</a>
        </div>
      </div>
    </article>`;
  }

  const forgeCard = () => `<div class="card forge-card reveal">
      <span class="status status-soon">Next project</span>
      <h3 style="margin-top:12px">In the forge</h3>
      <p class="muted" style="margin:0">Our next game is being built. It will appear here, with its updates, the day we announce it.</p>
    </div>`;

  // Reading progress, per book: the last chapter opened and every chapter finished.
  const progress = {
    get(slug) { const p = store.get(`nfv:read:${slug}`, null); return { last: p?.last || 0, done: new Set(p?.done || []) }; },
    save(slug, p) { store.set(`nfv:read:${slug}`, { last: p.last, done: [...p.done].sort((a, b) => a - b) }); },
    /** The furthest chapter this visitor has reached (opened or finished). */
    furthest(slug) { const p = progress.get(slug); return Math.max(p.last, ...p.done, 0); },
  };

  // Spoilers: anything marked .spoiler[data-ch] stays blurred until the reader has reached that chapter,
  // or until they switch "Show all spoilers" on, or tap the item itself.
  function applySpoilers(root = document) {
    const showAll = store.get('nfv:spoilers', false);
    root.querySelectorAll('.spoiler[data-ch]').forEach(el => {
      const book = el.dataset.book || (window.NFV_BOOKS && window.NFV_BOOKS[0] && window.NFV_BOOKS[0].slug);
      const reached = book ? progress.furthest(book) : 0;
      const ch = Number(el.dataset.ch);
      const hide = !showAll && reached < ch && !el.dataset.revealed;
      el.classList.toggle('hidden', hide);
      let cover = el.querySelector(':scope > .spoiler-cover');
      if (!cover) {
        cover = document.createElement('button');
        cover.type = 'button';
        cover.className = 'spoiler-cover';
        cover.innerHTML = `<span>Spoiler · revealed in chapter ${ch}<br>Tap to reveal</span>`;
        cover.addEventListener('click', () => { el.dataset.revealed = '1'; el.classList.remove('hidden'); });
        el.prepend(cover);
      }
      // Hide the blurred content from screen readers too, but never the button that reveals it.
      for (const child of el.children) if (child !== cover) child.toggleAttribute('aria-hidden', hide);
    });
    document.querySelectorAll('[data-spoiler-toggle]').forEach(input => {
      input.checked = showAll;
      if (!input.dataset.bound) {
        input.dataset.bound = '1';
        input.addEventListener('change', () => { store.set('nfv:spoilers', input.checked); applySpoilers(); });
      }
    });
  }

  function initChrome() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (toggle && nav) toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#site-nav a').forEach(a => {
      const target = a.getAttribute('href');
      if (target === here || (here === 'game.html' && target === 'games.html') || (here === '' && target === 'index.html')) a.setAttribute('aria-current', 'page');
    });
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

    const studio = window.NFV_STUDIO || {};
    const contact = [
      studio.email ? `<li><a href="mailto:${esc(studio.email)}">${esc(studio.email)}</a></li>` : '',
      ...(studio.socials || []).map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`),
    ].join('');
    document.querySelectorAll('[data-studio-contact]').forEach(el => {
      if (contact) el.innerHTML = contact; else el.closest('[data-studio-contact-block]')?.remove();
    });
    document.querySelectorAll('[data-game-links]').forEach(el => {
      el.innerHTML = games().map(g => `<li><a href="game.html?g=${encodeURIComponent(g.slug)}">${esc(g.name)}</a></li>`).join('');
    });
    observeReveals();
  }

  function observeReveals(root = document) {
    const items = root.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
  }

  window.NFV = { esc, md, store, games, game, gameUpdates, renderUpdate, renderNews, renderGameCard, forgeCard, progress, applySpoilers, observeReveals, statusLabel };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initChrome); else initChrome();
})();
