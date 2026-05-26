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

// --- Environment-driven HTTP domain/scheme ---------------------------------
// Precedence (highest first):
//   1. AIRWEB_PUBLIC_DOMAIN / AIRWEB_PUBLIC_SCHEME (env or .env)
//   2. http.publicDomain / http.publicScheme in config.json
//   3. Local dev defaults: lvh.me:<port> + http
//      (lvh.me resolves *.lvh.me to 127.0.0.1, so subdomain tunnels work
//      without /etc/hosts edits). For production, set AIRWEB_PUBLIC_DOMAIN
//      and AIRWEB_PUBLIC_SCHEME in the server's environment.
config.http = config.http || {};

if (process.env.AIRWEB_PUBLIC_DOMAIN) {
  config.http.publicDomain = process.env.AIRWEB_PUBLIC_DOMAIN;
} else if (!config.http.publicDomain) {
  config.http.publicDomain = `lvh.me:${config.http.port || 8080}`;
}

if (process.env.AIRWEB_PUBLIC_SCHEME) {
  config.http.publicScheme = process.env.AIRWEB_PUBLIC_SCHEME;
} else if (!config.http.publicScheme) {
  config.http.publicScheme = 'http';
}

// Resolve paths relative to project root
if (config.ssh && config.ssh.hostKeyPath) {
  config.ssh.hostKeyPath = path.resolve(root, config.ssh.hostKeyPath);
}

module.exports = config;
