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
const auditor = require('./auditor');
const db = require('./db');
const internal = require('./internal');

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

// Build the set of origins that are allowed to call the apex API with
// credentials. Includes every enabled internal server's public URL (e.g.
// http://doc.lvh.me) so the shared header on those subdomains can fetch
// /api/me, /api/config and /api/logout and stay in sync with the user's
// session.
function allowedInternalOrigins() {
  const out = new Set();
  try {
    for (const item of internal.list() || []) {
      if (!item || !item.url) continue;
      try { out.add(new URL(item.url).origin); } catch (_) {}
    }
  } catch (_) {}
  return out;
}

function applyInternalCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!allowedInternalOrigins().has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  const reqHeaders = req.headers['access-control-request-headers'];
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', reqHeaders || 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
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
    remoteAddr: t.remoteAddr,
    remoteIp: (t.remoteAddr || '').split(':')[0] || null,
    createdAt: t.createdAt,
    disabled: !!t.disabled,
    internal: !!t.internal,
    metrics: t.metrics,
    listable: !t.internal && (t.type === 'tcp' || t.type === 'http'),
    activeListingId: marketplace.activeListingIdForTunnel(t.id),
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
    listings: marketplace.listingsOf(account.address).map(l => ({
      ...l,
      earnings: marketplace.listingEarnings(l.id),
      tunnelOnline: l.tunnel_id ? !!(registry.lookupId(l.tunnel_id) && !registry.lookupId(l.tunnel_id).disabled) : false,
    })),
    activeLeases: marketplace.activeLeasesOf(account.address).map(shapeLease),
    recentLedger: accounts.recentLedger(account.address, 25),
    earnings: earningsStats(account.address),
  };
}

// Live earnings stats for the "Reward / min" and "Charge / min" cards. We
// pull straight from the ledger so the numbers reflect what actually got
// booked to the account, not just config \u00d7 tunnel-count. Both rates are
// averages over the past 24h (sum \u00f7 1440 minutes).
//
// Reward sources : uptime credits, lease earnings (renting your tunnel).
// Charge sources : bandwidth debits, lease spends (renting someone else's).
const stmtEarnings24h = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN delta > 0 AND reason IN ('uptime', 'lease_earn')             THEN delta   END), 0) AS uptime24h,
    COALESCE(SUM(CASE WHEN delta < 0 AND reason IN ('bandwidth', 'lease_spend')         THEN -delta  END), 0) AS bandwidth24h,
    COUNT(CASE WHEN reason = 'uptime' AND delta > 0 THEN 1 END) AS uptimeTicks
  FROM ledger
  WHERE address = ? AND created_at >= ?
