// Shared factory for "internal" servers — small HTTP services we ship inside
// the AirWeb process (docs, forum, etc.) and expose to the outside world via
// the public HTTP router as fixed-subdomain tunnels.
//
// Each internal server lives in its own folder under server/internal/ and
// calls `createInternalServer({...})` from this module. The factory handles
// the boilerplate of:
//   • binding a local-only HTTP listener,
//   • registering a tunnel with the central registry under a reserved
//     subdomain (owned by the bootstrap admin, set asynchronously),
//   • computing a public URL that includes the dev port when needed,
//   • exposing a consistent { start, info } interface to the aggregator.

const http = require('http');
const net  = require('net');
const config   = require('../config');
const registry = require('../registry');
const accounts = require('../accounts');

function createInternalServer(opts) {
  const key             = opts.key;                        // 'doc' | 'forum' | ...
  const label           = opts.label || key;               // header nav label
  const cfg             = (config[opts.configKey || ('internal' + cap(key))]) || {};
  const ENABLED         = cfg.enabled !== false;
  const PORT            = Number(cfg.port || opts.defaultPort);
  const HOST            = cfg.host || '127.0.0.1';
  const SUBDOMAIN       = cfg.subdomain || opts.defaultSubdomain || key;
  const TITLE           = cfg.title || opts.defaultTitle || key;
  const handler         = opts.handler;                    // (req, res, ctx) => void

  let httpServer = null;
  let registeredTunnel = null;
  let pollTimer = null;

  function startHttp() {
    httpServer = http.createServer((req, res) => {
      try { handler(req, res, { title: TITLE, key, subdomain: SUBDOMAIN }); }
      catch (e) {
        console.error(`[${key}] handler error:`, e);
        res.statusCode = 500;
        res.end('internal error');
      }
    });
    httpServer.on('error', (err) => {
      console.error(`[${key}] http server error on ${HOST}:${PORT}:`, err.message);
    });
    httpServer.listen(PORT, HOST, () => {
      console.log(`[${key}] internal server listening on ${HOST}:${PORT}`);
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
    console.log(`[${key}] registered internal tunnel ${publicUrl} -> ${HOST}:${PORT} (owner ${adminAddress})`);
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
    console.log(`[${key}] no admin yet — will register as soon as one exists`);
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
    if (!ENABLED) { console.log(`[${key}] internal server disabled`); return; }
    startHttp();
    pollAdmin();
  }

  // Computed public URL (registered or configured). Falls back to building one
  // from publicDomain so links appear even before an admin exists. Appends
  // the local http port when publicDomain omits it (dev convenience).
  function getPublicUrl() {
    if (!ENABLED) return null;
    if (registeredTunnel && registeredTunnel.publicUrl) {
      return withDevPort(registeredTunnel.publicUrl);
    }
    if (!config.http || !config.http.publicDomain) return null;
    const scheme = config.http.publicScheme || 'http';
    return withDevPort(`${scheme}://${SUBDOMAIN}.${config.http.publicDomain}`);
  }

  function info() {
    const url = getPublicUrl();
    if (!url) return null;
    return { key, label, title: TITLE, subdomain: SUBDOMAIN, url };
  }

  return { start, info, getPublicUrl, isEnabled: () => ENABLED, key };
}

function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

function withDevPort(url) {
  try {
    const u = new URL(url);
    if (u.port) return url;
    // Only append a port in dev mode, which we detect by the public domain
    // itself carrying an explicit port (e.g. lvh.me:8080 or :3000). In production the
    // public domain has no port and the reverse proxy / default 80|443 takes
    // over — we must not leak the internal Node port (e.g. 8080) into links.
    const publicDomain = (config.http && config.http.publicDomain) || '';
    if (!/:\d+$/.test(publicDomain)) return url;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

module.exports = { createInternalServer, escapeHtml };
