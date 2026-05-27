// Internal "doc" server — a small, SEO-friendly documentation site with
// a left sidebar, right content pane and built-in search. Exposed publicly
// at doc.<publicDomain> via the central tunnel registry.
const { createInternalServer, escapeHtml } = require('../base');
const config = require('../../config');
const { SECTIONS } = require('./pages');
const TRANSLATIONS = require('./translations');

const LOCALES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko'];
const LOCALE_SET = new Set(LOCALES);

function pickLocale(req) {
  const cookie = (req && req.headers && req.headers.cookie) || '';
  const m = cookie.match(/(?:^|;\s*)airweb-locale=([A-Za-z\-]+)/);
  if (!m) return 'en';
  const base = String(m[1]).toLowerCase().split('-')[0];
  return LOCALE_SET.has(base) ? base : 'en';
}

function tr(key, locale) {
  if (!locale || locale === 'en') return null;
  const tbl = TRANSLATIONS[locale];
  if (!tbl) return null;
  return Object.prototype.hasOwnProperty.call(tbl, key) ? tbl[key] : null;
}

function localizedSectionLabel(section, locale) {
  return tr(section.id + '.label', locale) || section.label;
}
function localizedPageField(page, field, locale) {
  return tr(page.slug + '.' + field, locale) || page[field] || '';
}

// ---------------------------------------------------------------------------
// URL / placeholder helpers
// ---------------------------------------------------------------------------

function apexBase() {
  // Canonical apex URL for the AirWeb site, already correct for dev
  // (e.g. http://lvh.me:8080) and prod (e.g. https://airweb.fyi). Do NOT
  // re-append config.http.port here — in production the Node port (8080)
  // sits behind a reverse proxy and must not leak into client-facing
  // URLs (CSS/JS would 404 / hang).
  if (config.http && config.http.publicBaseUrl) return config.http.publicBaseUrl;
  const scheme = (config.http && config.http.publicScheme) || 'http';
  const domain = (config.http && config.http.publicDomain) || 'localhost';
  return `${scheme}://${domain}`;
}

function docsBase(req) {
  // Build the canonical URL for THIS docs site from the Host header so
  // canonical/OG tags reflect the user-facing hostname (e.g.
  // https://doc.airweb.fyi) even though we're listening on 127.0.0.1.
  const scheme = (config.http && config.http.publicScheme) || 'http';
  const host = (req && req.headers && req.headers.host) || ('doc.' + (config.http.publicDomain || 'localhost'));
  return `${scheme}://${host}`;
}

function publicDomainBase() {
  // Strip the dev port for places where bare domain reads better.
  const d = (config.http && config.http.publicDomain) || 'localhost';
  return String(d).split(':')[0];
}

function tokenContext() {
  const apex = apexBase();
  const publicDomain = (config.http && config.http.publicDomain) || 'localhost';
  const sshHost = (config.ssh && config.ssh.publicHost) || publicDomainBase();
  const sshPort = (config.ssh && config.ssh.port) || 2222;
  const credits = (config && config.credits) || {};
  return {
    '{{APEX}}':                apex,
    '{{PUBLIC_DOMAIN}}':       publicDomain,
    '{{PUBLIC_DOMAIN_BASE}}':  publicDomainBase(),
    '{{SSH_HOST}}':            sshHost,
    '{{SSH_PORT}}':            String(sshPort),
    '{{CREDITS_SIGNUP_BONUS}}': String(credits.signupBonus || 0),
    '{{CREDITS_UPTIME_PER_MINUTE}}': String(credits.uptimePerMinute || 0),
    '{{CREDITS_BANDWIDTH_PER_MB}}': String(credits.bandwidthChargePerMb || 0),
    '{{CREDITS_DEFAULT_LEASE_PRICE}}': String(credits.defaultLeasePricePerMinute || 0),
  };
}

function substituteTokens(input) {
  if (input == null) return input;
  const tokens = tokenContext();
  let out = String(input);
  Object.keys(tokens).forEach(k => { out = out.split(k).join(tokens[k]); });
  return out;
}

// ---------------------------------------------------------------------------
// Page lookup
// ---------------------------------------------------------------------------

