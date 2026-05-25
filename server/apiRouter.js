// REST API for browser clients + static dashboard serving.
//
// Mounted by httpRouter at apex (no subdomain). All routes start with `/api/`
// except `/dashboard` and `/login` which are served HTML pages.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const accounts = require('./accounts');
const marketplace = require('./marketplace');
const registry = require('./registry');

const PUBLIC_DIR = path.join(__dirname, 'public');
const COOKIE_NAME = (config.sessions && config.sessions.cookieName) || 'airweb_sid';
const COOKIE_MAX_AGE = (config.sessions && config.sessions.ttlDays || 30) * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

function parseCookies(req) {
  const h = req.headers.cookie;
  if (!h) return {};
  const out = {};
  for (const part of h.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function setSessionCookie(req, res, token) {
  const fwd = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const isHttps = fwd === 'https' || !!(req.socket && req.socket.encrypted);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        return reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { const e = new Error('invalid_json'); e.status = 400; throw e; }
}

function getSession(req) {
  const c = parseCookies(req);
  const tok = c[COOKIE_NAME];
  if (!tok) return null;
  return accounts.resolveSession(tok);
}

function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) { json(res, 401, { error: 'unauthorized' }); return null; }
  return s;
}

function requireAdmin(req, res) {
  const s = requireAuth(req, res);
  if (!s) return null;
  if (!accounts.isAdmin(s.account)) { json(res, 403, { error: 'forbidden' }); return null; }
  return s;
}

function tunnelsOf(address) {
  return registry.list().filter(t => t.ownerAddress === address).map(t => ({
    id: t.id,
    type: t.type,
    subdomain: t.subdomain,
    publicUrl: t.publicUrl,
    bindPort: t.bindPort,
    createdAt: t.createdAt,
    metrics: t.metrics,
  }));
}

function accountSummary(account) {
  return {
    address: account.address,
    fingerprint: account.fingerprint,
    algo: account.algo,
    credits: account.credits,
    isAdmin: !!account.is_admin,
    createdAt: account.created_at,
    lastSeenAt: account.last_seen_at,
    onlineTunnels: tunnelsOf(account.address),
    handles: marketplace.handlesOf(account.address),
    listings: marketplace.listingsOf(account.address),
    activeLeases: marketplace.activeLeasesOf(account.address),
    recentLedger: accounts.recentLedger(account.address, 25),
  };
}

