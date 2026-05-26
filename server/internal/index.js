// Aggregator for all internal servers. Add new entries here as they're built.
const doc   = require('./doc');
const forum = require('./forum');

const all = [doc, forum];

function start() {
  for (const s of all) s.start();
}

// Returns metadata for every enabled internal server with a resolvable
// public URL. The shape is suitable for direct exposure via /api/config.
function list() {
  return all.map(s => s.info()).filter(Boolean);
}

// Convenience lookup by key (e.g. 'doc'). Returns the public URL or null.
function getPublicUrl(key) {
  const s = all.find(x => x.key === key);
  return s ? s.getPublicUrl() : null;
}

module.exports = { start, list, getPublicUrl };