const ALL_PAGES = [];
SECTIONS.forEach(section => {
  section.pages.forEach(page => {
    ALL_PAGES.push({ ...page, sectionId: section.id, sectionLabel: section.label });
  });
});
const PAGES_BY_SLUG = Object.create(null);
ALL_PAGES.forEach(p => { PAGES_BY_SLUG[p.slug] = p; });
const HOME_SLUG = ALL_PAGES[0].slug;

function findPage(pathname) {
  if (!pathname || pathname === '/' || pathname === '') {
    return PAGES_BY_SLUG[HOME_SLUG];
  }
  const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  return PAGES_BY_SLUG[slug] || null;
}

// ---------------------------------------------------------------------------
// Search index — plain-text strings derived from each page, served as JSON
// ---------------------------------------------------------------------------

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchIndex(locale) {
  return ALL_PAGES.map(p => {
    const title       = tr(p.slug + '.title',       locale) || p.title;
    const description = tr(p.slug + '.description', locale) || p.description || '';
    const html        = tr(p.slug + '.html',        locale) || p.html;
    const section     = tr(p.sectionId + '.label',  locale) || p.sectionLabel;
    return {
      slug:        p.slug,
      title,
      section,
      description: substituteTokens(description),
      text:        substituteTokens(stripHtml(html)).slice(0, 4000),
    };
  });
}
const SEARCH_INDEX_BY_LOCALE = Object.create(null);
LOCALES.forEach(l => { SEARCH_INDEX_BY_LOCALE[l] = JSON.stringify(buildSearchIndex(l)); });

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function renderSidebar(currentSlug, locale) {
  const parts = ['<nav class="docs-nav" aria-label="Documentation">'];
  SECTIONS.forEach(section => {
    const sectionLabel = localizedSectionLabel(section, locale);
    parts.push(`<div class="docs-nav-section">`);
    parts.push(`<div class="docs-nav-label">${escapeHtml(sectionLabel)}</div>`);
    parts.push(`<ul>`);
    section.pages.forEach(page => {
      const active = page.slug === currentSlug ? ' aria-current="page" class="active"' : '';
      const href = '/' + page.slug;
      const fullTitle = localizedPageField(page, 'title', locale);
      const label = fullTitle.split(/\s*[\u2014\-]\s+/)[0];
      parts.push(`<li><a href="${escapeHtml(href)}"${active}>${escapeHtml(label)}</a></li>`);
    });
    parts.push(`</ul></div>`);
  });
  parts.push('</nav>');
  return parts.join('');
}

const DOCS_LABEL_BY_LOCALE = {
  en: 'Docs', es: 'Documentación', fr: 'Documentation', de: 'Doku',
  zh: '文档', ja: 'ドキュメント', ko: '문서'
};

function breadcrumbItems(page, base, locale) {
  const section = SECTIONS.find(s => s.id === page.sectionId);
  return [
    { name: DOCS_LABEL_BY_LOCALE[locale] || 'Docs', url: base + '/' },
    { name: section ? localizedSectionLabel(section, locale) : page.sectionLabel, url: base + '/' },
    { name: localizedPageField(page, 'title', locale), url: base + '/' + page.slug },
  ];
}

function renderJsonLd(page, base, locale) {
  const crumb = breadcrumbItems(page, base, locale);
  const title = localizedPageField(page, 'title', locale);
  const description = localizedPageField(page, 'description', locale);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumb.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description: substituteTokens(description),
    keywords: page.keywords || '',
    inLanguage: locale || 'en',
    url: base + '/' + (page.slug === HOME_SLUG ? '' : page.slug),
    isPartOf: { '@type': 'WebSite', name: 'AirWeb Docs', url: base + '/' },
  };
  const safe = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
  return [
    `<script type="application/ld+json">${safe(article)}</script>`,
    `<script type="application/ld+json">${safe(breadcrumb)}</script>`,
  ].join('\n');
}