`);
function earningsStats(address) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const r = stmtEarnings24h.get(address, since) || {};
  const uptime24h    = r.uptime24h    || 0;
  const bandwidth24h = r.bandwidth24h || 0;
  // Average per-minute earned over the last 24h (1440 min).
  const avgPerMinute = uptime24h / 1440;
  const avgChargePerMinute = bandwidth24h / 1440;
  const avgNetPerMinute = avgPerMinute - avgChargePerMinute;
  return {
    uptime24h,
    bandwidth24h,
    net24h: uptime24h - bandwidth24h,
    avgPerMinute,
    avgChargePerMinute,
    avgNetPerMinute,
    uptimeTicks: r.uptimeTicks || 0,
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
      saveAs: `${config.http.publicDomain.split(':')[0].replace(/[^a-z0-9.-]+/gi, '_')}_${result.address}_key.txt`,
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
    const listing = await marketplace.createListing(s.account.address, body);
    return json(res, 200, listing);
  } catch (err) {
    if (err && err.status) return json(res, err.status, { error: err.message });
    if (err && err.code === 'AUTH_FAILED')   return json(res, 401, { error: 'sudo_auth_failed', detail: err.message });
    if (err && err.code === 'NO_SSH_BANNER') return json(res, 400, { error: 'no_ssh_banner', detail: err.message });
    if (err && err.code === 'NOT_TCP')       return json(res, 400, { error: 'listing_requires_tcp_ssh_tunnel' });
    if (err && err.code === 'TUNNEL_NOT_OWNED') return json(res, 403, { error: 'tunnel_not_owned' });
    if (err && err.code === 'INTERNAL_TUNNEL')  return json(res, 400, { error: 'internal_tunnel' });
    if (err && err.code === 'TUNNEL_REQUIRED')  return json(res, 400, { error: 'tunnel_required' });
    if (err && err.code === 'SUDO_REQUIRED')    return json(res, 400, { error: 'sudo_credentials_required' });
    if (err && err.code === 'INVALID_TITLE')    return json(res, 400, { error: 'invalid_title' });
    if (err && err.code) return json(res, 400, { error: err.code.toLowerCase() });
    console.error('[api] create listing failed:', err);
    return json(res, 500, { error: 'create_listing_failed' });
  }
}

function parseQuery(url) {
  const i = url.indexOf('?');
  if (i < 0) return {};
  const out = {};
  for (const part of url.slice(i + 1).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = decodeURIComponent(eq < 0 ? part : part.slice(0, eq));
    const v = eq < 0 ? '' : decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

function shapeListing(l) {
  const proto = String(l.protocol || 'tcp').toLowerCase();
  const tunnel = l.tunnel_id ? registry.lookupId(l.tunnel_id) : null;
  const tunnelOnline = !!(tunnel && !tunnel.disabled);
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    pricePerMinute: l.price_per_minute,
    owner: l.owner_address,
    createdAt: l.created_at,
    tunnelId: l.tunnel_id,
    cpuModel: l.cpu_model,
    cpuCores: l.cpu_cores,
    ramGb: l.ram_gb,
    diskGb: l.disk_gb,
    bandwidthMbps: l.bandwidth_mbps,
    os: l.os,
    countryCode: l.country_code,
    ipAddress: l.ip_address,
    sudoUser: l.sudo_user,
    validated: !!l.validated,
    validatedAt: l.validated_at,
    protocol: proto,
    subdomain: l.subdomain,
    leaseTermMinutes: l.lease_term_minutes || 60,
    ownerOnline: registry.list().some(t => t.ownerAddress === l.owner_address),
    tunnelOnline,
  };
}

function publicUrlForListing(listing) {
  const proto = String(listing.protocol || 'tcp').toLowerCase();
  if (proto !== 'http' && proto !== 'https') return null;
  if (!listing.subdomain) return null;
  const scheme = proto === 'https' ? 'https' : (config.http.publicScheme || 'http');
  return `${scheme}://${listing.subdomain}.${config.http.publicDomain}`;
}

function shapeLease(le) {
  const listing = marketplace.getListing(le.listing_id);
  const baseUrl = listing ? publicUrlForListing(listing) : null;
  const accessUrl = baseUrl && le.passcode
    ? `${baseUrl}/?aw_pass=${encodeURIComponent(le.passcode)}`
    : null;
  return {
    id: le.id,
    listingId: le.listing_id,
    renterAddress: le.renter_address,
    startedAt: le.started_at,
    endedAt: le.ended_at,
    minutesBilled: le.minutes_billed,
    totalCredits: le.total_credits,
    passcode: le.passcode || null,
    expiresAt: le.expires_at || null,
    termMinutes: le.term_minutes || null,
    publicUrl: baseUrl,
    accessUrl,
    protocol: listing ? (listing.protocol || 'tcp') : null,
    // keep legacy fields populated for the UI
    title: le.title || (listing && listing.title) || null,
    price_per_minute: le.price_per_minute || (listing && listing.price_per_minute) || null,
    owner_address: le.owner_address || (listing && listing.owner_address) || null,
    total_credits: le.total_credits,
  };
}

