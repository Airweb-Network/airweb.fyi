// Uptime ticker.
//
// Runs once per minute. For every account that currently has an active SSH
// tunnel registered, credit `config.credits.uptimePerMinute` and emit a ledger
// entry. Then advance all active leases.
const config = require('./config');
const accounts = require('./accounts');
const marketplace = require('./marketplace');
const registry = require('./registry');

const TICK_MS = 60 * 1000;
let timer = null;

function tick() {
  try {
    const perMin = config.credits.uptimePerMinute || 0;
    if (perMin > 0) {
      const seen = new Set();
      for (const t of registry.list()) {
        if (!t.ownerAddress) continue;
        if (seen.has(t.ownerAddress)) continue;
        seen.add(t.ownerAddress);
        try { accounts.credit(t.ownerAddress, perMin, 'uptime', null); }
        catch (e) { console.error('[credits] uptime credit failed:', e.message); }
      }
    }
    marketplace.tickLeases();
    accounts.cleanupExpiredSessions();
  } catch (err) {
    console.error('[credits] tick error:', err);
  }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
  console.log(`[credits] uptime ticker started (every ${TICK_MS / 1000}s)`);
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, tick };
