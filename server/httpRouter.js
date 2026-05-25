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
  const tunnels       = registry.list().filter(t => t.type === 'http');
  const tunnelCount   = tunnels.length;
  const description   = `Self-hosted reverse SSH tunneling on ${host}. ` +
    `Expose any local port to the internet over an encrypted SSH tunnel — ` +
    `no client install, no signups, no extra software.`;

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
<title>AirWeb — Expose localhost over SSH in one command</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="#0b0d12" />
<link rel="canonical" href="${escapeHtml(siteUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:title" content="AirWeb — Expose localhost over SSH" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(siteUrl)}" />
<meta property="og:site_name" content="AirWeb" />

<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="AirWeb — Expose localhost over SSH" />
<meta name="twitter:description" content="${escapeHtml(description)}" />

<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%233a6ed1'/%3E%3Ctext x='50%25' y='58%25' font-family='system-ui' font-size='38' text-anchor='middle' fill='white' font-weight='700'%3EA%3C/text%3E%3C/svg%3E" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>
  :root { color-scheme: light dark; --bg:#0f1115; --panel:#161a25; --line:#232734; --fg:#e7eaf0; --mute:#8a93a6; --accent:#9fcaff; --accent2:#3a6ed1; --code:#0b0d12; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
         background: radial-gradient(1200px 600px at 50% -10%, #1a2240 0%, var(--bg) 60%) fixed; color: var(--fg); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header.site { padding: 1rem 1.2rem; border-bottom: 1px solid var(--line); display:flex; align-items:center; gap:.8rem; max-width: 980px; margin: 0 auto; }
  header.site .logo { width:30px; height:30px; border-radius:8px; background: var(--accent2); display:grid; place-items:center; font-weight:800; color:#fff; }
  header.site nav { margin-left:auto; display:flex; gap:1.2rem; font-size:.9rem; color: var(--mute); }
  header.site nav a { color: var(--mute); }
  main { max-width: 880px; margin: 0 auto; padding: 3rem 1.2rem 5rem; }
  .hero { text-align:center; margin-bottom: 3rem; }
  .hero h1 { font-size: clamp(2rem, 4vw, 3rem); line-height: 1.15; margin: 0 0 1rem; letter-spacing: -.01em; }
  .hero h1 .accent { background: linear-gradient(90deg,#9fcaff,#7ee0c1); -webkit-background-clip:text; background-clip:text; color: transparent; }
  .hero p.lead { font-size: 1.15rem; color: var(--mute); max-width: 620px; margin: 0 auto 1.4rem; }
  .badges { display:flex; flex-wrap:wrap; gap:.5rem; justify-content:center; margin-top: 1rem; }
  .badge { display:inline-flex; align-items:center; gap:.4rem; font-size:.75rem; padding: 4px 10px; border:1px solid var(--line); border-radius:999px; color:var(--mute); background: rgba(255,255,255,.02); }
  .badge .dot { width:6px; height:6px; border-radius:50%; background:#3acf6d; }
  section.card { background: var(--panel); border:1px solid var(--line); border-radius:14px; padding: 1.8rem 2rem; margin: 1.4rem 0; box-shadow: 0 8px 30px rgba(0,0,0,.25); }
  section.card h2 { margin: 0 0 1rem; font-size: 1.25rem; }
  section.card h3 { margin: 1.4rem 0 .4rem; font-size: 1rem; color: var(--fg); }
  ol.steps { counter-reset: step; list-style:none; padding:0; margin:0; }
  ol.steps li { counter-increment: step; padding: 1rem 0 1rem 3rem; position: relative; border-top: 1px solid var(--line); }
  ol.steps li:first-child { border-top: none; padding-top: 0; }
  ol.steps li:first-child::before { top: -.2rem; }
  ol.steps li::before { content: counter(step); position: absolute; left: 0; top: .85rem; width: 2rem; height: 2rem; border-radius: 50%; background: var(--accent2); color: white; display:grid; place-items:center; font-weight: 700; font-size:.85rem; }
  ol.steps li h3 { margin: 0 0 .3rem; }
  pre { background: var(--code); border:1px solid var(--line); border-radius: 8px; padding: .9rem 1rem; overflow:auto; font: .85rem/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #d8e0ee; position: relative; }
  pre .c { color:#5b6478; }
  code.inline { background: var(--code); border:1px solid var(--line); border-radius: 5px; padding: 1px 6px; font: .85rem/1 ui-monospace, Menlo, monospace; }
  .grid2 { display:grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .feature { padding: 1rem 1.1rem; background: rgba(255,255,255,.02); border:1px solid var(--line); border-radius: 10px; }
  .feature h4 { margin: 0 0 .3rem; font-size: .95rem; }
  .feature p { margin: 0; font-size: .85rem; color: var(--mute); }
  .faq details { border-top: 1px solid var(--line); padding: .9rem 0; }
  .faq details:first-of-type { border-top: none; }
  .faq summary { cursor: pointer; font-weight: 600; }
  .faq p { color: var(--mute); margin: .4rem 0 0; }
  footer.site { text-align: center; color: var(--mute); font-size: .8rem; padding: 2rem 1rem 3rem; }
  footer.site a { color: var(--mute); }
  .copy-btn { position:absolute; top:.5rem; right:.5rem; background:#222837; color:#cfd6e4; border:1px solid #2c3344; padding: 3px 8px; border-radius:5px; font-size:.7rem; cursor:pointer; }
  .copy-btn:hover { background:#2a3146; }
</style>
</head>
<body>

<header class="site">
  <span class="logo">A</span>
  <strong>AirWeb</strong>
  <nav>
    <a href="#quickstart">Quick start</a>
    <a href="#how-it-works">How it works</a>
    <a href="#faq">FAQ</a>
    <a href="/dashboard">Dashboard</a>
  </nav>
</header>

<main>
  <section class="hero">
    <h1>Expose <span class="accent">localhost</span> to the internet —<br/>and <span class="accent">earn credits</span> while you do.</h1>
    <p class="lead">${escapeHtml(description)} Register once to download a wallet-style SSH key, share your unused uptime with the marketplace, or lease someone else's tunnel with the credits you earn.</p>
    <p style="margin-top:1.6rem">
      <a href="/dashboard" class="cta" style="display:inline-block;background:var(--accent2);color:white;padding:.8rem 1.4rem;border-radius:8px;font-weight:600;text-decoration:none">Get your key →</a>
      <a href="/login" style="margin-left:.6rem;color:var(--mute)">or restore from existing key</a>
    </p>
    <div class="badges">
      <span class="badge"><span class="dot"></span>${tunnelCount} active tunnel${tunnelCount === 1 ? '' : 's'}</span>
      <span class="badge">Wallet-style identity (0x…)</span>
      <span class="badge">Encrypted by SSH</span>
      <span class="badge">Earn / spend credits</span>
    </div>
  </section>

  <section class="card" id="quickstart">
    <h2>Quick start</h2>
    <p>You only need the <code class="inline">ssh</code> command (built into macOS, Linux, and modern Windows).</p>

    <ol class="steps">
      <li>
        <h3>Register &amp; download your key</h3>
        <p>Open the <a href="/dashboard">dashboard</a> — it generates an Ed25519 SSH key, derives your wallet-style address (<code class="inline">0x…</code>), and downloads the private key file <code class="inline">airweb_key</code>. You also get a signup bonus of ${config.credits.signupBonus} credits.</p>
        <pre>chmod 600 ./airweb_key   <span class="c"># macOS/Linux only</span></pre>
      </li>
      <li>
        <h3>Start a local server</h3>
        <pre>npx serve -l 3000        <span class="c"># or: python -m http.server 3000</span></pre>
      </li>
      <li>
        <h3>Open a tunnel with your key</h3>
        <pre id="cmd-http">ssh -i ./airweb_key -p ${sshPort} -R 80:localhost:3000 mysub@${host}</pre>
        <p>Your SSH username becomes your public subdomain — pick any free name, or buy a permanent <em>handle</em> in the dashboard so nobody else can claim it.</p>
      </li>
      <li>
        <h3>Share your URL — and earn credits while it's up</h3>
        <pre>${escapeHtml(scheme)}://mysub.${escapeHtml(publicDomain)}</pre>
        <p>You earn <strong>${config.credits.uptimePerMinute} credit / minute</strong> for every minute your tunnel stays online. Spend them on others' VPS tunnels in the marketplace, or buy yourself a handle.</p>
      </li>
    </ol>
  </section>

  <section class="card">
    <h2>Forward a raw TCP port</h2>
    <p>For databases, SSH, game servers, or anything that isn't HTTP. The server picks a public port from its TCP range and returns it on connect.</p>
    <pre>ssh -i ./airweb_key -p ${sshPort} -R 0:localhost:5432 mysub@${host}
<span class="c"># server prints something like:  tcp://${host}:14732</span></pre>
    <p>Connect with <code class="inline">psql -h ${host} -p 14732 …</code> (or whatever client matches your protocol).</p>
  </section>

  <section class="card" id="how-it-works">
    <h2>How it works</h2>
    <div class="grid2">
      <div class="feature"><h4>1. Wallet-style identity</h4><p>Click "Get your key" → AirWeb generates an Ed25519 keypair, hashes the public key into a <code class="inline">0x…</code> address that becomes your account, and hands you the private key once. We never store it.</p></div>
      <div class="feature"><h4>2. SSH reverse forward</h4><p>You SSH in with <code class="inline">-i ./airweb_key -R</code>. AirWeb reads the <code class="inline">Host</code> header on every request and pipes raw bytes back through your encrypted tunnel — WebSocket, streaming, keep-alive all just work.</p></div>
      <div class="feature"><h4>3. Credits while connected</h4><p>Every minute your tunnel is up, you earn ${config.credits.uptimePerMinute} credit. List your tunnel in the marketplace to earn ${config.credits.defaultLeasePricePerMinute}+ credits / min when someone leases it.</p></div>
      <div class="feature"><h4>4. Lease handles &amp; tunnels</h4><p>Spend credits to claim a permanent <code class="inline">&lt;handle&gt;.${publicDomain}</code> (only you can publish under it — perfect for home-machine remote access), or to rent someone else's tunnel by the minute.</p></div>
    </div>
  </section>

  <section class="card faq" id="faq">
    <h2>FAQ</h2>
    <details>
      <summary>Do I need to install anything?</summary>
      <p>No. Any standard <code class="inline">ssh</code> client works once you've downloaded <code class="inline">airweb_key</code>. There is an optional Node CLI in the repo (<code class="inline">client/airweb.js</code>) that wraps <code class="inline">ssh -R</code> with friendlier flags.</p>
    </details>
    <details>
      <summary>How do I sign in?</summary>
      <p>Open the <a href="/dashboard">dashboard</a> and click "Get your key" — it creates an account, derives your <code class="inline">0x…</code> address from your new SSH public key, and downloads <code class="inline">airweb_key</code>. To sign in from a different browser, go to <a href="/login">/login</a> and paste your private key. We never store private keys server-side.</p>
    </details>
    <details>
      <summary>What are credits for?</summary>
      <p>Credits buy two things: (1) a permanent <strong>handle</strong> — a reserved <code class="inline">&lt;handle&gt;.${publicDomain}</code> only you can publish under, which is great for accessing your home machine remotely; and (2) <strong>leases</strong> on other people's tunnels (think rented VPS endpoints). You earn credits passively for every minute your own tunnel stays online.</p>
    </details>
    <details>
      <summary>Is the traffic encrypted?</summary>
      <p>The leg between your machine and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks — plain HTTP if you hit port 8080, HTTPS if a TLS reverse proxy (Caddy, nginx) sits in front. For end-to-end TLS, terminate it inside your local app and use a raw TCP tunnel.</p>
    </details>
    <details>
      <summary>Can I pick my own subdomain?</summary>
      <p>Yes — the SSH username you connect with becomes your subdomain (e.g. <code class="inline">mysub@${host}</code> → <code class="inline">mysub.${publicDomain}</code>). If someone else already owns it on this server, pick another.</p>
    </details>
    <details>
      <summary>How do I stop a tunnel?</summary>
      <p>Press <code class="inline">Ctrl+C</code> in the SSH session, or just close the terminal. The tunnel disappears from the active list immediately.</p>
    </details>
  </section>

  <p style="text-align:center;color:var(--mute);font-size:.85rem;margin-top:2rem">
    ${tunnelCount} HTTP tunnel${tunnelCount === 1 ? '' : 's'} currently active on this host.
  </p>
</main>

<footer class="site">
  AirWeb · self‑hosted reverse SSH tunneling ·
  <a href="https://github.com" rel="noopener">source</a>
</footer>

<script>
  // One‑click copy for code blocks
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn'; btn.textContent = 'copy';
    btn.onclick = async () => {
      const text = pre.innerText.replace(/^\\s*#.*$/gm, '').trim();
      try { await navigator.clipboard.writeText(text); btn.textContent = 'copied!'; setTimeout(() => btn.textContent = 'copy', 1200); }
      catch { btn.textContent = 'failed'; }
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
function proxyToTunnel(socket, tunnel, headBuf) {
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
    handleConnection(socket, httpServer);
  });

  netServer.listen(config.http.port, config.http.host, () => {
    console.log(`[http] listening on ${config.http.host}:${config.http.port} (public: ${config.http.publicDomain})`);
  });

  return netServer;
}

module.exports = { start };