function getListings(req, res) {
  const q = parseQuery(req.url);
  const items = marketplace.browseListingsFiltered({
    country:  q.country  || undefined,
    minCores: q.minCores || undefined,
    minRam:   q.minRam   || undefined,
    maxPrice: q.maxPrice || undefined,
    os:       q.os       || undefined,
    protocol: q.protocol || undefined,
    q:        q.q        || undefined,
  }, 200).map(shapeListing);
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
    return json(res, 200, shapeLease(lease));
  } catch (err) {
    if (err && err.code) return json(res, 400, { error: err.code.toLowerCase() });
    console.error('[api] lease failed:', err);
    return json(res, 500, { error: 'lease_failed' });
  }
}

async function postLeaseEnd(req, res, id) {
  const s = requireAuth(req, res); if (!s) return;
  const lease = marketplace.endLease(s.account.address, id);
  return json(res, 200, lease ? shapeLease(lease) : { ok: true });
}

function getConfig(req, res) {
  return json(res, 200, {
    publicDomain: config.http.publicDomain,
    publicScheme: config.http.publicScheme || 'http',
    sshHost: config.http.publicDomain.split(':')[0],
    sshPort: config.ssh.port,
    signupBonus: config.credits.signupBonus,
    uptimePerMinute: config.credits.uptimePerMinute,
    bandwidthChargePerMb: config.credits.bandwidthChargePerMb || 0,
    handleBaseCost: config.credits.handleBaseCost,
    defaultLeasePricePerMinute: config.credits.defaultLeasePricePerMinute,
    usdPerCredit: config.credits.usdPerCredit || 0.01,
    reservedSubdomains: config.limits.reservedSubdomains || [],
    allowCustomSubdomains: config.limits.allowCustomSubdomains !== false,
    internalServers: internal.list(),
    docUrl: internal.getPublicUrl('doc'), // legacy alias
  });
}

