// Public-facing HTTP/WebSocket router.
//
// Architecture: we accept raw TCP connections, peek at the first few bytes to
// read the Host header, and then decide:
//   * known subdomain  -> pipe the raw socket through the SSH tunnel's channel

const http = require('http');
const net = require('net');
const config = require('./config');
const registry = require('./registry');
const apiRouter = require('./apiRouter');
const marketplace = require('./marketplace');

const PASSCODE_COOKIE = 'aw_pass';
const PASSCODE_COOKIE_RE = /(?:^|;\s*)aw_pass=([A-Z0-9]+)/i;
const PASSCODE_QUERY_RE = /[?&]aw_pass=([A-Z0-9]+)/i;

const MAX_HEADER_PEEK = 16 * 1024;     // bail if headers don't end within 16KB
const PEEK_TIMEOUT_MS = 15 * 1000;     // close sockets that send nothing

function publicHost() {
  return config.http.publicDomain.split(':')[0].toLowerCase();
}

function extractSubdomain(hostHeader) {
  if (!hostHeader) return null;
  const host = hostHeader.split(':')[0].toLowerCase();
  const base = publicHost();
  if (host === base) return null;
  if (!host.endsWith('.' + base)) return null;
  const sub = host.slice(0, -1 - base.length);
  if (!sub || sub.includes('.')) return null;
  return sub;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------------------------------------------------------------------------
// Landing page + not-found page (served by the internal http.Server)
// ---------------------------------------------------------------------------
function landingPage(res) {
  const html = renderLandingHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Robots-Tag', 'index, follow');
  res.end(html);
}

function renderLandingHtml() {
  const scheme        = config.http.publicScheme || 'http';
  const publicDomain  = config.http.publicDomain;
  const siteUrl       = `${scheme}://${publicDomain}`;
  const host          = publicHost();
  const sshPort       = config.ssh.port;
  const keyFile       = `${host.replace(/[^a-z0-9.-]+/gi, '_')}_<your account id>_key.txt`;
  // Count every public tunnel — HTTP and raw TCP both — but skip internal
  // tunnels (docs, forum, etc.) since those are server-owned plumbing, not
  // user-facing connections people would brag about in the landing badge.
  const tunnels       = registry.list().filter(t => !t.internal);
  const tunnelCount   = tunnels.length;
  const description   = `AirWeb on ${host}: a people-powered cloud built from spare devices. ` +
    `Demo apps in seconds, reach your home computer from anywhere, lease micro-servers by the minute, ` +
    `and earn credits by hosting on hardware you already own. Pay only for the traffic you use.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AirWeb',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    description,
    url: siteUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>AirWeb — A people-powered cloud from the devices you already own</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="#1c1c1e" />
<link rel="canonical" href="${escapeHtml(siteUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:title" content="AirWeb — A people-powered cloud from spare devices" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(siteUrl)}" />
<meta property="og:site_name" content="AirWeb" />

<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="AirWeb — A people-powered cloud from spare devices" />
<meta name="twitter:description" content="${escapeHtml(description)}" />

<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231c1c1e'/%3E%3Crect x='8' y='8' width='22' height='22' rx='5' fill='%230a84ff'/%3E%3Crect x='34' y='8' width='22' height='22' rx='5' fill='%230a84ff'/%3E%3Crect x='8' y='34' width='22' height='22' rx='5' fill='%230a84ff'/%3E%3Crect x='34' y='34' width='22' height='22' rx='5' fill='%230a84ff'/%3E%3C/svg%3E" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>
  /* Landing-only tokens (the rest of the palette lives in /app.css and is
     shared with every other page so the header/theme stay identical). */
  :root { --footer-bg: rgba(0,0,0,.18); }
  html[data-theme="light"] { --footer-bg: rgba(0,0,0,.025); }

  /* Hero / banner */
  .banner {
    position: relative; overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 2.6rem 2.4rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-card);
  }
  .banner::before {
    content: ""; position: absolute; pointer-events: none;
    width: 620px; height: 620px; top: -220px; right: -200px;
    background: radial-gradient(circle at center,
      color-mix(in srgb, var(--accent) 28%, transparent) 0%,
      transparent 60%);
    filter: blur(24px); opacity: .8; z-index: 0;
  }
  .banner::after {
    content: ""; position: absolute; pointer-events: none;
    width: 460px; height: 460px; bottom: -160px; left: -140px;
    background: radial-gradient(circle at center,
      color-mix(in srgb, var(--good) 22%, transparent) 0%,
      transparent 60%);
    filter: blur(24px); opacity: .6; z-index: 0;
  }
  .banner > * { position: relative; z-index: 1; }
  .banner-ascii { display: none; }

  /* Two-column hero: copy on the left, device illustration on the right.
     Collapses to a single column under 880px so phones get the full copy
     first and the illustration slides underneath. */
  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 2.4rem;
    align-items: center;
  }
  @media (max-width: 880px) {
    .hero-grid { grid-template-columns: 1fr; gap: 1.6rem; }
    .hero-illustration { order: -1; max-width: 420px; margin: 0 auto; }
  }
  .hero-illustration {
    position: relative;
    width: 100%;
  }
  .hero-illustration svg {
    width: 100%; height: auto; display: block;
    filter: drop-shadow(0 18px 40px color-mix(in srgb, var(--accent) 18%, transparent));
  }
  .banner h1 {
    font: 600 2.35rem/1.12 var(--display);
    margin: 0 0 1rem;
    color: var(--fg);
    letter-spacing: -.02em;
  }
  .banner h1 .accent { color: var(--accent); }
  .banner p.lead {
    color: var(--mute); margin: 0 0 1rem;
    max-width: 56ch; font-size: 1.1rem; line-height: 1.55;
  }
  .banner .cta-row {
    display: flex; flex-wrap: wrap; gap: .7rem; align-items: center;
    margin-top: 1.5rem;
  }
  .cta {
    display: inline-block;
    background: var(--accent); color: var(--accent-fg); text-decoration: none;
    border: 1px solid transparent;
    padding: .5rem 1.15rem;
    border-radius: var(--radius-sm);
    font-family: var(--sans); font-weight: 600; font-size: .95rem;
    transition: background .12s;
  }
  .cta:hover { background: var(--accent2); color: var(--accent-fg); text-decoration: none; }
  .cta-alt {
    color: var(--fg); text-decoration: none;
    background: var(--hover);
    border: 1px solid var(--line2);
    padding: .5rem 1.15rem;
    border-radius: var(--radius-sm);
    font-weight: 500;
    transition: background .12s, border-color .12s;
  }
  .cta-alt:hover { background: var(--hover2); text-decoration: none; border-color: var(--mute2); }

  .badges {
    display: flex; flex-wrap: wrap; gap: .5rem;
    margin-top: 1.2rem;
  }
  .badge {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: 2px .65rem;
    border: 1px solid var(--line2);
    color: var(--fg2); background: var(--hover);
    border-radius: 999px;
    font-size: .85rem;
  }
  .badge .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 22%, transparent);
  }

  /* Sections */
  section.block {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
      padding: 1.7rem 1.5rem;
    margin: 1.6rem 0;
    box-shadow: var(--shadow-card);
  }
  section.block h2 {
    margin: 0 0 1.3rem;
    font: 600 1.55rem/1.2 var(--display);
    color: var(--fg);
    border-bottom: 1px solid var(--line);
    padding-bottom: .75rem;
    letter-spacing: -.012em;
    display: flex; align-items: center; gap: .65rem;
  }
  section.block h2 .icon {
    width: 26px; height: 26px; flex: 0 0 26px;
    color: var(--accent);
  }
  section.block h2 .icon svg { width: 100%; height: 100%; display: block; }
  section.block h2 .eyebrow {
    margin-left: auto; font: 500 .8rem/1 var(--sans);
    color: var(--mute); letter-spacing: .04em; text-transform: uppercase;
  }
  section.block h3 {
    margin: 1.2rem 0 .45rem;
    font: 600 1.05rem/1.3 var(--display);
    color: var(--fg);
  }
  section.block p { margin: .5rem 0 .75rem; color: var(--fg2); line-height: 1.6; }
  section.block > p:first-of-type { font-size: 1.02rem; color: var(--fg2); }

  /* Protocol strip: row of icon tiles showing every protocol the server can
     forward, so visitors immediately grasp "anything I run locally can go". */
  .protocol-strip {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: .6rem;
    margin-top: .4rem;
  }
  @media (max-width: 900px) {
    .protocol-strip { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 520px) {
    .protocol-strip { grid-template-columns: repeat(2, 1fr); }
  }
  .protocol-tile {
    display: flex; flex-direction: column; align-items: center;
    gap: .5rem;
    padding: 1rem .6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    transition: background .12s, border-color .12s, transform .12s;
    text-align: center;
  }
  .protocol-tile:hover { background: var(--hover2); border-color: var(--line2); transform: translateY(-1px); }
  .protocol-tile .pico {
    width: 36px; height: 36px;
    display: grid; place-items: center;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-radius: 10px;
  }
  .protocol-tile .pico svg { width: 22px; height: 22px; display: block; }
  .protocol-tile .pname { font: 600 .9rem/1 var(--display); color: var(--fg); }
  .protocol-tile .pport { font: .75rem/1 var(--mono); color: var(--mute); }

  /* Steps */
  ol.steps {
    counter-reset: step; list-style: none;
    padding: 0; margin: .8rem 0 0;
  }
  ol.steps > li {
    counter-increment: step;
    padding: 1.3rem 0 1.3rem 3.6rem;
    position: relative;
    border-top: 1px solid var(--line);
  }
  ol.steps > li:first-child { border-top: none; padding-top: .3rem; }
  ol.steps > li::before {
    content: counter(step);
    position: absolute; left: 0; top: 1.3rem;
    width: 2.4rem; height: 2.4rem; border-radius: 50%;
    background: var(--accent); color: var(--accent-fg);
    display: grid; place-items: center;
    font-family: var(--display); font-weight: 700; font-size: 1.05rem;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  ol.steps > li:first-child::before { top: .3rem; }
  ol.steps li h3 { margin: 0 0 .4rem; color: var(--fg); font-size: 1.1rem; }
  ol.steps li p { margin: .25rem 0; }
  ol.steps li pre { margin-top: .7rem; }

  /* Code */
  pre {
    background: var(--code);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: .75rem .9rem;
    overflow: auto;
    font: .9rem/1.5 var(--mono);
    color: var(--fg2);
    position: relative;
    white-space: pre;
  }
  pre.cmd::before { content: "PS> "; color: var(--accent); font-weight: 600; }
  pre.url::before { content: "→ "; color: var(--mute); }
  pre .c { color: var(--mute); }
  code.inline {
    background: var(--code); border: 1px solid var(--line);
    padding: 1px .4rem; font: .9em var(--mono); color: var(--accent);
    border-radius: var(--radius-sm);
  }

  .copy-btn {
    position: absolute; top: .4rem; right: .4rem;
    background: var(--hover);
    color: var(--fg);
    border: 1px solid var(--line2);
    padding: 2px .65rem;
    font: .8rem/1.3 var(--sans); font-weight: 500;
    cursor: pointer; border-radius: var(--radius-sm);
    transition: background .12s, color .12s, border-color .12s;
  }
  .copy-btn:hover { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }

  /* Feature grid */
  .grid2 {
    display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
  .feature {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.25rem 1.3rem;
    background: var(--hover);
    transition: background .12s, border-color .12s, transform .12s;
  }
  .feature:hover { background: var(--hover2); border-color: var(--line2); transform: translateY(-1px); }
  .feature .feat-icon {
    width: 34px; height: 34px;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    border-radius: 10px; margin-bottom: .7rem;
  }
  .feature .feat-icon svg { width: 18px; height: 18px; display: block; }
  .feature h4 {
    margin: 0 0 .4rem;
    font: 600 1.05rem/1.3 var(--display);
    color: var(--fg);
  }
  .feature p { margin: 0; font-size: .95rem; color: var(--mute); line-height: 1.55; }

  /* Visuals shared across the lower marketing sections.
     - .visual-grid   : illustration on one side, copy on the other (collapses on mobile)
     - .stat-row      : row of large-number stat tiles
     - .compare-grid  : "today vs tomorrow" / "old vs new" two-column compare
     - .mesh / .leaf  : decorative SVG containers */
  .visual-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 1.85rem;
    align-items: start;
    margin-top: .6rem;
  }
  .visual-grid.flip { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .visual-grid.flip .visual-art { order: 2; }
  @media (max-width: 760px) {
    .visual-grid, .visual-grid.flip { grid-template-columns: 1fr; }
    .visual-grid .visual-art, .visual-grid.flip .visual-art { order: -1; }
  }
  .visual-grid > div:last-child { min-width: 0; }
  .visual-art {
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.35rem 1.35rem 1.5rem;
    display: grid; place-items: center;
    min-height: 100%;
  }
  .visual-art svg {
    width: 100%; height: auto; max-width: 392px; display: block;
    color: var(--fg);
    overflow: visible;
  }
  .visual-copy-stack {
    display: grid;
    gap: .95rem;
    align-content: start;
  }
  .visual-copy-stack > * { min-width: 0; }
  .visual-note {
    margin: 0;
    color: var(--mute);
    font-size: .93rem;
    line-height: 1.58;
  }
  .visual-meta-list {
    margin: .15rem 0 0;
    padding-left: 1.15rem;
    color: var(--mute);
    line-height: 1.62;
    display: grid;
    gap: .38rem;
  }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: .8rem; margin: 1rem 0 .4rem;
  }
  .stat-tile {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    padding: 1rem 1.1rem;
  }
  .stat-tile .stat-val {
    font: 700 1.45rem/1.1 var(--display);
    color: var(--accent);
    letter-spacing: -.01em;
    display: flex; align-items: baseline; gap: .35rem;
  }
  .stat-tile .stat-val small {
    font: 500 .8rem/1 var(--sans); color: var(--mute);
    letter-spacing: 0;
  }
  .stat-tile .stat-label {
    font: 500 .85rem/1.3 var(--sans);
    color: var(--mute);
    margin-top: .35rem;
  }
  .stat-tile.neg .stat-val { color: var(--bad, #ff453a); }
  .stat-tile.good .stat-val { color: var(--good); }

  .compare-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 74px minmax(0, 1fr);
    gap: 1.2rem; align-items: center;
    margin-top: 1rem;
  }
  @media (max-width: 720px) {
    .compare-grid { grid-template-columns: 1fr; }
    .compare-grid .arrow { display: none; }
  }
  .compare-card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--hover);
    padding: 1.2rem 1.25rem;
    display: flex; flex-direction: column;
    min-height: 100%;
  }
  .compare-card.bad  { border-color: color-mix(in srgb, var(--bad, #ff453a) 35%, var(--line)); }
  .compare-card.good { border-color: color-mix(in srgb, var(--good) 38%, var(--line)); }
  .compare-card .tag {
    align-self: flex-start;
    font: 600 .72rem/1 var(--sans); letter-spacing: .08em; text-transform: uppercase;
    padding: 4px 8px; border-radius: 999px;
    background: var(--panel); color: var(--mute);
    margin-bottom: .6rem;
  }
  .compare-card.bad  .tag { color: var(--bad, #ff453a); }
  .compare-card.good .tag { color: var(--good); }
  .compare-card h4 { margin: 0 0 .35rem; font: 600 1.05rem/1.3 var(--display); color: var(--fg); }
  .compare-card p { margin: .2rem 0 .4rem; color: var(--mute); font-size: .93rem; line-height: 1.55; }
  .compare-card ul { margin: .3rem 0 0; padding-left: 1.1rem; color: var(--mute); font-size: .9rem; line-height: 1.6; display: grid; gap: .35rem; }
  .compare-card .big {
    margin-top: auto; padding-top: .6rem;
    font: 700 1.3rem/1.1 var(--display); color: var(--fg);
  }
  .compare-card.bad  .big { color: var(--bad, #ff453a); }
  .compare-card.good .big { color: var(--good); }
  .compare-grid .arrow {
    align-self: center;
    justify-self: center;
    width: 74px; height: 74px;
    display: grid; place-items: center;
    border-radius: 999px;
    color: var(--accent);
    font: 700 1.5rem/1 var(--sans);
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--accent) 12%, transparent);
  }

  /* FAQ */
  .faq details {
    border-top: 1px solid var(--line);
    padding: .8rem 0;
  }
  .faq details:first-of-type { border-top: none; }
  .faq summary {
    cursor: pointer; font-weight: 600; color: var(--fg);
    list-style: none; outline: none;
    font-family: var(--display);
    display: flex; align-items: center; gap: .6rem;
    padding: .25rem .45rem;
    border-radius: var(--radius-sm);
    transition: background .12s;
  }
  .faq summary:hover { background: var(--hover); }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::before {
    content: "▸"; color: var(--accent);
    transition: transform .15s; display: inline-block;
  }
  .faq details[open] summary::before { transform: rotate(90deg); }
  .faq p {
    color: var(--mute); margin: .55rem 0 .2rem 1.6rem;
    font-size: .95rem;
  }

  footer.site {
    text-align: center; color: var(--mute);
    font-size: .9rem;
    padding: 1.6rem 1rem 2.2rem;
    border-top: 1px solid var(--line);
    margin-top: 2rem;
    background: var(--footer-bg);
  }
  footer.site a { color: var(--accent); }

  .footnote {
    text-align: center; color: var(--mute);
    font-size: .9rem; margin-top: 1.4rem;
  }

  /* Readability floor */
  p, li, summary, dd, dt, td, th, .badge { font-size: max(.92rem, 14px); }
  .feature p { font-size: .92rem; }
  code.inline { font-size: .9em; }

  @media (max-width: 560px) {
    .banner { padding: 1.6rem 1.2rem; }
    .banner h1 { font-size: 1.7rem; }
    .banner p.lead { font-size: 1rem; }
    main { padding: 1.2rem .9rem 2rem; }
    section.block { padding: 1.4rem 1.2rem; }
    section.block h2 { font-size: 1.3rem; }
  }
</style>
<link rel="stylesheet" href="/header.css">
<link rel="stylesheet" href="/app.css">
<script src="/header.js" defer></script>
<script src="/i18n.js" defer></script>
<script src="/currency.js" defer></script>
<script>
  // Apply persisted theme before paint to avoid FOUC.
  (function(){
    try {
      var t = localStorage.getItem('airweb-theme');
      if (!t) {
        var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        t = sysDark ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
</script>
</head>
<body>

<div id="aw-header"></div>

<main>
  <div class="banner">
    <div class="hero-grid">
      <div class="hero-copy">
        <h1>A people-powered cloud, built from the <span class="accent">devices you already own</span>.</h1>
        <p class="lead">AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.</p>

        <div class="cta-row">
          <a href="/dashboard" class="cta">get your key &rarr;</a>
          <a href="/login" class="cta-alt">restore from existing key</a>
        </div>

        <div class="badges">
          <span class="badge"><span class="dot"></span>${tunnelCount} active tunnel${tunnelCount === 1 ? '' : 's'} right now</span>
          <span class="badge">pay only for traffic</span>
          <span class="badge">no install · just ssh</span>
          <span class="badge">open source</span>
        </div>
      </div>

      <div class="hero-illustration" aria-hidden="true">
        <!-- Devices on the left flow over an SSH tunnel into a public cloud
             on the right. Pure inline SVG (no external images), uses theme
             colors via currentColor so it adapts to light/dark. -->
        <svg viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg" role="img">
          <defs>
            <linearGradient id="awTunnel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stop-color="var(--accent)"  stop-opacity=".15"/>
              <stop offset="50%" stop-color="var(--accent)"  stop-opacity=".55"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity=".15"/>
            </linearGradient>
            <radialGradient id="awCloud" cx="50%" cy="40%" r="60%">
              <stop offset="0%"   stop-color="var(--accent)" stop-opacity=".22"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <!-- soft glow behind the cloud -->
          <circle cx="360" cy="180" r="120" fill="url(#awCloud)"/>

          <!-- tunnel pipeline from devices to cloud -->
          <path d="M150 180 C 220 110, 290 250, 360 180" stroke="url(#awTunnel)" stroke-width="22" fill="none" stroke-linecap="round"/>
          <path d="M150 180 C 220 110, 290 250, 360 180" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="4 8" opacity=".7"/>

          <g stroke="var(--fg)" stroke-width="1.6" fill="var(--panel)" stroke-linejoin="round">
            <!-- Laptop -->
            <g transform="translate(20 60)">
              <rect x="0" y="0" width="92" height="58" rx="6"/>
              <rect x="6" y="6" width="80" height="42" rx="3" fill="var(--hover)"/>
              <path d="M-6 64 H 98 L 92 72 H 0 Z" fill="var(--panel)"/>
              <circle cx="46" cy="3" r="1.2" fill="var(--mute)" stroke="none"/>
            </g>

            <!-- Phone -->
            <g transform="translate(20 158)">
              <rect x="0" y="0" width="42" height="74" rx="7"/>
              <rect x="4" y="9" width="34" height="56" rx="2" fill="var(--hover)"/>
              <circle cx="21" cy="4.5" r="1.4" fill="var(--mute)" stroke="none"/>
              <rect x="14" y="68" width="14" height="2" rx="1" fill="var(--mute)" stroke="none"/>
            </g>

            <!-- Desktop monitor -->
            <g transform="translate(76 158)">
              <rect x="0" y="0" width="76" height="52" rx="4"/>
              <rect x="4" y="4" width="68" height="38" rx="2" fill="var(--hover)"/>
              <rect x="30" y="52" width="16" height="8" fill="var(--panel)"/>
              <rect x="20" y="60" width="36" height="4" rx="1" fill="var(--panel)"/>
            </g>

            <!-- Database / server stack -->
            <g transform="translate(40 252)">
              <ellipse cx="36" cy="6" rx="32" ry="6" fill="var(--hover)"/>
              <path d="M4 6 V 30 C 4 33.3, 18.3 36, 36 36 C 53.7 36, 68 33.3, 68 30 V 6"/>
              <path d="M4 18 C 4 21.3, 18.3 24, 36 24 C 53.7 24, 68 21.3, 68 18" fill="none"/>
              <path d="M4 30 C 4 33.3, 18.3 36, 36 36 C 53.7 36, 68 33.3, 68 30" fill="none"/>
            </g>
          </g>

          <!-- Cloud / globe destination -->
          <g transform="translate(310 120)" stroke="var(--fg)" stroke-width="1.6" fill="var(--panel)" stroke-linejoin="round">
            <circle cx="50" cy="60" r="46" fill="var(--panel)"/>
            <ellipse cx="50" cy="60" rx="46" ry="18" fill="none"/>
            <path d="M4 60 H 96 M50 14 C 30 30, 30 90, 50 106 M50 14 C 70 30, 70 90, 50 106" fill="none"/>
            <!-- little user pins around the globe -->
            <g fill="var(--accent)" stroke="none">
              <circle cx="6"  cy="40" r="3"/>
              <circle cx="92" cy="40" r="3"/>
              <circle cx="20" cy="90" r="3"/>
              <circle cx="80" cy="92" r="3"/>
            </g>
          </g>

          <!-- "ssh -R" label floating over the tunnel -->
          <g transform="translate(212 96)">
            <rect x="0" y="0" width="86" height="26" rx="13" fill="var(--panel)" stroke="var(--line2)" stroke-width="1"/>
            <text x="43" y="17" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="var(--accent)" font-weight="600">ssh -R</text>
          </g>

          <!-- "your devices" / "the public" tiny labels -->
          <g font-family="system-ui, sans-serif" font-size="11" fill="var(--mute)">
            <text x="90"  y="346" text-anchor="middle">your devices</text>
            <text x="360" y="290" text-anchor="middle">the public internet</text>
          </g>
        </svg>
      </div>
    </div>
  </div>

  <section class="block" id="protocols">
    <h2>
      <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg></span>
      Any local service becomes a public endpoint
      <span class="eyebrow">supported protocols</span>
    </h2>
    <p>If it speaks TCP on <code class="inline">localhost</code>, AirWeb can expose it. HTTP and HTTPS get a shareable subdomain; raw-TCP services get a public <code class="inline">host:port</code> assigned by the server.</p>
    <div class="protocol-strip">
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 1.8 2 10.2 0 12M8 2c-2 1.8-2 10.2 0 12"/></svg></div><span class="pname">HTTP(S)</span><span class="pport">80 / 443</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1.4"/><path d="M4 6.5l2 1.5-2 1.5M7.5 10h4"/></svg></div><span class="pname">SSH</span><span class="pport">port 22</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1.5" y="2.5" width="13" height="9" rx="1.2"/><path d="M5 14h6M8 11.5v2.5"/></svg></div><span class="pname">RDP</span><span class="pport">port 3389</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8"/><path d="M2.5 3.5v9c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-9M2.5 8c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8"/></svg></div><span class="pname">MySQL</span><span class="pport">port 3306</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8"/><path d="M2.5 3.5v9c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-9M2.5 8c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8"/></svg></div><span class="pname">PostgreSQL</span><span class="pport">port 5432</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 1c-1 4-3 7-3 9.5C5 13 6.5 14 8 14s3-1 3-3.5C11 8 9 5 8 1Z"/><path d="M8 14v1.5"/></svg></div><span class="pname">MongoDB</span><span class="pport">port 27017</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 4c0 1.1 2.7 2 6 2s6-.9 6-2-2.7-2-6-2-6 .9-6 2Zm0 4c0 1.1 2.7 2 6 2s6-.9 6-2M2 12c0 1.1 2.7 2 6 2s6-.9 6-2M2 4v8m12-8v8"/></svg></div><span class="pname">Redis</span><span class="pport">port 6379</span></div>
      <div class="protocol-tile"><div class="pico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1.5" y="2.5" width="13" height="9" rx="1.2"/><circle cx="8" cy="7" r="1.6"/><path d="M5 14h6"/></svg></div><span class="pname">VNC</span><span class="pport">port 5900</span></div>
    </div>
  </section>

  <section class="block" id="how">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></span>Get a local app online in three steps</h2>
    <ol class="steps">
      <li>
        <h3>Get your key</h3>
        <p>Open the <a href="/dashboard">dashboard</a>, click <em>Create account</em>, and save the downloaded <code class="inline">${keyFile}</code>. Your Ed25519 key <em>is</em> your account — no password, no email.</p>
      </li>
      <li>
        <h3>Run one SSH command</h3>
        <p>Point an <code class="inline">ssh -R</code> at AirWeb. The local port is whatever your app already listens on; the public side is the AirWeb host.</p>
        <pre class="cmd" id="cmd-http">ssh -i ./${keyFile} -p ${sshPort} -R 80:localhost:3000 tunnel@${host}</pre>
        <p style="color:var(--mute); font-size:.88rem; margin:.4rem 0 0">For raw TCP (databases, SSH, game servers, RDP, …) use <code class="inline">-R 0:localhost:&lt;port&gt;</code> — the server picks a free public port and prints it.</p>
      </li>
      <li>
        <h3>Share the URL — and earn while it runs</h3>
        <p>HTTP tunnels get a <code class="inline">&lt;sub&gt;.${publicDomain}</code> URL; raw TCP tunnels get <code class="inline">${publicDomain}:&lt;assigned&gt;</code>. Every minute it stays up, you earn <strong>${config.credits.uptimePerMinute} credit / min</strong>. List it on the marketplace to earn lease income on top.</p>
      </li>
    </ol>
  </section>

  <section class="block" id="use-cases">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>What you can do with it</h2>
    <div class="grid2">
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg></div>
        <h4>Make spare devices useful</h4>
        <p>That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one <code class="inline">ssh</code> command, and it joins the network as a working node.</p>
      </div>
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
        <h4>Demo your app in 30 seconds</h4>
        <p>Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on <code class="inline">localhost</code>.</p>
      </div>
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/></svg></div>
        <h4>Reach your home computer anywhere</h4>
        <p>Claim a permanent <code class="inline">&lt;handle&gt;.${publicDomain}</code> for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.</p>
      </div>
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></div>
        <h4>Lease a micro-server by the minute</h4>
        <p>Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else's tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.</p>
      </div>
    </div>
  </section>

  <section class="block" id="billing">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.7-.9-1.9-1.5-3-1.5-1.7 0-3 1-3 2.3 0 1.3 1.2 2 3 2.5s3 1.2 3 2.5c0 1.3-1.3 2.3-3 2.3-1.4 0-2.6-.6-3.2-1.5"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg></span>Pay only for the traffic you use</h2>
    <p>No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you're billed in credits only for the bytes that actually flow through it, and you earn credits every minute your own devices are serving traffic.</p>

    <div class="visual-grid">
      <!-- Earnings vs charge visual: device on the left earning a steady stream
           of green credits while bytes flow back from the cloud, with charges
           proportional to bandwidth. -->
      <div class="visual-art" aria-hidden="true">
        <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="awEarn" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="var(--good)" stop-opacity="0"/>
              <stop offset="50%"  stop-color="var(--good)" stop-opacity=".7"/>
              <stop offset="100%" stop-color="var(--good)" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="awCharge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stop-color="var(--bad, #ff453a)" stop-opacity="0"/>
              <stop offset="50%"  stop-color="var(--bad, #ff453a)" stop-opacity=".6"/>
              <stop offset="100%" stop-color="var(--bad, #ff453a)" stop-opacity="0"/>
            </linearGradient>
          </defs>

          <!-- device (laptop) -->
          <g stroke="currentColor" stroke-width="1.6" fill="var(--panel)" stroke-linejoin="round" transform="translate(28 84)">
            <rect x="0" y="0" width="92" height="62" rx="6"/>
            <rect x="6" y="6" width="80" height="46" rx="3" fill="var(--hover)"/>
            <path d="M-6 68 H 98 L 92 76 H 0 Z"/>
          </g>
          <text x="74" y="180" text-anchor="middle" font-family="system-ui" font-size="11" fill="var(--mute)">your device</text>

          <!-- cloud -->
          <g stroke="currentColor" stroke-width="1.6" fill="var(--panel)" stroke-linejoin="round" transform="translate(240 76)">
            <path d="M22 36 a16 16 0 0 1 16 -16 a20 20 0 0 1 38 6 a14 14 0 0 1 4 28 H 22 a14 14 0 0 1 0 -18 z" fill="var(--hover)"/>
          </g>
          <text x="284" y="180" text-anchor="middle" font-family="system-ui" font-size="11" fill="var(--mute)">public traffic</text>

          <!-- top channel: uptime credits earned (green, steady) -->
          <path d="M122 100 L 238 100" stroke="url(#awEarn)" stroke-width="14" fill="none" stroke-linecap="round"/>
          <g fill="var(--good)" stroke="none">
            <circle cx="140" cy="100" r="3"/>
            <circle cx="170" cy="100" r="3"/>
            <circle cx="200" cy="100" r="3"/>
            <circle cx="230" cy="100" r="3"/>
          </g>
          <text x="180" y="84" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="11" font-weight="600" fill="var(--good)">+${config.credits.uptimePerMinute} AWC / min</text>

          <!-- bottom channel: bandwidth charges (red, only when bytes flow) -->
          <path d="M238 132 L 122 132" stroke="url(#awCharge)" stroke-width="14" fill="none" stroke-linecap="round"/>
          <g fill="var(--bad, #ff453a)" stroke="none">
            <rect x="146" y="129" width="4" height="6" rx="1"/>
            <rect x="180" y="129" width="4" height="6" rx="1"/>
            <rect x="214" y="129" width="4" height="6" rx="1"/>
          </g>
          <text x="180" y="156" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="11" font-weight="600" fill="var(--bad, #ff453a)">\u2212 bytes \u00d7 ${config.credits.bandwidthChargePerMb} AWC/MB</text>

          <!-- net summary chip -->
          <g transform="translate(110 200)">
            <rect x="0" y="0" width="140" height="34" rx="17" fill="var(--panel)" stroke="var(--line2)"/>
            <text x="70" y="22" text-anchor="middle" font-family="system-ui" font-size="13" fill="var(--fg)">net = earn \u2212 charge</text>
          </g>
        </svg>
      </div>

      <div class="visual-copy-stack">
        <div class="stat-row">
          <div class="stat-tile good">
            <div class="stat-val">+${config.credits.uptimePerMinute} <small>AWC / min</small></div>
            <div class="stat-label">Earned automatically while your tunnel stays online</div>
          </div>
          <div class="stat-tile good">
            <div class="stat-val">${config.credits.defaultLeasePricePerMinute}+ <small>AWC / min</small></div>
            <div class="stat-label">Extra lease income when someone rents your tunnel</div>
          </div>
          <div class="stat-tile neg">
            <div class="stat-val">\u2212${config.credits.bandwidthChargePerMb} <small>AWC / MB</small></div>
            <div class="stat-label">Only charged for bytes that really pass through</div>
          </div>
          <div class="stat-tile">
            <div class="stat-val">${config.credits.signupBonus} <small>AWC welcome</small></div>
            <div class="stat-label">Free credits the moment you create an account</div>
          </div>
        </div>
        <p class="visual-note">Idle tunnels cost nothing. The dashboard shows a live earn-vs-charge meter and a 24-hour ledger so the math is never a mystery.</p>
      </div>
    </div>
  </section>

  <section class="block" id="community">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>A marketplace, not a billing portal</h2>
    <p>AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on capacity from other people. Every node is also a customer.</p>

    <div class="visual-grid flip">
      <!-- Mesh of peer nodes trading credits over a central marketplace hub -->
      <div class="visual-art" aria-hidden="true">
        <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg">
          <!-- central marketplace -->
          <g transform="translate(150 100)">
            <rect x="0" y="0" width="60" height="60" rx="12" fill="var(--accent)" stroke="none"/>
            <g stroke="var(--accent-fg)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 24 H 46 M 14 30 H 46 M 14 36 H 38"/>
              <circle cx="30" cy="14" r="4" fill="var(--accent-fg)" stroke="none"/>
            </g>
            <text x="30" y="82" text-anchor="middle" font-family="system-ui" font-size="11" font-weight="600" fill="var(--fg)">marketplace</text>
          </g>

          <!-- peer nodes -->
          <g stroke="currentColor" stroke-width="1.6" fill="var(--panel)">
            <circle cx="60"  cy="60"  r="20"/>
            <circle cx="300" cy="60"  r="20"/>
            <circle cx="60"  cy="200" r="20"/>
            <circle cx="300" cy="200" r="20"/>
            <circle cx="40"  cy="130" r="16"/>
            <circle cx="320" cy="130" r="16"/>
          </g>
          <g fill="var(--accent)" stroke="none">
            <circle cx="60"  cy="60"  r="6"/>
            <circle cx="300" cy="60"  r="6"/>
            <circle cx="60"  cy="200" r="6"/>
            <circle cx="300" cy="200" r="6"/>
            <circle cx="40"  cy="130" r="4"/>
            <circle cx="320" cy="130" r="4"/>
          </g>

          <!-- credit-flow connections (dashed = credits, solid = leases) -->
          <g stroke="var(--accent)" stroke-width="1.6" fill="none" stroke-dasharray="3 5" opacity=".8">
            <path d="M80 60   L 150 110"/>
            <path d="M280 60  L 210 110"/>
            <path d="M80 200  L 150 150"/>
            <path d="M280 200 L 210 150"/>
            <path d="M56 130  L 150 130"/>
            <path d="M304 130 L 210 130"/>
          </g>

          <!-- legend -->
          <g font-family="system-ui" font-size="10.5" fill="var(--mute)">
            <text x="12" y="246">peers earn + spend credits</text>
            <line x1="206" y1="242" x2="228" y2="242" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="3 5"/>
            <text x="236" y="246">credit flow</text>
          </g>
        </svg>
      </div>

      <div class="visual-copy-stack">
        <div class="grid2">
          <div class="feature">
            <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18l-2 13H5z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg></div>
            <h4>Open marketplace</h4>
            <p>List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others offer and rent the right region or hardware for the job.</p>
          </div>
          <div class="feature">
            <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></div>
            <h4>Learn by hosting</h4>
            <p>Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.</p>
          </div>
          <div class="feature">
            <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg></div>
            <h4>Reach any region</h4>
            <p>Hosts on the marketplace are spread across home connections in many cities. Rent a node where your users actually are.</p>
          </div>
          <div class="feature">
            <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="3"/></svg></div>
            <h4>Credits go both ways</h4>
            <p>Today's host is tomorrow's renter. The same wallet that earns your uptime rewards pays for the leases you take \u2014 no separate billing surface.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="block" id="vision">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg></span>The long view: a micro-server socio-economy</h2>
    <p>The world is full of perfectly good hardware sitting idle \u2014 a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it.</p>

    <div class="compare-grid">
      <div class="compare-card bad">
        <span class="tag">today</span>
        <h4>A handful of hyperscalers</h4>
        <p>Three logos own most of the public internet. Capacity = a credit card, a console, and a single-vendor lock-in.</p>
        <ul>
          <li>Always-on fleets that idle most of the day</li>
          <li>Embodied carbon poured into new hardware</li>
          <li>One vendor, one bill, one outage radius</li>
        </ul>
        <div class="big">~3 vendors</div>
      </div>

      <div class="arrow" aria-hidden="true">\u2192</div>

      <div class="compare-card good">
        <span class="tag">tomorrow</span>
        <h4>A federated, people-powered cloud</h4>
        <p>Capacity = whatever's plugged in around the world right now. Owned by the people who paid for it, traded peer-to-peer.</p>
        <ul>
          <li>Reuses devices that already exist</li>
          <li>Capacity scales with how many people show up</li>
          <li>No gatekeeper \u2014 anyone can host or rent</li>
        </ul>
        <div class="big">millions of nodes</div>
      </div>
    </div>

    <div class="grid2" style="margin-top:1.2rem">
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H4z"/><path d="M2 20h20"/></svg></div>
        <h4>Open-source cloud provider</h4>
        <p>Hyperscaler-class capabilities don't have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.</p>
      </div>
      <div class="feature">
        <div class="feat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h4>A real micro-server economy</h4>
        <p>Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy \u2014 one where small operators, students, and hobbyists are first-class participants, not just customers.</p>
      </div>
    </div>
  </section>

  <section class="block" id="esg">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3c0 9-7 16-16 16C5 10 12 3 21 3z"/><path d="M5 19c5-3 9-7 11-12"/></svg></span>Greener by default</h2>
    <p>The most sustainable server is one that already exists. By giving a second life to devices that would otherwise sit idle \u2014 or worse, in a landfill \u2014 AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute.</p>

    <div class="visual-grid">
      <!-- Comparison: tall stacked server rack with smoke vs a single small
           leafy device. Pure decorative SVG, themed via currentColor. -->
      <div class="visual-art" aria-hidden="true">
        <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg">
          <!-- left: hyperscaler stack -->
          <g transform="translate(40 30)" stroke="currentColor" stroke-width="1.5" fill="var(--panel)" stroke-linejoin="round">
            <rect x="0" y="0"  width="90" height="22" rx="3"/>
            <rect x="0" y="28" width="90" height="22" rx="3"/>
            <rect x="0" y="56" width="90" height="22" rx="3"/>
            <rect x="0" y="84" width="90" height="22" rx="3"/>
            <rect x="0" y="112" width="90" height="22" rx="3"/>
            <rect x="0" y="140" width="90" height="22" rx="3"/>
          </g>
          <g fill="var(--bad, #ff453a)" stroke="none">
            <circle cx="55"  cy="41"  r="2.5"/>
            <circle cx="55"  cy="69"  r="2.5"/>
            <circle cx="55"  cy="97"  r="2.5"/>
            <circle cx="55"  cy="125" r="2.5"/>
            <circle cx="55"  cy="153" r="2.5"/>
            <circle cx="55"  cy="181" r="2.5"/>
          </g>
          <!-- smoke wisps -->
          <g fill="none" stroke="var(--bad, #ff453a)" stroke-width="1.5" stroke-linecap="round" opacity=".55">
            <path d="M55 28 c -4 -10, 8 -14, 4 -24"/>
            <path d="M70 28 c -4 -8, 8 -12, 4 -22"/>
            <path d="M40 28 c -4 -8, 8 -12, 4 -22"/>
          </g>
          <text x="85" y="206" text-anchor="middle" font-family="system-ui" font-size="11" fill="var(--mute)">always-on fleet</text>

          <!-- divider -->
          <line x1="180" y1="30" x2="180" y2="200" stroke="var(--line2)" stroke-dasharray="3 4"/>

          <!-- right: small reused device with leaf -->
          <g transform="translate(220 80)" stroke="currentColor" stroke-width="1.6" fill="var(--panel)" stroke-linejoin="round">
            <rect x="0" y="0" width="92" height="58" rx="6"/>
            <rect x="6" y="6" width="80" height="42" rx="3" fill="var(--hover)"/>
            <path d="M-6 64 H 98 L 92 72 H 0 Z"/>
          </g>
          <!-- leaf -->
          <g transform="translate(296 56)">
            <path d="M0 14 C 2 4, 10 0, 22 0 C 22 12, 18 22, 8 22 C 4 22, 0 18, 0 14 Z" fill="var(--good)" stroke="none"/>
            <path d="M2 16 C 6 12, 12 8, 20 4" stroke="var(--panel)" stroke-width="1.2" fill="none"/>
          </g>
          <text x="266" y="206" text-anchor="middle" font-family="system-ui" font-size="11" fill="var(--mute)">device you already own</text>

          <!-- footer arrow -->
          <g transform="translate(118 214)" fill="var(--good)" stroke="none">
            <path d="M0 6 L 110 6 L 110 0 L 124 9 L 110 18 L 110 12 L 0 12 Z" opacity=".85"/>
          </g>
        </svg>
      </div>

      <div class="visual-copy-stack">
        <div class="stat-row">
          <div class="stat-tile good">
            <div class="stat-val">0 <small>new servers</small></div>
            <div class="stat-label">No new fleet to provision; capacity comes from hardware already out there</div>
          </div>
          <div class="stat-tile good">
            <div class="stat-val">~0 W <small>idle</small></div>
            <div class="stat-label">Idle tunnels just sit on an SSH socket; no idle server farm behind them</div>
          </div>
          <div class="stat-tile good">
            <div class="stat-val">2nd <small>life</small></div>
            <div class="stat-label">Old laptops, phones, and Pis go back to work instead of becoming e-waste</div>
          </div>
        </div>
        <ul class="visual-meta-list">
          <li>Reuses hardware you already own instead of provisioning new servers.</li>
          <li>Capacity appears when devices are plugged in and disappears when they're not.</li>
          <li>Smaller fleet \u2192 less embodied carbon, less e-waste, less drain on the grid.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="block faq" id="faq">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg></span>FAQ</h2>
    <details>
      <summary>What kind of "spare device" actually works?</summary>
      <p>Anything that can run an <code class="inline">ssh</code> client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.</p>
    </details>
    <details>
      <summary>Do I need to install anything?</summary>
      <p>No. Any standard <code class="inline">ssh</code> client works once you've downloaded <code class="inline">${keyFile}</code>. There is an optional Node CLI (<code class="inline">client/airweb.js</code>) that wraps <code class="inline">ssh -R</code> with friendlier flags if you want one.</p>
    </details>
    <details>
      <summary>How exactly am I charged?</summary>
      <p>You're metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.</p>
    </details>
    <details>
      <summary>How do I sign in from another device?</summary>
      <p>Open <a href="/login">/login</a> and paste your private key. We never store private keys server-side — your <code class="inline">aw_…</code> account id is derived deterministically from the public key.</p>
    </details>
    <details>
      <summary>Is the traffic encrypted?</summary>
      <p>The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.</p>
    </details>
    <details>
      <summary>Can I pick my own subdomain?</summary>
      <p>Yes — the SSH username you connect with becomes your subdomain (<code class="inline">mysub@${host}</code> → <code class="inline">mysub.${publicDomain}</code>). Spend credits in the dashboard to claim a permanent handle nobody else can take.</p>
    </details>
    <details>
      <summary>How do I stop a tunnel?</summary>
      <p>Press <code class="inline">Ctrl+C</code> in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.</p>
    </details>
  </section>

  <p class="footnote">
    <span style="color:var(--good)">●</span> ${tunnelCount} tunnel${tunnelCount === 1 ? '' : 's'} currently active on this host — running on devices people already owned.
  </p>
</main>

<footer class="site">
  airweb · self-hosted reverse ssh tunneling ·
  <a href="https://github.com" rel="noopener">source</a>
</footer>

<script>
  // Theme + settings gear are wired by /header.js (shared across pages).

  // One-click copy for code blocks
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn'; btn.textContent = 'copy';
    btn.onclick = async () => {
      const text = pre.innerText.replace(/^\\s*#.*$/gm, '').trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'ok';
        setTimeout(() => btn.textContent = 'copy', 1200);
      } catch {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); btn.textContent = 'ok'; }
        catch { btn.textContent = 'fail'; }
        document.body.removeChild(ta);
        setTimeout(() => btn.textContent = 'copy', 1200);
      }
    };
    pre.appendChild(btn);
  });
</script>

</body></html>`;
}

function notFound(res, msg) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><title>AirWeb</title>
<body style="font-family:system-ui;max-width:640px;margin:4rem auto;padding:0 1rem;color:#222">
<h1>Tunnel not found</h1>
<p>${escapeHtml(msg)}</p>
<p style="color:#888">AirWeb · reverse SSH tunneling</p>`);
}

// ---------------------------------------------------------------------------
// Placeholder shown when the channel to the client's local server fails or
// the upstream closes without ever sending a byte.
// ---------------------------------------------------------------------------
function servePlaceholder(socket, tunnel, err) {
  if (socket.destroyed) return;
  const body = placeholderHtml(tunnel, err);
  try {
    socket.write(
      'HTTP/1.1 502 Bad Gateway\r\n' +
      'Content-Type: text/html; charset=utf-8\r\n' +
      'Content-Length: ' + Buffer.byteLength(body) + '\r\n' +
      'Cache-Control: no-store\r\n' +
      'Connection: close\r\n\r\n' +
      body
    );
  } catch {}
  try { socket.end(); } catch {}
}

function placeholderHtml(tunnel, err) {
  const url      = escapeHtml((tunnel && tunnel.publicUrl) || '');
  const upstream = escapeHtml(tunnel
    ? `${tunnel.bindAddr || 'localhost'}:${tunnel.bindPort}`
    : 'unknown');
  const user     = escapeHtml((tunnel && tunnel.username) || '');
  const reason   = escapeHtml((err && err.message) || 'upstream connection failed');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>AirWeb · upstream unavailable</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: linear-gradient(135deg,#0f1115 0%,#1a1f2e 100%); color:#e7eaf0; padding:2rem; }
  .card { max-width: 560px; width:100%; background:#161a25; border:1px solid #232734;
          border-radius:14px; padding:2rem 2.2rem; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
  .badge { display:inline-block; font-size:.7rem; font-weight:700; letter-spacing:1px;
           text-transform:uppercase; padding:3px 8px; border-radius:5px;
           background:#3a1d1d; color:#ffb3b3; border:1px solid #5a2a2a; }
  h1 { margin:.8rem 0 .4rem; font-size:1.4rem; }
  p  { color:#a9b1c2; margin:.4rem 0; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:.4rem 1rem; margin:1.2rem 0 .4rem;
       font-family: ui-monospace, Menlo, monospace; font-size:.85rem; }
  dt { color:#8a93a6; }
  dd { margin:0; color:#cfd6e4; word-break:break-all; }
  code { background:#0b0d12; border:1px solid #232734; padding:1px 6px; border-radius:4px; }
  .hint { margin-top:1.4rem; padding:.9rem 1rem; background:#10131a;
          border:1px solid #232734; border-radius:8px; color:#8a93a6; font-size:.85rem; }
  footer { margin-top:1.2rem; color:#5b6478; font-size:.75rem; text-align:right; }
</style>
</head><body>
  <main class="card">
    <span class="badge">502 · upstream unavailable</span>
    <h1>Nothing is answering on the other end of the tunnel.</h1>
    <p>The tunnel is registered, but AirWeb couldn't reach the local service it points to.</p>
    <dl>
      <dt>tunnel</dt><dd>${url}</dd>
      <dt>upstream</dt><dd>${upstream}</dd>
      <dt>owner</dt><dd>${user}</dd>
      <dt>reason</dt><dd>${reason}</dd>
    </dl>
    <div class="hint">
      If you're the owner: make sure your local server is running and listening on
      <code>${upstream}</code>, then refresh this page.
    </div>
    <footer>AirWeb · reverse SSH tunneling</footer>
  </main>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Proxy: pipe raw bytes between the public socket and the SSH-forwarded channel
// ---------------------------------------------------------------------------

// Served when the owner (or an admin) has paused public access. The SSH
// session stays connected; flip the switch back and traffic resumes.
function serveDisabled(socket, tunnel) {
  if (socket.destroyed) return;
  const url = escapeHtml((tunnel && tunnel.publicUrl) || '');
  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>AirWeb \u00b7 tunnel paused</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: linear-gradient(135deg,#0f1115 0%,#1f1a24 100%); color:#e7eaf0; padding:2rem; }
  .card { max-width: 520px; width:100%; background:#161a25; border:1px solid #232734;
          border-radius:14px; padding:2rem 2.2rem; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
  .badge { display:inline-block; font-size:.7rem; font-weight:700; letter-spacing:1px;
           text-transform:uppercase; padding:3px 8px; border-radius:5px;
           background:#3a2f1d; color:#ffd9a0; border:1px solid #5a4624; }
  h1 { margin:.8rem 0 .4rem; font-size:1.3rem; }
  p  { color:#a9b1c2; margin:.4rem 0; }
  code { background:#0b0d12; border:1px solid #232734; padding:1px 6px; border-radius:4px;
         font-family: ui-monospace, Menlo, monospace; font-size:.85rem; }
  footer { margin-top:1.2rem; color:#5b6478; font-size:.75rem; text-align:right; }
</style></head><body>
  <main class="card">
    <span class="badge">503 \u00b7 paused by owner</span>
    <h1>This tunnel is temporarily not accepting public traffic.</h1>
    <p>The owner has paused public access to <code>${url}</code>. It will resume once they re-enable it from their dashboard.</p>
    <footer>AirWeb \u00b7 reverse SSH tunneling</footer>
  </main>
</body></html>`;
  try {
    socket.write(
      'HTTP/1.1 503 Service Unavailable\r\n' +
      'Content-Type: text/html; charset=utf-8\r\n' +
      'Content-Length: ' + Buffer.byteLength(body) + '\r\n' +
      'Cache-Control: no-store\r\n' +
      'Retry-After: 30\r\n' +
      'Connection: close\r\n\r\n' +
      body
    );
  } catch {}
  try { socket.end(); } catch {}
}

