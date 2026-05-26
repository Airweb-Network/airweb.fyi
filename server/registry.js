// Central registry of active tunnels + an event bus so the admin UI can stream updates.
const { EventEmitter } = require('events');
const config = require('./config');

const tunnels = new Map();           // id -> tunnel
const bySubdomain = new Map();       // subdomain -> tunnel
const events = new EventEmitter();
events.setMaxListeners(0);

let counter = 0;

function isReservedSubdomain(sub) {
  if (!sub) return false;
  const list = config.limits && config.limits.reservedSubdomains;
  if (!Array.isArray(list)) return false;
  const s = String(sub).toLowerCase();
  return list.some(r => String(r).toLowerCase() === s);
}

function rand(len = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function uniqueSubdomain(preferred) {
  if (preferred && !bySubdomain.has(preferred)) return preferred;
  let s;
  do { s = rand(8); } while (bySubdomain.has(s));
  return s;
}

function register(tunnel) {
  tunnel.id = ++counter;
  tunnel.createdAt = Date.now();
  tunnel.disabled = !!tunnel.disabled;
  // Tunnels bound to a reserved subdomain (docs, forum, www, ...) are
  // considered internal: never pausable, never listable, never charged.
  tunnel.internal = isReservedSubdomain(tunnel.subdomain);
  tunnel.metrics = tunnel.metrics || {
    connections: 0,
    activeConnections: 0,
    bytesIn: 0,    // bytes from public  -> client
    bytesOut: 0,   // bytes from client  -> public
    chargedBytes: 0,    // total bytes already accounted for in chargedCredits
    chargedCredits: 0,  // cumulative bandwidth credits charged (float)
    lastActivityAt: Date.now(),
  };
  // Wrap openChannel to instrument bytes + connection counts.
  if (typeof tunnel.openChannel === 'function' && !tunnel._wrapped) {
    const original = tunnel.openChannel.bind(tunnel);
    tunnel.openChannel = async (srcIp, srcPort) => {
      const ch = await original(srcIp, srcPort);
      tunnel.metrics.connections += 1;
      tunnel.metrics.activeConnections += 1;
      tunnel.metrics.lastActivityAt = Date.now();
      events.emit('update', summarize(tunnel));

      const origWrite = ch.write.bind(ch);
      ch.write = (chunk, ...rest) => {
        if (chunk) tunnel.metrics.bytesIn += Buffer.byteLength(chunk);
        tunnel.metrics.lastActivityAt = Date.now();
        return origWrite(chunk, ...rest);
      };
      ch.on('data', (d) => {
        tunnel.metrics.bytesOut += d.length;
        tunnel.metrics.lastActivityAt = Date.now();
      });
      const done = () => {
        tunnel.metrics.activeConnections = Math.max(0, tunnel.metrics.activeConnections - 1);
        events.emit('update', summarize(tunnel));
      };
      ch.once('close', done);
      ch.once('error', done);
      return ch;
    };
    tunnel._wrapped = true;
  }

  tunnels.set(tunnel.id, tunnel);
  if (tunnel.subdomain) bySubdomain.set(tunnel.subdomain, tunnel);
  events.emit('add', summarize(tunnel));
  return tunnel;
}

function unregister(tunnel) {
  if (!tunnel) return;
  tunnels.delete(tunnel.id);
  if (tunnel.subdomain) bySubdomain.delete(tunnel.subdomain);
  events.emit('remove', { id: tunnel.id });
}

function lookupSubdomain(sub) { return bySubdomain.get(sub); }
function lookupId(id) { return tunnels.get(Number(id)); }
function list() { return Array.from(tunnels.values()); }

function summarize(t) {
  return {
    id: t.id,
    type: t.type,
    subdomain: t.subdomain || null,
    username: t.username,
    ownerAddress: t.ownerAddress || null,
    remoteAddr: t.remoteAddr,
    publicUrl: t.publicUrl,
    bindAddr: t.bindAddr || null,
    bindPort: t.bindPort,
    createdAt: t.createdAt,
    disabled: !!t.disabled,
    disabledReason: t.disabledReason || null,
    internal: !!t.internal,
    metrics: { ...t.metrics },
  };
}

function listSummaries() { return list().map(summarize); }

// Toggle public access for a tunnel. The owner's SSH connection stays up;
// only the public-facing accept path checks this flag, so the tunnel can be
// turned back on without the client reconnecting.
function setDisabled(id, disabled) {
  const t = tunnels.get(Number(id));
  if (!t) return null;
  // Internal tunnels (docs, forum, ...) are managed by the server itself and
  // must never be paused or auto-paused for any reason.
  if (t.internal) return t;
  t.disabled = !!disabled;
  if (!t.disabled) t.disabledReason = null;
  events.emit('update', summarize(t));
  return t;
}

module.exports = {
  register, unregister, lookupSubdomain, lookupId, list,
  listSummaries, summarize, uniqueSubdomain, setDisabled, events,
};