const SEARCH_CLIENT_JS = `(function () {
  var input   = document.getElementById('docsSearchInput');
  var results = document.getElementById('docsSearchResults');
  if (!input || !results) return;

  var INDEX = null, loading = null;
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    if (loading) return loading;
    loading = fetch('/search-index.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { INDEX = data || []; return INDEX; })
      .catch(function () { INDEX = []; return INDEX; });
    return loading;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function score(page, terms) {
    var hay = (page.title + ' ' + page.section + ' ' + page.description + ' ' + page.text).toLowerCase();
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i]; if (!t) continue;
      var idx = hay.indexOf(t);
      if (idx < 0) return -1;
      s += 10;
      if (page.title.toLowerCase().indexOf(t) >= 0) s += 30;
      if (page.section.toLowerCase().indexOf(t) >= 0) s += 5;
    }
    return s;
  }
  function snippet(page, term) {
    var text = (page.description || '') + ' \u2014 ' + (page.text || '');
    var i = text.toLowerCase().indexOf(term);
    if (i < 0) return page.description || '';
    var start = Math.max(0, i - 30);
    var end   = Math.min(text.length, i + 120);
    return (start > 0 ? '\u2026' : '') + text.slice(start, end) + (end < text.length ? '\u2026' : '');
  }
  function highlight(text, terms) {
    var safe = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'ig');
      safe = safe.replace(re, '<mark>$1</mark>');
    });
    return safe;
  }

  var focusIdx = -1;
  function tr(s) {
    try { return (window.i18n && window.i18n.t) ? window.i18n.t(s) : s; }
    catch (e) { return s; }
  }
  function render(list, terms) {
    focusIdx = -1;
    var q = terms.join(' ').trim();
    if (!q) { results.hidden = true; input.setAttribute('aria-expanded', 'false'); results.innerHTML = ''; return; }
    if (!list.length) {
      results.innerHTML = '<div class="empty">' + esc(tr('No results for')) + ' &ldquo;' + esc(q) + '&rdquo;</div>';
      results.hidden = false; input.setAttribute('aria-expanded', 'true');
      return;
    }
    var bySection = {}, order = [];
    list.forEach(function (p) {
      if (!bySection[p.section]) { bySection[p.section] = []; order.push(p.section); }
      bySection[p.section].push(p);
    });
    var html = '';
    order.forEach(function (s) {
      html += '<div class="group">' + esc(s) + '</div>';
      bySection[s].forEach(function (p) {
        html += '<a role="option" href="/' + encodeURIComponent(p.slug) + '">'
              + '<strong>' + highlight(p.title, terms) + '</strong>'
              + '<span class="snippet">' + highlight(snippet(p, terms[0]), terms) + '</span>'
              + '</a>';
      });
    });
    results.innerHTML = html;
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    try { window.i18n && window.i18n.apply && window.i18n.apply(results); } catch (e) {}
  }

  function update() {
    var q = input.value.trim().toLowerCase();
    if (!q) { render([], []); return; }
    var terms = q.split(/\\s+/);
    loadIndex().then(function (data) {
      var ranked = data
        .map(function (p) { return { p: p, s: score(p, terms) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 8)
        .map(function (x) { return x.p; });
      render(ranked, terms);
    });
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', function () { if (input.value.trim()) update(); });
  input.addEventListener('keydown', function (e) {
    var links = results.querySelectorAll('a');
    if (e.key === 'ArrowDown') {
      e.preventDefault(); if (!links.length) return;
      focusIdx = (focusIdx + 1) % links.length;
      links.forEach(function (a, i) { a.classList.toggle('kbd-focus', i === focusIdx); });
      links[focusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); if (!links.length) return;
      focusIdx = (focusIdx - 1 + links.length) % links.length;
      links.forEach(function (a, i) { a.classList.toggle('kbd-focus', i === focusIdx); });
      links[focusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (focusIdx >= 0 && links[focusIdx]) {
        e.preventDefault();
        window.location.href = links[focusIdx].getAttribute('href');
      }
    } else if (e.key === 'Escape') {
      input.blur(); results.hidden = true; input.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target === input) return;
    if (!results.contains(e.target)) {
      results.hidden = true; input.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input &&
        !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault(); input.focus();
    }
  });
})();`;

const NAV_TRANSITION_JS = `(function () {
  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {}
  if (reduced) return;

  var leaving = false;

  function isInternalNav(anchor) {
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return false;
    var rawHref = anchor.getAttribute('href') || '';
    if (!rawHref || rawHref.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;

    var url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch (e) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
    return true;
  }

  document.addEventListener('click', function (e) {
    if (leaving || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!isInternalNav(anchor)) return;

    leaving = true;
    e.preventDefault();
    document.body.classList.add('docs-leaving');

    window.setTimeout(function () {
      window.location.assign(anchor.href);
    }, 170);
  });

  window.addEventListener('pageshow', function () {
    leaving = false;
    document.body.classList.remove('docs-leaving');
  });
})();`;