function proxyToTunnel(socket, tunnel, headBuf) {
  // Public access can be toggled off by the owner or an admin without tearing
  // the SSH session down. Respond with a 503 page so the requester gets
  // something more useful than a TCP reset.
  if (tunnel.disabled) {
    return serveDisabled(socket, tunnel);
  }

  const srcIp   = socket.remoteAddress || '0.0.0.0';
  const srcPort = socket.remotePort || 0;

  tunnel.openChannel(srcIp, srcPort)
    .then((ch) => {
      if (socket.destroyed) { try { ch.end(); } catch {} return; }

      // If the upstream closes the channel without ever sending data, treat
      // it as "upstream unavailable" and serve the placeholder so the browser
      // doesn't just see an empty response.
      let gotData = false;
      let placeholderSent = false;
      const handleSilentClose = () => {
        if (gotData || placeholderSent || socket.destroyed) {
          try { socket.end(); } catch {}
          return;
        }
        placeholderSent = true;
        servePlaceholder(socket, tunnel,
          new Error('upstream closed the connection without responding'));
      };

      ch.on('data',  () => { gotData = true; });
      ch.on('end',   handleSilentClose);
      ch.on('close', handleSilentClose);

      if (headBuf && headBuf.length) ch.write(headBuf);
      socket.pipe(ch);
      ch.pipe(socket, { end: false });   // we end socket ourselves above

      socket.on('error', () => { try { ch.end(); } catch {} });
      ch.on('error',     () => { try { socket.end(); } catch {} });
      socket.on('close', () => { try { ch.end(); } catch {} });
    })
    .catch((err) => servePlaceholder(socket, tunnel, err));
}

