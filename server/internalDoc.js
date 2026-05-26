// Internal "doc" tunnel.
//
// Boots a tiny HTTP server on a local-only port (configurable) and registers
// it with the central registry as an HTTP tunnel under a fixed subdomain
// (default: `doc`). The tunnel is owned by the first bootstrap admin so it
// shows up in their "My connections" list.
//
// Because we register the tunnel directly (not through the SSH path), we
// bypass the reserved-subdomain and handle-ownership checks — intentional,
// since the operator controls config.

const http = require('http');
const net  = require('net');
const config   = require('./config');
const registry = require('./registry');
const accounts = require('./accounts');

const cfg       = config.internalDoc || {};
const ENABLED   = cfg.enabled !== false;
const PORT      = Number(cfg.port || 8090);
const HOST      = cfg.host || '127.0.0.1';
const SUBDOMAIN = cfg.subdomain || 'doc';
const TITLE     = cfg.title || 'AirWeb Docs';

let httpServer = null;
let registeredTunnel = null;
let pollTimer = null;

function pageHtml(req) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escapeHtml(TITLE)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         max-width: 760px; margin: 3rem auto; padding: 0 1.2rem; color:#1f2330; }
  h1 { font-size: 1.6rem; margin: 0 0 .6rem; }
  p  { color:#475063; }
  code { background:#f4f5f8; border:1px solid #e3e6ee; padding:1px 6px; border-radius:4px;
         font-family: ui-monospace,Menlo,monospace; font-size: .85rem; }
  .pill { display:inline-block; font-size:.7rem; font-weight:700; letter-spacing:1px;
          text-transform:uppercase; padding:3px 8px; border-radius:5px;
          background:#eef3ff; color:#3a5cff; border:1px solid #d5e0ff; }
</style>
</head><body>
  <span class="pill">internal · doc</span>
  <h1>${escapeHtml(TITLE)}</h1>
  <p>This page is served by the AirWeb built-in documentation server and
     proxied through the public HTTP router as an internal tunnel.</p>
  <p>Request: <code>${escapeHtml(req.method)} ${escapeHtml(req.url)}</code></p>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function startHttp() {
  httpServer = http.createServer((req, res) => {
    const body = pageHtml(req);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
  httpServer.on('error', (err) => {
    console.error(`[doc] http server error on ${HOST}:${PORT}:`, err.message);
  });
  httpServer.listen(PORT, HOST, () => {
    console.log(`[doc] internal doc server listening on ${HOST}:${PORT}`);
  });
}

function findAdminAddress() {
  try {
    const list = accounts.listAccounts ? accounts.listAccounts() : [];
    const admin = list.find(a => a.is_admin);
    return admin ? admin.address : null;
  } catch (e) {
    return null;
  }
}

function openChannel() {
  // Return a duplex stream connected to the local doc HTTP server. The
  // public router will pipe raw HTTP bytes through this socket.
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: HOST, port: PORT });
    sock.once('connect', () => resolve(sock));
    sock.once('error',   reject);
  });
}

function registerTunnel(adminAddress) {
  if (registeredTunnel) return;
  const scheme    = config.http.publicScheme || 'http';
  const publicUrl = `${scheme}://${SUBDOMAIN}.${config.http.publicDomain}`;

  registeredTunnel = registry.register({
    type: 'http',
    subdomain: SUBDOMAIN,
    username: SUBDOMAIN,
    ownerAddress: adminAddress,
    remoteAddr: `internal:${HOST}:${PORT}`,
    bindAddr: HOST,
    bindPort: 80,
    publicUrl,
    openChannel,
    disabled: false,
    close: () => {},
    disconnect: () => {},
  });
  console.log(`[doc] registered internal tunnel ${publicUrl} -> ${HOST}:${PORT} (owner ${adminAddress})`);
}

function pollAdmin() {
  const tryRegister = () => {
    if (registeredTunnel) return true;
    const addr = findAdminAddress();
    if (!addr) return false;
    registerTunnel(addr);
    return true;
  };
  if (tryRegister()) return;
  console.log('[doc] no admin yet — will register as soon as one exists');
  // Listen for the immediate notification from accounts.js (bootstrap promotion
  // or manual setAdmin). Falls back to a slow safety-net poll in case the
  // event is missed for any reason (e.g. external DB mutation).
  const onAdmin = (info) => {
    if (registeredTunnel) return;
    const addr = (info && info.address) || findAdminAddress();
    if (addr) registerTunnel(addr);
  };
  accounts.events.on('admin', onAdmin);
  pollTimer = setInterval(() => {
    if (tryRegister() && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      accounts.events.off('admin', onAdmin);
    }
  }, 60_000);
  if (pollTimer && pollTimer.unref) pollTimer.unref();
}

function start() {
  if (!ENABLED) { console.log('[doc] internal doc server disabled'); return; }
  startHttp();
  pollAdmin();
}

// Returns the public URL of the internal doc tunnel iff it has been
// successfully registered (i.e. there is an admin and the tunnel is live).
// Returns null otherwise so callers can hide the doc link.
function getPublicUrl() {
  if (!ENABLED) return null;
  if (registeredTunnel && registeredTunnel.publicUrl) {
    return withDevPort(registeredTunnel.publicUrl);
  }
  // Fall back to the configured URL — useful before an admin exists, so the
  // link still appears in the UI as long as internalDoc is enabled.
  if (!config.http || !config.http.publicDomain) return null;
  const scheme = config.http.publicScheme || 'http';
  return withDevPort(`${scheme}://${SUBDOMAIN}.${config.http.publicDomain}`);
}

// When the configured publicDomain omits a port but the server is bound to
// a non-standard http port (e.g. dev on 8080), append it so subdomain links
// actually reach the local server. No-op when the URL already has a port or
// when the http port is the scheme default (80/443).
function withDevPort(url) {
  try {
    const u = new URL(url);
    if (u.port) return url;
    const httpPort = Number(config.http && config.http.port);
    if (!httpPort) return url;
    const isDefault = (u.protocol === 'http:'  && httpPort === 80) ||
                      (u.protocol === 'https:' && httpPort === 443);
    if (isDefault) return url;
    u.port = String(httpPort);
    return u.toString().replace(/\/$/, '');
  } catch (e) {
    return url;
  }
}

module.exports = { start, getPublicUrl };