const DOCS_CSS = `
  /* ---------- Docs layout ---------------------------------------------- */
  main.docs {
    max-width: 1200px; margin: 0 auto;
    padding: 1.4rem 1.4rem 4rem;
  }
  .docs-search,
  .docs-sidebar,
  article.docs-content {
    will-change: transform, opacity;
    transition: opacity .18s ease, transform .24s cubic-bezier(.22, 1, .36, 1);
  }
  .docs-search {
    animation: docs-fade-slide-in .2s ease-out both;
  }
  .docs-search {
    position: relative;
    margin: 0 0 1rem;
  }
  .docs-search input {
    width: 100%; box-sizing: border-box;
    font: inherit; color: var(--fg);
    background: var(--panel);
    border: 1px solid var(--line2, var(--line));
    border-radius: var(--radius);
    padding: .55rem .75rem .55rem 2.1rem;
    transition: border-color .12s, background .12s;
  }
  .docs-search input:focus {
    outline: none; border-color: var(--accent);
    background: var(--panel2, var(--panel));
  }
  .docs-search svg {
    position: absolute; top: 50%; left: .65rem;
    width: 16px; height: 16px;
    transform: translateY(-50%);
    color: var(--mute); pointer-events: none;
  }
  .docs-search-results {
    position: absolute; left: 0; right: 0; top: calc(100% + 4px);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop, 0 14px 40px rgba(0,0,0,.18));
    max-height: 60vh; overflow: auto;
    z-index: 30; padding: .35rem;
  }
  .docs-search-results[hidden] { display: none; }
  .docs-search-results .group {
    font-size: .7rem; text-transform: uppercase; letter-spacing: 1px;
    color: var(--mute); padding: .55rem .6rem .25rem;
  }
  .docs-search-results a {
    display: block; padding: .45rem .6rem;
    border-radius: var(--radius-sm);
    color: var(--fg); text-decoration: none;
    line-height: 1.35;
  }
  .docs-search-results a:hover,
  .docs-search-results a.kbd-focus {
    background: var(--hover); text-decoration: none;
  }
  .docs-search-results a .snippet {
    display: block; font-size: .82rem; color: var(--mute);
    margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .docs-search-results .empty {
    padding: .8rem; color: var(--mute); font-size: .9rem;
  }
  .docs-search-results mark {
    background: color-mix(in srgb, var(--accent) 25%, transparent);
    color: inherit; padding: 0 1px; border-radius: 2px;
  }

  .docs-shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }
  .docs-sidebar {
    position: sticky; top: calc(48px + 1rem);
    max-height: calc(100vh - 48px - 2rem);
    overflow: auto;
    padding-right: .25rem;
    animation: docs-fade-slide-in .24s cubic-bezier(.22, 1, .36, 1) both;
    animation-delay: .03s;
  }
  .docs-nav-section { margin-bottom: 1.1rem; }
  .docs-nav-label {
    font-size: .72rem; text-transform: uppercase; letter-spacing: 1px;
    color: var(--mute); padding: 0 .55rem .35rem;
  }
  .docs-nav ul {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 1px;
  }
  .docs-nav li a {
    display: block;
    padding: .35rem .55rem;
    color: var(--fg2);
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-size: .92rem;
    line-height: 1.35;
  }
  .docs-nav li a:hover { background: var(--hover); color: var(--fg); }
  .docs-nav li a.active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    font-weight: 600;
  }

  /* ---------- Article content ----------------------------------------- */
  article.docs-content {
    min-width: 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 1.6rem 2rem 2.2rem;
    box-shadow: var(--shadow-card);
    animation: docs-fade-slide-in .28s cubic-bezier(.22, 1, .36, 1) both;
    animation-delay: .06s;
  }
  body.docs-leaving .docs-search,
  body.docs-leaving .docs-sidebar,
  body.docs-leaving article.docs-content {
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }
  @keyframes docs-fade-slide-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .docs-breadcrumb {
    font-size: .82rem; color: var(--mute);
    margin-bottom: .6rem;
  }
  .docs-breadcrumb a { color: var(--mute); text-decoration: none; }
  .docs-breadcrumb a:hover { color: var(--fg); }
  .docs-breadcrumb .sep { margin: 0 .35rem; opacity: .6; }
  .docs-breadcrumb [aria-current="page"] { color: var(--fg); }

  article.docs-content h1 {
    font-family: var(--display);
    font-size: 1.8rem;
    margin: .2rem 0 .8rem;
    color: var(--fg);
    line-height: 1.2;
  }
  article.docs-content h2 {
    font-family: var(--display);
    font-size: 1.25rem;
    margin: 1.8rem 0 .6rem;
    color: var(--fg);
    border-bottom: 1px solid var(--line);
    padding-bottom: .35rem;
  }
  article.docs-content h3 {
    font-size: 1.05rem;
    margin: 1.4rem 0 .4rem;
    color: var(--fg);
  }
  article.docs-content p,
  article.docs-content li {
    color: var(--fg2);
    line-height: 1.65;
  }
  article.docs-content p.lead {
    font-size: 1.05rem;
    color: var(--fg2);
  }
  article.docs-content ul,
  article.docs-content ol {
    padding-left: 1.3rem;
    margin: .6rem 0 1rem;
  }
  article.docs-content li { margin: .25rem 0; }
  article.docs-content a { color: var(--accent); }
  article.docs-content code {
    background: var(--code);
    border: 1px solid var(--line);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: .85em;
    color: var(--fg);
    word-break: break-word;
  }
  article.docs-content pre {
    background: var(--code);
    border: 1px solid var(--line);
    padding: .85rem 1rem;
    border-radius: var(--radius);
    overflow: auto;
    font-size: .85rem;
    line-height: 1.55;
  }
  article.docs-content pre code {
    background: transparent; border: 0; padding: 0;
    font-size: inherit; color: var(--fg);
  }
  article.docs-content dl {
    margin: .6rem 0 1rem;
    display: grid;
    grid-template-columns: minmax(140px, 220px) 1fr;
    gap: .45rem 1rem;
  }
  article.docs-content dt {
    color: var(--fg);
    font-family: var(--mono);
    font-size: .85rem;
  }
  article.docs-content dd { margin: 0; color: var(--fg2); }
  article.docs-content kbd {
    background: var(--panel2, var(--panel));
    border: 1px solid var(--line2, var(--line));
    border-bottom-width: 2px;
    padding: 1px 5px; border-radius: 4px;
    font-family: var(--mono); font-size: .8em;
    color: var(--fg);
  }
  article.docs-content table.api {
    width: 100%; border-collapse: collapse;
    font-size: .9rem;
    margin: .6rem 0 1rem;
  }
  article.docs-content table.api th,
  article.docs-content table.api td {
    border-bottom: 1px solid var(--line);
    padding: .45rem .65rem;
    text-align: left;
    vertical-align: top;
  }
  article.docs-content table.api th { color: var(--fg); font-weight: 600; }
  article.docs-content table.api td:first-child {
    font-family: var(--mono); font-size: .82rem; white-space: nowrap;
  }
  article.docs-content table.api td:nth-child(2) {
    font-family: var(--mono); font-size: .82rem;
  }

  article.docs-content .docs-home-hero {
    background: var(--panel2, var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 1.4rem 1.3rem;
    margin: .4rem 0 1.35rem;
  }
  article.docs-content .docs-home-hero-grid,
  article.docs-content .docs-home-visual-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 1.4rem;
    align-items: start;
  }
  article.docs-content .docs-home-hero-grid {
    align-items: center;
  }
  article.docs-content .docs-home-visual-grid.flip {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
  }
  article.docs-content .docs-home-visual-grid.flip .docs-home-visual-art {
    order: 2;
  }
  article.docs-content .docs-home-badges {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    margin-top: 1rem;
  }
  article.docs-content .docs-home-badge {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    padding: 2px .65rem;
    border: 1px solid var(--line2);
    background: var(--hover);
    border-radius: 999px;
    color: var(--fg2);
    font-size: .84rem;
  }
  article.docs-content .docs-home-badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 22%, transparent);
  }
  article.docs-content .docs-home-visual-art {
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.2rem 1.2rem 1.35rem;
    display: grid;
    place-items: center;
  }
  article.docs-content .docs-home-visual-art svg {
    width: 100%;
    max-width: 390px;
    height: auto;
    display: block;
    color: var(--fg);
    overflow: visible;
  }
  article.docs-content .docs-home-copy-stack {
    display: grid;
    gap: .9rem;
    align-content: start;
  }
  article.docs-content .docs-home-note {
    margin: 0;
    color: var(--mute);
    font-size: .93rem;
    line-height: 1.6;
  }
  article.docs-content .docs-home-steps {
    counter-reset: doc-step;
    list-style: none;
    padding: 0;
    margin: .8rem 0 0;
  }
  article.docs-content .docs-home-steps > li {
    counter-increment: doc-step;
    position: relative;
    padding: 1.1rem 0 1.1rem 3.25rem;
    border-top: 1px solid var(--line);
  }
  article.docs-content .docs-home-steps > li:first-child {
    border-top: 0;
    padding-top: .15rem;
  }
  article.docs-content .docs-home-steps > li::before {
    content: counter(doc-step);
    position: absolute;
    left: 0;
    top: 1rem;
    width: 2.2rem;
    height: 2.2rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-fg);
    font: 700 1rem/1 var(--display);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  article.docs-content .docs-home-steps > li:first-child::before {
    top: .1rem;
  }
  article.docs-content .docs-home-feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: .9rem;
    margin-top: .8rem;
  }
  article.docs-content .docs-home-feature {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    padding: 1rem 1.05rem;
  }
  article.docs-content .docs-home-feature h3 {
    margin-top: 0;
  }
  article.docs-content .protocol-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: .6rem;
    margin-top: .8rem;
  }
  article.docs-content .protocol-tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: .45rem;
    padding: .85rem .8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
  }
  article.docs-content .protocol-tile .pico {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    flex: 0 0 auto;
  }
  article.docs-content .protocol-tile .pico svg {
    width: 22px;
    height: 22px;
    display: block;
  }
  article.docs-content .protocol-tile .pname {
    font: 600 .9rem/1 var(--display);
    color: var(--fg);
  }
  article.docs-content .protocol-tile .pport {
    font: .75rem/1 var(--mono);
    color: var(--mute);
  }
  article.docs-content .docs-home-stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: .75rem;
    margin: 0;
  }
  article.docs-content .docs-home-stat-tile {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    padding: .95rem 1rem;
  }
  article.docs-content .docs-home-stat-val {
    font: 700 1.35rem/1.1 var(--display);
    color: var(--accent);
    display: flex;
    align-items: baseline;
    gap: .35rem;
  }
  article.docs-content .docs-home-stat-tile.good .docs-home-stat-val {
    color: var(--good);
  }
  article.docs-content .docs-home-stat-tile.neg .docs-home-stat-val {
    color: var(--bad, #ff453a);
  }
  article.docs-content .docs-home-stat-val small {
    font: 500 .78rem/1 var(--sans);
    color: var(--mute);
  }
  article.docs-content .docs-home-stat-label {
    margin-top: .35rem;
    color: var(--mute);
    font-size: .84rem;
    line-height: 1.4;
  }
  article.docs-content .docs-home-compare-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 70px minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    margin-top: .8rem;
  }
  article.docs-content .docs-home-compare-card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    padding: 1.1rem 1.15rem;
    min-height: 100%;
  }
  article.docs-content .docs-home-compare-card.bad {
    border-color: color-mix(in srgb, var(--bad, #ff453a) 35%, var(--line));
  }
  article.docs-content .docs-home-compare-card.good {
    border-color: color-mix(in srgb, var(--good) 38%, var(--line));
  }
  article.docs-content .docs-home-tag {
    display: inline-block;
    margin-bottom: .55rem;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--panel);
    color: var(--mute);
    font: 600 .72rem/1 var(--sans);
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  article.docs-content .docs-home-compare-card.bad .docs-home-tag {
    color: var(--bad, #ff453a);
  }
  article.docs-content .docs-home-compare-card.good .docs-home-tag {
    color: var(--good);
  }
  article.docs-content .docs-home-compare-arrow {
    width: 70px;
    height: 70px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
    color: var(--accent);
    font: 700 1.45rem/1 var(--sans);
    justify-self: center;
  }
  article.docs-content .docs-home-big {
    margin-top: .8rem;
    font: 700 1.25rem/1.1 var(--display);
  }
  article.docs-content .docs-home-compare-card.bad .docs-home-big {
    color: var(--bad, #ff453a);
  }
  article.docs-content .docs-home-compare-card.good .docs-home-big {
    color: var(--good);
  }
  article.docs-content .docs-home-meta-list {
    margin: 0;
    padding-left: 1.15rem;
    display: grid;
    gap: .35rem;
  }

  /* ---------- Responsive ---------------------------------------------- */
  @media (max-width: 820px) {
    .docs-shell { grid-template-columns: 1fr; gap: 1rem; }
    .docs-sidebar {
      position: static; max-height: none;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: .7rem;
      background: var(--panel);
    }
    article.docs-content { padding: 1.1rem 1.1rem 1.6rem; }
    article.docs-content dl { grid-template-columns: 1fr; }
    article.docs-content .docs-home-hero-grid,
    article.docs-content .docs-home-visual-grid,
    article.docs-content .docs-home-visual-grid.flip,
    article.docs-content .docs-home-compare-grid {
      grid-template-columns: 1fr;
    }
    article.docs-content .protocol-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    article.docs-content .docs-home-visual-grid.flip .docs-home-visual-art {
      order: -1;
    }
    article.docs-content .docs-home-compare-arrow {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .docs-search,
    .docs-sidebar,
    article.docs-content {
      animation: none;
      transition: none;
      will-change: auto;
    }
    body.docs-leaving .docs-search,
    body.docs-leaving .docs-sidebar,
    body.docs-leaving article.docs-content {
      opacity: 1;
      transform: none;
      pointer-events: auto;
    }
  }
`;