// ---------------------------------------------------------------------------
// Passcode gating for HTTP/HTTPS leased tunnels
// ---------------------------------------------------------------------------
function parseRequestLineAndHeaders(buf) {
  const headEnd = buf.indexOf('\r\n\r\n');
  const limit = headEnd === -1 ? buf.length : headEnd;
  const text = buf.slice(0, limit).toString('utf8');
  const firstLineEnd = text.indexOf('\r\n');
  if (firstLineEnd < 0) return { method: '', path: '/', headers: '' };
  const line = text.slice(0, firstLineEnd);
  const headers = text.slice(firstLineEnd + 2);
  const lm = /^([A-Z]+)\s+([^\s]+)\s+HTTP\/1\.[01]/.exec(line);
  return {
    method: lm ? lm[1] : '',
    path:   lm ? lm[2] : '/',
    headers,
  };
}

function extractPasscodeFromCookie(headerText) {
  const m = /\r\nCookie:[ \t]*([^\r\n]+)/i.exec('\r\n' + headerText);
  if (!m) return null;
  const cm = PASSCODE_COOKIE_RE.exec(m[1]);
  return cm ? cm[1].toUpperCase() : null;
}

function extractPasscodeFromPath(path) {
  const m = PASSCODE_QUERY_RE.exec(path || '');
  return m ? m[1].toUpperCase() : null;
}

