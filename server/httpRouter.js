// Public-facing HTTP/WebSocket router.
//
// Architecture: we accept raw TCP connections, peek at the first few bytes to
// read the Host header, and then decide:
//   * known subdomain  -> pipe the raw socket through the SSH tunnel's channel
//   * everything else  -> hand the socket to an internal http.Server which
//                         serves the landing page (or 404 for unknown subs).
//
// Hijacking at the TCP layer (instead of in `server.on('request', ...)`) avoids
// fighting Node's HTTP parser, which otherwise keeps consuming socket bytes
// even after listeners are removed and causes proxied requests to hang.

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
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Robots-Tag', 'index, follow');
  res.end(html);
}

function renderLandingHtml() {
  const scheme        = config.http.publicScheme || 'http';
  const publicDomain  = config.http.publicDomain;
  const host          = publicHost();
  const siteUrl       = `${scheme}://${publicDomain}`;
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
    padding: 1.8rem 2rem;
    margin-bottom: 1.4rem;
    box-shadow: var(--shadow-card);
  }
  .banner::before {
    content: ""; position: absolute; pointer-events: none;
    width: 520px; height: 520px; top: -180px; right: -160px;
    background: radial-gradient(circle at center,
      color-mix(in srgb, var(--accent) 28%, transparent) 0%,
      transparent 60%);
    filter: blur(20px); opacity: .8; z-index: 0;
  }
  .banner::after {
    content: ""; position: absolute; pointer-events: none;
    width: 380px; height: 380px; bottom: -140px; left: -120px;
    background: radial-gradient(circle at center,
      color-mix(in srgb, var(--good) 20%, transparent) 0%,
      transparent 60%);
    filter: blur(20px); opacity: .6; z-index: 0;
  }
  .banner > * { position: relative; z-index: 1; }
  .banner-ascii { display: none; }
  .banner h1 {
    font: 600 1.9rem/1.2 var(--display);
    margin: 0 0 .8rem;
    color: var(--fg);
    letter-spacing: -.015em;
  }
  .banner h1 .accent { color: var(--accent); }
  .banner p.lead {
    color: var(--mute); margin: 0 0 1rem;
    max-width: 64ch; font-size: 1.05rem;
  }
  .banner .cta-row {
    display: flex; flex-wrap: wrap; gap: .6rem; align-items: center;
    margin-top: 1.2rem;
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
    padding: 1.4rem 1.6rem;
    margin: 1rem 0;
    box-shadow: var(--shadow-card);
  }
  section.block h2 {
    margin: 0 0 .9rem;
    font: 600 1.3rem/1.25 var(--display);
    color: var(--fg);
    border-bottom: 1px solid var(--line);
    padding-bottom: .55rem;
    letter-spacing: -.005em;
    display: flex; align-items: center; gap: .55rem;
  }
  section.block h2 .icon {
    width: 22px; height: 22px; flex: 0 0 22px;
    color: var(--accent);
  }
  section.block h2 .icon svg { width: 100%; height: 100%; display: block; }
  section.block h3 {
    margin: 1rem 0 .35rem;
    font: 600 1.02rem/1.3 var(--display);
    color: var(--fg);
  }
  section.block p { margin: .4rem 0 .6rem; color: var(--fg2); }

  /* Steps */
  ol.steps {
    counter-reset: step; list-style: none;
    padding: 0; margin: .5rem 0 0;
  }
  ol.steps > li {
    counter-increment: step;
    padding: 1rem 0 1rem 3.2rem;
    position: relative;
    border-top: 1px solid var(--line);
  }
  ol.steps > li:first-child { border-top: none; padding-top: .3rem; }
  ol.steps > li::before {
    content: counter(step);
    position: absolute; left: 0; top: 1rem;
    width: 2.2rem; height: 2.2rem; border-radius: 50%;
    background: var(--accent); color: var(--accent-fg);
    display: grid; place-items: center;
    font-family: var(--display); font-weight: 700; font-size: 1rem;
  }
  ol.steps > li:first-child::before { top: .3rem; }
  ol.steps li h3 { margin: 0 0 .3rem; color: var(--fg); }

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
    display: grid; gap: .8rem;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  }
  .feature {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
    background: var(--hover);
    transition: background .12s, border-color .12s, transform .12s;
  }
  .feature:hover { background: var(--hover2); border-color: var(--line2); transform: translateY(-1px); }
  .feature .feat-icon {
    width: 28px; height: 28px;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    border-radius: 8px; margin-bottom: .55rem;
  }
  .feature .feat-icon svg { width: 16px; height: 16px; display: block; }
  .feature h4 {
    margin: 0 0 .35rem;
    font: 600 1rem/1.3 var(--display);
    color: var(--fg);
  }
  .feature p { margin: 0; font-size: .92rem; color: var(--mute); line-height: 1.5; }

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
    .banner h1 { font-size: 1.45rem; }
    main { padding: 1.2rem .9rem 2rem; }
    section.block, .banner { padding: 1.1rem 1.1rem; }
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
    <h1>A people-powered cloud, built from the <span class="accent">devices you already own</span>.</h1>
    <p class="lead">AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.</p>

    <div class="cta-row">
      <a href="/dashboard" class="cta">get your key &rarr;</a>
      <a href="/login" class="cta-alt">or restore from existing key</a>
    </div>

    <div class="badges">
      <span class="badge"><span class="dot"></span>${tunnelCount} active tunnel${tunnelCount === 1 ? '' : 's'} right now</span>
      <span class="badge">pay only for traffic</span>
      <span class="badge">no install · just ssh</span>
      <span class="badge">open source · greener by default</span>
    </div>
  </div>

  <section class="block" id="use-cases">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>What you can do today</h2>
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

  <section class="block" id="quickstart">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></span>Quick start</h2>
    <p>Grab your key from the <a href="/dashboard">dashboard</a> and run one command — your local port is public.</p>
    <pre class="cmd" id="cmd-http">ssh -i ./${keyFile} -p ${sshPort} -R 80:localhost:3000 tunnel@${host}</pre>
    <p style="color:var(--mute); font-size:.85rem; margin:.4rem 0 0">Change <code class="inline">3000</code> to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use <code class="inline">-R 0:localhost:&lt;port&gt;</code>.</p>
  </section>

  <section class="block" id="billing">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.7-.9-1.9-1.5-3-1.5-1.7 0-3 1-3 2.3 0 1.3 1.2 2 3 2.5s3 1.2 3 2.5c0 1.3-1.3 2.3-3 2.3-1.4 0-2.6-.6-3.2-1.5"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg></span>Pay only for the traffic you use</h2>
    <p>No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you're billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn't use.</p>
    <div class="grid2">
      <div class="feature">
        <h4>Metered by the byte</h4>
        <p>Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.</p>
      </div>
      <div class="feature">
        <h4>Earn while you host</h4>
        <p>Every minute your own device serves traffic, you earn <strong>${config.credits.uptimePerMinute} credit / min</strong> in uptime rewards, plus <strong>${config.credits.defaultLeasePricePerMinute}+ credits / min</strong> when someone leases your tunnel from the marketplace.</p>
      </div>
    </div>
  </section>

  <section class="block" id="community">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Earn, learn, and build with the community</h2>
    <p>AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.</p>
    <div class="grid2">
      <div class="feature">
        <h4>Open marketplace</h4>
        <p>List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.</p>
      </div>
      <div class="feature">
        <h4>Learn by hosting</h4>
        <p>Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.</p>
      </div>
    </div>
  </section>

  <section class="block" id="vision">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg></span>The long view: a micro-server socio-economy</h2>
    <p>The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.</p>
    <div class="grid2">
      <div class="feature">
        <h4>Open-source cloud provider</h4>
        <p>Hyperscaler-class capabilities don't have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.</p>
      </div>
      <div class="feature">
        <h4>A micro-server economy</h4>
        <p>Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.</p>
      </div>
    </div>
  </section>

  <section class="block" id="esg">
    <h2><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3c0 9-7 16-16 16C5 10 12 3 21 3z"/><path d="M5 19c5-3 9-7 11-12"/></svg></span>Greener by default</h2>
    <p>The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.</p>
    <ul style="margin:.4rem 0 0; padding-left:1.2rem; color:var(--mute);">
      <li>Reuses hardware you already own instead of provisioning new servers.</li>
      <li>Idle tunnels consume effectively nothing — they just sit on an SSH socket.</li>
      <li>No always-on overhead farms: capacity appears when devices are plugged in and disappears when they're not.</li>
    </ul>
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