// ---------------------------------------------------------------------------
// Static file helpers
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function serveStatic(res, relPath) {
  const safe = path.normalize(relPath).replace(/^([/\\]+)/, '');
  const full = path.join(PUBLIC_DIR, safe);
  if (!full.startsWith(PUBLIC_DIR)) { res.statusCode = 403; return res.end('forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.statusCode = 404; res.end('not found'); return; }
    const ext = path.extname(full).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function postRegister(req, res) {
  try {
    const result = accounts.register();
    setSessionCookie(req, res, result.sessionToken);
    json(res, 200, {
      address: result.address,
      algo: result.algo,
      fingerprint: result.fingerprint,
      privateKey: result.privateKey,   // ONE-TIME — caller must save this
      publicKey: result.publicKey,
      credits: result.credits,
      sshHost: config.http.publicDomain.split(':')[0],
      sshPort: config.ssh.port,
      saveAs: 'airweb_key',
      sessionExpiresAt: result.sessionExpiresAt,
    });
  } catch (err) {
    console.error('[api] register failed:', err);
    json(res, 500, { error: 'registration_failed' });
  }
}

async function postLogin(req, res) {
  try {
    const body = await readJson(req);
    const pk = body && body.privateKey;
    if (typeof pk !== 'string' || pk.length < 50) {
      return json(res, 400, { error: 'invalid_private_key' });
    }
    const { account, session } = accounts.loginWithPrivateKey(pk, body.passphrase || '');
    setSessionCookie(req, res, session.token);
    return json(res, 200, { address: account.address, credits: account.credits });
  } catch (err) {
    if (err && err.message === 'invalid_private_key') return json(res, 400, { error: 'invalid_private_key' });
    if (err && err.message === 'account_not_found') return json(res, 404, { error: 'account_not_found', address: err.address });
    if (err && err.status) return json(res, err.status, { error: err.message });
    console.error('[api] login failed:', err);
    return json(res, 500, { error: 'login_failed' });
  }
}

function postLogout(req, res) {
  const c = parseCookies(req);
  accounts.destroySession(c[COOKIE_NAME]);
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}

function getMe(req, res) {
  const s = requireAuth(req, res); if (!s) return;
  return json(res, 200, accountSummary(s.account));
}

async function postHandles(req, res) {
  const s = requireAuth(req, res); if (!s) return;
  try {
    const { handle } = await readJson(req);
    const result = marketplace.purchaseHandle(s.account.address, handle);
    return json(res, 200, result);
  } catch (err) {
    if (err && err.status) return json(res, err.status, { error: err.message });
    if (err && err.code) return json(res, 400, { error: err.code.toLowerCase() });
    if (err && err.message === 'insufficient_credits') return json(res, 402, { error: 'insufficient_credits' });
    console.error('[api] handle purchase failed:', err);
    return json(res, 500, { error: 'handle_purchase_failed' });
  }
}

async function postListings(req, res) {
  const s = requireAuth(req, res); if (!s) return;
  try {
    const body = await readJson(req);
    const listing = marketplace.createListing(s.account.address, body);
    return json(res, 200, listing);
  } catch (err) {
    if (err && err.status) return json(res, err.status, { error: err.message });
    if (err && err.code) return json(res, 400, { error: err.code.toLowerCase() });
    console.error('[api] create listing failed:', err);
    return json(res, 500, { error: 'create_listing_failed' });
  }
}

function getListings(req, res) {
  const items = marketplace.browseListings(100).map(l => ({
    id: l.id,
    title: l.title,
    description: l.description,
    pricePerMinute: l.price_per_minute,
    owner: l.owner_address,
    createdAt: l.created_at,
    ownerOnline: registry.list().some(t => t.ownerAddress === l.owner_address),
  }));
  return json(res, 200, { items });
}

async function postListingDelete(req, res, id) {
  const s = requireAuth(req, res); if (!s) return;
  marketplace.removeListing(s.account.address, id);
  return json(res, 200, { ok: true });
}

async function postLease(req, res, id) {
  const s = requireAuth(req, res); if (!s) return;
  try {
    const lease = marketplace.startLease(s.account.address, id);
    return json(res, 200, lease);
  } catch (err) {
    if (err && err.code) return json(res, 400, { error: err.code.toLowerCase() });
    console.error('[api] lease failed:', err);
    return json(res, 500, { error: 'lease_failed' });
  }
}

async function postLeaseEnd(req, res, id) {
  const s = requireAuth(req, res); if (!s) return;
  const lease = marketplace.endLease(s.account.address, id);
  return json(res, 200, lease || { ok: true });
}

function getConfig(req, res) {
  return json(res, 200, {
    publicDomain: config.http.publicDomain,
    publicScheme: config.http.publicScheme || 'http',
    sshPort: config.ssh.port,
    signupBonus: config.credits.signupBonus,
    uptimePerMinute: config.credits.uptimePerMinute,
    handleBaseCost: config.credits.handleBaseCost,
    defaultLeasePricePerMinute: config.credits.defaultLeasePricePerMinute,
    usdPerCredit: 0.01,
    reservedSubdomains: config.limits.reservedSubdomains || [],
  });
}

// ---------------------------------------------------------------------------
// Admin endpoints (require account.is_admin = 1)
// ---------------------------------------------------------------------------
function serverInfo() {
  return {
    sshHost: config.ssh.host,
    sshPort: config.ssh.port,
    httpHost: config.http.host,
    httpPort: config.http.port,
    publicDomain: config.http.publicDomain,
    publicScheme: config.http.publicScheme || 'http',
    serverTime: Date.now(),
  };
}

function getAdminOverview(req, res) {
  const s = requireAdmin(req, res); if (!s) return;
  return json(res, 200, {
    server: serverInfo(),
    tunnels: registry.listSummaries(),
    accounts: accounts.listAccounts(),
    listings: marketplace.browseListings(500),
  });
}

function getAdminTunnels(req, res) {
  const s = requireAdmin(req, res); if (!s) return;
  return json(res, 200, { tunnels: registry.listSummaries(), serverTime: Date.now() });
}

function postAdminDisconnect(req, res, id) {
  const s = requireAdmin(req, res); if (!s) return;
  const t = registry.lookupId(id);
  if (!t) return json(res, 404, { error: 'not_found' });
  try { t.disconnect && t.disconnect(); } catch {}
  return json(res, 200, { ok: true });
}

async function postAdminSetRole(req, res, address) {
  const s = requireAdmin(req, res); if (!s) return;
  try {
    const body = await readJson(req);
    const isAdmin = !!body.isAdmin;
    const target = accounts.getAccount(address);
    if (!target) return json(res, 404, { error: 'account_not_found' });
    // Safety: don't allow demoting the last remaining admin.
    if (!isAdmin && target.is_admin) {
      const others = accounts.listAccounts().filter(a => a.is_admin && a.address !== address);
      if (others.length === 0) return json(res, 400, { error: 'last_admin' });
    }
    accounts.setAdmin(address, isAdmin);
    return json(res, 200, { ok: true, address, isAdmin });
  } catch (err) {
    if (err && err.status) return json(res, err.status, { error: err.message });
    console.error('[api] set role failed:', err);
    return json(res, 500, { error: 'set_role_failed' });
  }
}

function adminEventsSSE(req, res) {
  const s = requireAdmin(req, res); if (!s) return;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (kind, data) => {
    try { res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };
  send('snapshot', { tunnels: registry.listSummaries(), server: serverInfo() });
  const onAdd    = (t) => send('add', t);
  const onUpd    = (t) => send('update', t);
  const onRemove = (t) => send('remove', { id: t.id });
  registry.events.on('add', onAdd);
  registry.events.on('update', onUpd);
  registry.events.on('remove', onRemove);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    registry.events.off('add', onAdd);
    registry.events.off('update', onUpd);
    registry.events.off('remove', onRemove);
    try { res.end(); } catch {}
  });
}

// ---------------------------------------------------------------------------
// Router entry
// ---------------------------------------------------------------------------
async function handle(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // API
  if (url === '/api/register' && method === 'POST')          return postRegister(req, res);
  if (url === '/api/login'    && method === 'POST')          return postLogin(req, res);
  if (url === '/api/logout'   && method === 'POST')          return postLogout(req, res);
  if (url === '/api/me'       && method === 'GET')           return getMe(req, res);
  if (url === '/api/config'   && method === 'GET')           return getConfig(req, res);
  if (url === '/api/handles'  && method === 'POST')          return postHandles(req, res);
  if (url === '/api/listings' && method === 'GET')           return getListings(req, res);
  if (url === '/api/listings' && method === 'POST')          return postListings(req, res);

  let m;
  if ((m = url.match(/^\/api\/listings\/(\d+)$/)) && method === 'DELETE')
    return postListingDelete(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/listings\/(\d+)\/lease$/)) && method === 'POST')
    return postLease(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/leases\/(\d+)\/end$/)) && method === 'POST')
    return postLeaseEnd(req, res, Number(m[1]));

  // Admin
  if (url === '/api/admin/overview' && method === 'GET') return getAdminOverview(req, res);
  if (url === '/api/admin/tunnels'  && method === 'GET') return getAdminTunnels(req, res);
  if (url === '/api/admin/events'   && method === 'GET') return adminEventsSSE(req, res);
  if ((m = url.match(/^\/api\/admin\/tunnels\/(\d+)\/disconnect$/)) && method === 'POST')
    return postAdminDisconnect(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/admin\/accounts\/(0x[0-9a-f]+)\/role$/i)) && method === 'POST')
    return postAdminSetRole(req, res, m[1].toLowerCase());

  // Static pages
  if ((url === '/dashboard' || url === '/dashboard/') && method === 'GET')
    return serveStatic(res, 'dashboard.html');
  if ((url === '/login' || url === '/login/') && method === 'GET')
    return serveStatic(res, 'login.html');
  if (url.startsWith('/assets/') && method === 'GET')
    return serveStatic(res, url.replace(/^\/+/, ''));

  return null; // signal: caller should handle (landing page / 404)
}

module.exports = { handle };