function renderPage(req, page, locale) {
  const apex = apexBase();
  const base = docsBase(req);
  const canonical = base + (page.slug === HOME_SLUG ? '/' : '/' + page.slug);
  const title = localizedPageField(page, 'title', locale);
  const description = substituteTokens(localizedPageField(page, 'description', locale) || 'AirWeb documentation');
  const body = substituteTokens(localizedPageField(page, 'html', locale));
  const sidebar = renderSidebar(page.slug, locale);
  const jsonLd = renderJsonLd(page, base, locale);
  const crumbs = breadcrumbItems(page, base, locale);
  const crumbHtml = crumbs.map((c, i) => i === crumbs.length - 1
    ? `<span aria-current="page">${escapeHtml(c.name)}</span>`
    : `<a href="${escapeHtml(c.url)}">${escapeHtml(c.name)}</a>`
  ).join('<span class="sep" aria-hidden="true">/</span>');

  const docsLabel = DOCS_LABEL_BY_LOCALE[locale] || 'Docs';
  const hreflang = LOCALES.map(l => {
    const u = base + (page.slug === HOME_SLUG ? '/' : '/' + page.slug);
    return `<link rel="alternate" hreflang="${l}" href="${escapeHtml(u)}">`;
  }).join('\n');

  return `<!doctype html>
<html lang="${locale || 'en'}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} · AirWeb ${escapeHtml(docsLabel)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
<meta name="keywords" content="${escapeHtml(page.keywords || '')}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${escapeHtml(canonical)}">
${hreflang}
<meta property="og:type" content="article">
<meta property="og:site_name" content="AirWeb ${escapeHtml(docsLabel)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:locale" content="${escapeHtml(locale || 'en')}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" type="image/png" href="${apex}/logo.png">
<link rel="stylesheet" href="${apex}/header.css">
<link rel="stylesheet" href="${apex}/app.css">
<script>window.__awApiBase = ${JSON.stringify(apex)};</script>
<script src="${apex}/header.js" defer></script>
<script src="${apex}/i18n.js" defer></script>
<script src="${apex}/currency.js" defer></script>
${jsonLd}
<style>${DOCS_CSS}</style>
</head>
<body class="docs-page">
<div id="aw-header"></div>
<main class="docs">

  <div class="docs-search" role="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="docsSearchInput" type="search" autocomplete="off" spellcheck="false"
           placeholder="Search the docs… (press / to focus)"
           aria-label="Search the docs"
           aria-controls="docsSearchResults"
           aria-expanded="false" />
    <div id="docsSearchResults" class="docs-search-results" role="listbox" hidden></div>
  </div>

  <div class="docs-shell">
    <aside class="docs-sidebar">${sidebar}</aside>
    <article class="docs-content">
      <nav class="docs-breadcrumb" aria-label="Breadcrumb">${crumbHtml}</nav>
      ${body}
    </article>
  </div>
</main>

<script>${SEARCH_CLIENT_JS}</script>
<script>${NAV_TRANSITION_JS}</script>
<script>(function(){
  var current = ${JSON.stringify(locale || 'en')};
  document.addEventListener('airweb:locale-changed', function (e) {
    if (e && e.detail && e.detail.locale && e.detail.locale !== current) {
      window.location.reload();
    }
  });
})();</script>
</body>
</html>`;
}

