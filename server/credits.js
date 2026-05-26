// Uptime ticker.
//
// Runs once per minute. For every account that currently has an active SSH
// tunnel registered, credit `config.credits.uptimePerMinute` and emit a ledger
// entry. Then advance all active leases.
const config = require('./config');
const accounts = require('./accounts');
const marketplace = require('./marketplace');
const registry = require('./registry');
const auditor = require('./auditor');
const db = require('./db');

const TICK_MS = 60 * 1000;
const BYTES_PER_MB = 1024 * 1024;
let timer = null;

// Per-owner fractional remainder of bandwidth credits owed. The credits
// ledger only stores integer amounts, so we accumulate sub-credit charges
// here and only debit when the carried balance crosses a whole credit.
const bandwidthRemainder = new Map();

// Pause every active tunnel owned by `address` and tag the reason so the UI
// can show "out of credits" instead of a generic "paused". The owner can
// manually resume from the dashboard once they top up; if balance is still
// insufficient on the next tick they'll just get paused again.
function pauseOwnerTunnels(address, reason) {
  for (const t of registry.list()) {
    if (t.ownerAddress !== address) continue;
    if (t.disabled) continue;
    t.disabledReason = reason;
    registry.setDisabled(t.id, true);
  }
}

// All per-minute writes (uptime credits + bandwidth charges + lease ticks +
// session cleanup) get wrapped in one SQLite transaction. With
// synchronous=NORMAL that's a single fsync per minute regardless of how many
// tunnels/leases are active.
//
// Post-condition: every address that we mutated this tick is audited against
// its ledger. If a drift is detected the transaction is rolled back and the
// next tick retries.
const tickTxn = db.transaction(() => {
  const touched = new Set();
  const perMin = config.credits.uptimePerMinute || 0;
  if (perMin > 0) {
    // Tunnels currently under an active lease pay their owner via lease
    // billing, not uptime — don't double-pay them.
    const leasedTunnels = marketplace.activeLeasedTunnelIds();
    const seen = new Set();
    for (const t of registry.list()) {
      if (!t.ownerAddress) continue;
      if (leasedTunnels.has(t.id)) continue;
      if (seen.has(t.ownerAddress)) continue;
      seen.add(t.ownerAddress);
      try {
        accounts.credit(t.ownerAddress, perMin, 'uptime', null);
        touched.add(t.ownerAddress);
      } catch (e) { console.error('[credits] uptime credit failed:', e.message); }
    }
  }

  // Bandwidth charges: for every tunnel, compute new bytes since last tick,
  // convert to credits at config.credits.bandwidthChargePerMb, and debit the
  // owner. Per-tunnel chargedCredits is kept for UI display (4-decimal).
  const perMb = Number(config.credits.bandwidthChargePerMb) || 0;
  const insufficient = [];
  if (perMb > 0) {
    const byOwner = new Map();
    for (const t of registry.list()) {
      const m = t.metrics; if (!m) continue;
      const total = (m.bytesIn || 0) + (m.bytesOut || 0);
      const prev = m.chargedBytes || 0;
      if (total <= prev) continue;
      const cost = ((total - prev) / BYTES_PER_MB) * perMb;
      m.chargedBytes = total;
      m.chargedCredits = (m.chargedCredits || 0) + cost;
      if (!t.ownerAddress) continue;
      byOwner.set(t.ownerAddress, (byOwner.get(t.ownerAddress) || 0) + cost);
    }
    for (const [addr, owed] of byOwner) {
      const carry = (bandwidthRemainder.get(addr) || 0) + owed;
      const whole = Math.floor(carry);
      let debited = 0;
      if (whole > 0) {
        try {
          accounts.debit(addr, whole, 'bandwidth', null);
          debited = whole;
          touched.add(addr);
        } catch (e) {
          if (e.code === 'INSUFFICIENT_CREDITS') {
            // Drain whatever credits the owner does have, then queue a pause
            // for after the transaction commits (we don't want to mutate the
            // in-memory registry inside a DB txn that might still roll back).
            const have = accounts.getAccount(addr);
            const avail = Math.max(0, Math.min(whole, (have && have.credits) || 0));
            if (avail > 0) {
              try { accounts.debit(addr, avail, 'bandwidth', null); debited = avail; touched.add(addr); }
              catch { /* race; ignore */ }
            }
            insufficient.push(addr);
          } else {
            console.error('[credits] bandwidth debit failed:', e.message);
          }
        }
      }
      bandwidthRemainder.set(addr, carry - debited);
    }
  }

  marketplace.tickLeases();
  accounts.cleanupExpiredSessions();

  // Audit: every address we touched must satisfy the ledger invariant. A
  // mismatch throws and rolls back the whole tick.
  for (const addr of touched) auditor.assertConsistent(addr);

  // Stash the pause list on the transaction-local closure result; we apply it
  // after commit (below).
  return insufficient;
});

function tick() {
  try {
    const toPause = tickTxn();
    if (toPause && toPause.length) {
      for (const addr of toPause) {
        console.warn(`[credits] pausing tunnels for ${addr} (insufficient credits)`);
        pauseOwnerTunnels(addr, 'insufficient_credits');
      }
    }
  } catch (err) {
    console.error('[credits] tick error:', err && err.message ? err.message : err);
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
