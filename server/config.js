// Loads config.default.json overlaid with optional config.json, then applies
// overrides from a .env file (if present) and process.env.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'config.default.json'), 'utf8'));

let user = {};
const userPath = path.join(root, 'config.json');
if (fs.existsSync(userPath)) {
  try { user = JSON.parse(fs.readFileSync(userPath, 'utf8')); }
  catch (e) { console.error('Failed to parse config.json:', e.message); process.exit(1); }
}

function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (b && typeof b === 'object') {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a ? a[k] : undefined, b[k]);
    return out;
  }
  return b === undefined ? a : b;
}

// --- Minimal .env loader (no dependency) -----------------------------------
// Lines of the form KEY=VALUE; '#' starts a comment; surrounding quotes are
// stripped. Values already present in process.env are not overwritten, so the
// shell environment always wins over the file.
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv(path.join(root, '.env'));

const config = deepMerge(defaults, user);

// --- Environment-driven HTTP base URL ------------------------------------
// Precedence (highest first):
//   1. AIRWEB_PUBLIC_DOMAIN (env or .env) — a full base URL with scheme,
//      e.g. "http://lvh.me" (dev) or "https://airweb.fyi" (prod). This is
//      the canonical base for all generated links (subdomains map to
//      tunnels at "<scheme>://<sub>.<host>").
//   2. http.publicDomain / http.publicScheme in config.json
//   3. Local dev default: http://lvh.me
//      (lvh.me resolves *.lvh.me to 127.0.0.1, so subdomain tunnels work
//      without /etc/hosts edits).
//
// For backwards compatibility, a bare host (no scheme) is still accepted;
// in that case the scheme is auto-derived (http for local hostnames,
// https otherwise).
config.http = config.http || {};

function parsePublicBase(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(https?):\/\/([^/]+)\/?$/i);
  if (m) return { scheme: m[1].toLowerCase(), host: m[2] };
  return { scheme: null, host: s.replace(/\/+$/, '') };
}

function defaultScheme(host) {
  const h = String(host).split(':')[0].toLowerCase();
  const isLocal = h === 'lvh.me' || h.endsWith('.lvh.me')
    || h === 'localhost' || h.endsWith('.localhost')
    || h === '127.0.0.1' || h === '::1';
  return isLocal ? 'http' : 'https';
}

if (process.env.AIRWEB_PUBLIC_DOMAIN) {
  const { scheme, host } = parsePublicBase(process.env.AIRWEB_PUBLIC_DOMAIN);
  config.http.publicDomain = host;
  if (scheme) config.http.publicScheme = scheme;
} else if (!config.http.publicDomain) {
  config.http.publicDomain = 'lvh.me';
}

if (!config.http.publicScheme) {
  config.http.publicScheme = defaultScheme(config.http.publicDomain);
}

// In dev the Node server listens on a non-default port (e.g. 8080) while the
// env var stays clean ("http://lvh.me"). Append the port to publicDomain so
// every generated link — including subdomain tunnels — points at the right
// place (e.g. http://mysub.lvh.me:8080). In production the public URL hits a
// reverse proxy on 80/443 and we leave the host bare.
if (!/:\d+$/.test(config.http.publicDomain)) {
  const port = Number(config.http.port);
  const isDefault = (config.http.publicScheme === 'http'  && port === 80) ||
                    (config.http.publicScheme === 'https' && port === 443);
  if (port && !isDefault && defaultScheme(config.http.publicDomain) === 'http') {
    config.http.publicDomain = `${config.http.publicDomain}:${port}`;
  }
}

// Canonical base URL for link generation (e.g. "https://airweb.fyi").
config.http.publicBaseUrl = `${config.http.publicScheme}://${config.http.publicDomain}`;

// Resolve paths relative to project root
if (config.ssh && config.ssh.hostKeyPath) {
  config.ssh.hostKeyPath = path.resolve(root, config.ssh.hostKeyPath);
}

module.exports = config;