function render404(req, locale) {
  const NOT_FOUND = {
    en: { title: 'Page not found', lead: 'No documentation page is registered at', body: 'Use the sidebar or the search box above to find what you were looking for, or jump back to', home: 'the docs home page' },
    es: { title: 'Página no encontrada', lead: 'No hay ninguna página de documentación registrada en', body: 'Usa la barra lateral o el buscador de arriba para encontrar lo que buscabas, o vuelve a', home: 'la página de inicio de la documentación' },
    fr: { title: 'Page introuvable', lead: 'Aucune page de documentation n\u2019est enregistrée à', body: 'Utilisez la barre latérale ou le champ de recherche ci-dessus pour trouver ce que vous cherchiez, ou retournez à', home: 'la page d\u2019accueil de la documentation' },
    de: { title: 'Seite nicht gefunden', lead: 'Unter', body: 'Nutze die Seitenleiste oder das Suchfeld oben, um zu finden, was du gesucht hast, oder kehre zurück zur', home: 'Startseite der Doku' },
    zh: { title: '页面未找到', lead: '在以下地址没有注册任何文档页面：', body: '使用左侧栏或顶部搜索框查找你需要的内容，或返回', home: '文档首页' },
    ja: { title: 'ページが見つかりません', lead: '次のパスにドキュメントページは登録されていません：', body: '左のサイドバーまたは上部の検索ボックスをご利用ください。あるいは', home: 'ドキュメントのホーム' },
    ko: { title: '페이지를 찾을 수 없습니다', lead: '다음 경로에 등록된 문서 페이지가 없습니다:', body: '왼쪽 사이드바나 상단 검색창을 이용하거나, 다음으로 돌아가세요:', home: '문서 홈페이지' },
  };
  const t = NOT_FOUND[locale] || NOT_FOUND.en;
  const html = `
<h1>${escapeHtml(t.title)}</h1>
<p class="lead">${escapeHtml(t.lead)}
<code>${escapeHtml(req.url || '/')}</code>.</p>
<p>${escapeHtml(t.body)} <a href="/">${escapeHtml(t.home)}</a>.</p>
`;
  const fakePage = {
    slug: '',
    title: t.title,
    sectionId: 'reference',
    sectionLabel: 'Reference',
    description: t.lead,
    keywords: '',
    html,
  };
  return renderPage(req, fakePage, locale);
}