function isRequestAuthorized(buf, gate) {
  const { headers } = parseRequestLineAndHeaders(buf);
  const cookiePass = extractPasscodeFromCookie(headers);
  return !!(cookiePass && gate.passcodes.has(cookiePass));
}

function stripPasscodeParam(path) {
  if (!path) return '/';
  const q = path.indexOf('?');
  if (q < 0) return path;
  const base = path.slice(0, q);
  const params = path.slice(q + 1).split('&').filter(p => p && !/^aw_pass=/i.test(p));
  return params.length ? `${base}?${params.join('&')}` : base;
}

function passcodeFormHtml({ cleanPath, error, expiresAt }) {
  const expiresLabel = expiresAt > 0
    ? new Date(expiresAt).toUTCString()
    : '—';
  const errBlock = error
    ? `<p class="err">${escapeHtml(error)}</p>`
    : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Private — AirWeb</title>
<style>
  :root { color-scheme: dark light; }
  html,body { height:100%; margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { display:grid; place-items:center; background:#0e0e10; color:#f5f5f7; padding:1rem; }
  .card { width:100%; max-width:380px; background:#1c1c1e; border:1px solid #2c2c2e; border-radius:14px; padding:1.6rem; box-shadow:0 12px 32px rgba(0,0,0,.4); }
  h1 { font-size:1.15rem; margin:0 0 .5rem; }
  p  { color:#a1a1a6; font-size:.85rem; margin:.4rem 0 1rem; line-height:1.4; }
  .err { color:#ff6b6b; font-size:.8rem; margin:0 0 .8rem; }
  input[type=text] { width:100%; box-sizing:border-box; font-family:inherit; font-size:1rem; padding:.7rem .9rem; border-radius:10px; border:1px solid #3a3a3c; background:#0e0e10; color:#f5f5f7; letter-spacing:.12em; text-transform:uppercase; }
  button { margin-top:.8rem; width:100%; padding:.7rem 1rem; border-radius:10px; border:0; background:#0a84ff; color:#fff; font-weight:600; font-size:.95rem; cursor:pointer; }
  button:hover { background:#0070dd; }
  .meta { color:#6e6e73; font-size:.7rem; margin-top:1rem; text-align:center; }
</style>
</head><body>
  <form class="card" method="GET" action="${escapeHtml(cleanPath)}">
    <h1>Private leased service</h1>
    <p>Enter the passcode from your lease to access this site. The passcode expires when the lease ends.</p>
    ${errBlock}
    <input type="text" name="aw_pass" autofocus autocomplete="off" maxlength="16" required pattern="[A-Za-z0-9]+" placeholder="PASSCODE">
    <button type="submit">Unlock</button>
    <p class="meta">Access expires: ${escapeHtml(expiresLabel)}</p>
  </form>
</body></html>`;
}

function writeHttpResponse(socket, { status, statusText, headers = {}, body = '' }) {
  const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  const lines = [`HTTP/1.1 ${status} ${statusText}`];
  const h = Object.assign({
    'Content-Length': String(bodyBuf.length),
    'Connection':     'close',
    'Cache-Control':  'no-store',
    'X-Robots-Tag':   'noindex, nofollow',
  }, headers);
  for (const [k, v] of Object.entries(h)) {
    if (Array.isArray(v)) for (const vv of v) lines.push(`${k}: ${vv}`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('', '');
  try {
    socket.write(lines.join('\r\n'));
    socket.end(bodyBuf);
  } catch {
    try { socket.destroy(); } catch {}
  }
}

function handleGatedRequest(socket, buf, gate, sub) {
  const { method, path, headers } = parseRequestLineAndHeaders(buf);
  const cleanPath = stripPasscodeParam(path) || '/';
  const queryPass = extractPasscodeFromPath(path);

  // Empty passcodes set = listing exists but no active lease — always blocked.
  if (gate.passcodes.size === 0) {
    return writeHttpResponse(socket, {
      status: 423, statusText: 'Locked',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: passcodeFormHtml({ cleanPath, error: 'This service is listed for lease but has no active lease yet.', expiresAt: 0 }),
    });
  }

  if (queryPass && gate.passcodes.has(queryPass)) {
    // Valid passcode in query string — set cookie, redirect to clean URL.
    const maxAge = Math.max(60, Math.floor((gate.expiresAt - Date.now()) / 1000));
    const cookie = `${PASSCODE_COOKIE}=${queryPass}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
    return writeHttpResponse(socket, {
      status: 302, statusText: 'Found',
      headers: {
        'Location':   cleanPath,
        'Set-Cookie': cookie,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: 'Redirecting…',
    });
  }

  // No cookie (or wrong cookie) and no query passcode (or wrong one): show form.
  const cookiePass = extractPasscodeFromCookie(headers);
  const error = (queryPass || cookiePass) ? 'Invalid or expired passcode.' : null;
  return writeHttpResponse(socket, {
    status: error ? 401 : 401, statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'WWW-Authenticate': `Bearer realm="${sub}.${publicHost()}"`,
    },
    body: passcodeFormHtml({ cleanPath, error, expiresAt: gate.expiresAt }),
  });
}

// ---------------------------------------------------------------------------
// Connection dispatcher: peek at the Host header, then route
// ---------------------------------------------------------------------------
function handleConnection(socket, httpServer) {
  let buf = Buffer.alloc(0);
  let done = false;

  const cleanup = () => {
    socket.removeListener('data', onData);
    socket.removeListener('end',  onEnd);
    socket.removeListener('error', onErr);
    clearTimeout(timer);
  };

  const onData = (chunk) => {
    if (done) return;
    buf = Buffer.concat([buf, chunk]);

    const headEnd = buf.indexOf('\r\n\r\n');
    const limit = headEnd === -1 ? buf.length : headEnd;

    if (limit > MAX_HEADER_PEEK) {
      done = true; cleanup();
      try { socket.destroy(); } catch {}
      return;
    }

    // Pull the Host: header out of whatever we have so far.
    const headers = buf.slice(0, limit).toString('utf8');
    const m = /\r\nHost:[ \t]*([^\r\n]+)/i.exec('\r\n' + headers);

    // Not enough data yet to find Host and headers aren't complete — keep buffering.
    if (!m && headEnd === -1) return;

    done = true; cleanup();

    const sub = extractSubdomain(m ? m[1].trim() : '');
    const tunnel = sub && registry.lookupSubdomain(sub);

    if (tunnel) {
      const gate = marketplace.gateForSubdomain(sub);
      if (gate && !isRequestAuthorized(buf, gate)) {
        handleGatedRequest(socket, buf, gate, sub);
        return;
      }
      proxyToTunnel(socket, tunnel, buf);
    } else {
      // Apex host, unknown sub, or no Host header -> let http.Server handle it
      // (landing page / 404).
      if (buf.length) socket.unshift(buf);
      httpServer.emit('connection', socket);
    }
  };

  const onEnd = () => { if (!done) { cleanup(); try { socket.destroy(); } catch {} } };
  const onErr = () => { if (!done) { cleanup(); try { socket.destroy(); } catch {} } };

  const timer = setTimeout(() => {
    if (!done) { cleanup(); try { socket.destroy(); } catch {} }
  }, PEEK_TIMEOUT_MS);

  socket.on('data',  onData);
  socket.on('end',   onEnd);
  socket.on('error', onErr);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
function start() {
  // Internal http.Server handles only apex routes (API, dashboard, landing page)
  // and 404 for unknown subs.
  const httpServer = http.createServer(async (req, res) => {
    const sub = extractSubdomain(req.headers.host);
    if (sub) return notFound(res, `No tunnel registered for "${sub}".`);

    try {
      const handled = await apiRouter.handle(req, res);
      if (handled !== null) return;          // apiRouter handled it
    } catch (err) {
      console.error('[apiRouter] error:', err);
      try { res.statusCode = 500; res.end('internal error'); } catch {}
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') return landingPage(res);
    res.statusCode = 404; res.end('not found');
  });
  httpServer.on('upgrade', (_req, socket) => {
    try { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); } catch {}
    try { socket.destroy(); } catch {}
  });
  httpServer.on('clientError', (_err, socket) => {
    try { socket.destroy(); } catch {}
  });

  const netServer = net.createServer((socket) => {
    // Tier-0 perf knobs on every public-facing socket. Cheap, big wins:
    //  • setNoDelay     → ditches Nagle's 200 ms delay on small writes
    //  • setKeepAlive   → kernel reaps dead peers so we don't have to
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30_000);
    handleConnection(socket, httpServer);
  });

  netServer.listen(config.http.port, config.http.host, () => {
    console.log(`[http] listening on ${config.http.host}:${config.http.port} (public: ${config.http.publicDomain})`);
  });

  return netServer;
}

module.exports = { start };