function getLedger(req, res) {
  const s = requireAuth(req, res); if (!s) return;
  const q = parseQuery(req.url);
  const result = accounts.queryLedger(s.account.address, {
    reason: q.reason || undefined,
    q:      q.q      || undefined,
    sign:   q.sign   || undefined,
    since:  q.since  || undefined,
    until:  q.until  || undefined,
    offset: q.offset || 0,
    limit:  q.limit  || 20,
  });
  return json(res, 200, result);
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

function getAdminAudit(req, res) {
  const s = requireAdmin(req, res); if (!s) return;
  return json(res, 200, auditor.auditAll());
}

function postAdminDisconnect(req, res, id) {
  const s = requireAdmin(req, res); if (!s) return;
  const t = registry.lookupId(id);
  if (!t) return json(res, 404, { error: 'not_found' });
  if (t.internal) return json(res, 400, { error: 'internal_tunnel' });
  try { t.disconnect && t.disconnect(); } catch {}
  return json(res, 200, { ok: true });
}

// Owner or admin: pause/resume public traffic to a tunnel without dropping
// the SSH connection. While disabled:
//   * HTTP tunnels return a 503 "paused" page (see httpRouter.serveDisabled).
//   * TCP tunnels keep the listener up but refuse incoming connections.
function postTunnelToggle(req, res, id, disable) {
  const s = requireAuth(req, res); if (!s) return;
  const t = registry.lookupId(id);
  if (!t) return json(res, 404, { error: 'not_found' });
  if (t.internal) return json(res, 400, { error: 'internal_tunnel' });
  const isOwner = t.ownerAddress && t.ownerAddress === s.account.address;
  const isAdmin = accounts.isAdmin(s.account);
  if (!isOwner && !isAdmin) return json(res, 403, { error: 'forbidden' });
  const updated = registry.setDisabled(id, disable);
  return json(res, 200, { ok: true, id, disabled: !!(updated && updated.disabled) });
}

// Owner or admin: fully disconnect the underlying SSH session, which also
// removes the tunnel from the registry.
function postTunnelDisconnect(req, res, id) {
  const s = requireAuth(req, res); if (!s) return;
  const t = registry.lookupId(id);
  if (!t) return json(res, 404, { error: 'not_found' });
  if (t.internal) return json(res, 400, { error: 'internal_tunnel' });
  const isOwner = t.ownerAddress && t.ownerAddress === s.account.address;
  const isAdmin = accounts.isAdmin(s.account);
  if (!isOwner && !isAdmin) return json(res, 403, { error: 'forbidden' });
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

  // CORS for internal-server subdomains (e.g. doc.<publicDomain>) so the
  // shared header injected on those pages can call /api/me, /api/config
  // and /api/logout with the session cookie.
  applyInternalCors(req, res);
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API
  if (url === '/api/register' && method === 'POST')          return postRegister(req, res);
  if (url === '/api/login'    && method === 'POST')          return postLogin(req, res);
  if (url === '/api/logout'   && method === 'POST')          return postLogout(req, res);
  if (url === '/api/me'       && method === 'GET')           return getMe(req, res);
  if (url === '/api/config'   && method === 'GET')           return getConfig(req, res);
  if (url === '/api/ledger'   && method === 'GET')           return getLedger(req, res);
  if (url === '/api/handles'  && method === 'POST')          return postHandles(req, res);
  if (url.startsWith('/api/listings') && method === 'GET')   return getListings(req, res);
  if (url === '/api/listings' && method === 'POST')          return postListings(req, res);

  let m;
  if ((m = url.match(/^\/api\/listings\/(\d+)$/)) && method === 'DELETE')
    return postListingDelete(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/listings\/(\d+)\/lease$/)) && method === 'POST')
    return postLease(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/leases\/(\d+)\/end$/)) && method === 'POST')
    return postLeaseEnd(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/tunnels\/(\d+)\/(enable|disable)$/)) && method === 'POST')
    return postTunnelToggle(req, res, Number(m[1]), m[2] === 'disable');
  if ((m = url.match(/^\/api\/tunnels\/(\d+)\/disconnect$/)) && method === 'POST')
    return postTunnelDisconnect(req, res, Number(m[1]));

  // Admin
  if (url === '/api/admin/overview' && method === 'GET') return getAdminOverview(req, res);
  if (url === '/api/admin/tunnels'  && method === 'GET') return getAdminTunnels(req, res);
  if (url === '/api/admin/audit'    && method === 'GET') return getAdminAudit(req, res);
  if (url === '/api/admin/events'   && method === 'GET') return adminEventsSSE(req, res);
  if ((m = url.match(/^\/api\/admin\/tunnels\/(\d+)\/disconnect$/)) && method === 'POST')
    return postAdminDisconnect(req, res, Number(m[1]));
  if ((m = url.match(/^\/api\/admin\/accounts\/(aw_[a-z0-9]+)\/role$/i)) && method === 'POST')
    return postAdminSetRole(req, res, m[1].toLowerCase());

  // Static pages
  if ((url === '/dashboard' || url === '/dashboard/') && method === 'GET')
    return serveStatic(res, 'dashboard.html');
  if ((url === '/marketplace' || url === '/marketplace/') && method === 'GET')
    return serveStatic(res, 'marketplace.html');
  if ((url === '/connections' || url === '/connections/') && method === 'GET')
    return serveStatic(res, 'connections.html');
  if ((url === '/login' || url === '/login/') && method === 'GET')
    return serveStatic(res, 'login.html');
  if (url === '/i18n.js' && method === 'GET')
    return serveStatic(res, 'i18n.js');
  if (url === '/currency.js' && method === 'GET')
    return serveStatic(res, 'currency.js');
  if (url === '/header.js' && method === 'GET')
    return serveStatic(res, 'header.js');
  if (url === '/header.css' && method === 'GET')
    return serveStatic(res, 'header.css');
  if (url === '/app.css' && method === 'GET')
    return serveStatic(res, 'app.css');
  if (url === '/app.js' && method === 'GET')
    return serveStatic(res, 'app.js');
  if (url.startsWith('/assets/') && method === 'GET')
    return serveStatic(res, url.replace(/^\/+/, ''));

  return null; // signal: caller should handle (landing page / 404)
}

module.exports = { handle };