function renderRobots(req) {
  const base = docsBase(req);
  return `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
}

function renderSitemap(req) {
  const base = docsBase(req);
  const urls = ALL_PAGES.map(p => {
    const loc = base + (p.slug === HOME_SLUG ? '/' : '/' + p.slug);
    return `  <url><loc>${escapeHtml(loc)}</loc><changefreq>weekly</changefreq></url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

function send(res, status, contentType, body, extraHeaders) {
  const headers = Object.assign({
    'Content-Type':  contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
    'Vary':          'Cookie',
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

function handle(req, res) {
  const rawUrl = req.url || '/';
  const path = (rawUrl.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const locale = pickLocale(req);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', { 'Allow': 'GET, HEAD' });
  }
  if (path === '/search-index.json') {
    const json = SEARCH_INDEX_BY_LOCALE[locale] || SEARCH_INDEX_BY_LOCALE.en;
    return send(res, 200, 'application/json; charset=utf-8', json);
  }
  if (path === '/robots.txt') {
    return send(res, 200, 'text/plain; charset=utf-8', renderRobots(req));
  }
  if (path === '/sitemap.xml') {
    return send(res, 200, 'application/xml; charset=utf-8', renderSitemap(req));
  }

  const page = findPage(path);
  if (!page) {
    return send(res, 404, 'text/html; charset=utf-8', render404(req, locale));
  }
  return send(res, 200, 'text/html; charset=utf-8', renderPage(req, page, locale));
}

module.exports = createInternalServer({
  key: 'doc',
  label: 'Docs',
  configKey: 'internalDoc',           // legacy config key kept for back-compat
  defaultPort: 8090,
  defaultSubdomain: 'doc',
  defaultTitle: 'AirWeb Docs',
  handler: (req, res) => handle(req, res),
});
