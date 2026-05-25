// Loads config.default.json overlaid with optional config.json
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

const config = deepMerge(defaults, user);

// Resolve paths relative to project root
if (config.ssh && config.ssh.hostKeyPath) {
  config.ssh.hostKeyPath = path.resolve(root, config.ssh.hostKeyPath);
}

module.exports = config;
