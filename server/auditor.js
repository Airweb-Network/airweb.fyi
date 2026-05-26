// Audit engine for the credits system.
//
// Invariant: every account's `accounts.credits` column must equal the sum of
// its `ledger.delta` entries (signup bonus, uptime credits, bandwidth charges,
// marketplace transactions, etc.). Any drift indicates a bug — either a debit
// or credit happened outside a ledger entry, or a ledger entry was inserted
// without the matching balance update.
//
// This module is read-only with respect to user data; it never mutates
// balances. If a drift is detected, the caller decides what to do (log,
// alert, halt, or auto-correct).

const db = require('./db');

const stmts = {
  ledgerSumOne: db.prepare('SELECT COALESCE(SUM(delta), 0) AS sum FROM ledger WHERE address = ?'),
  account:      db.prepare('SELECT address, credits FROM accounts WHERE address = ?'),
  allAccounts:  db.prepare('SELECT address, credits FROM accounts'),
  allLedgerSums: db.prepare(`
    SELECT address, COALESCE(SUM(delta), 0) AS sum
    FROM ledger
    GROUP BY address
  `),
};

// Audit a single account. Returns:
//   { address, credits, ledgerSum, delta, ok }
// where delta = credits - ledgerSum (0 when consistent).
function auditAccount(address) {
  const acc = stmts.account.get(address);
  if (!acc) return null;
  const sum = stmts.ledgerSumOne.get(address).sum;
  const delta = acc.credits - sum;
  return {
    address: acc.address,
    credits: acc.credits,
    ledgerSum: sum,
    delta,
    ok: delta === 0,
  };
}

// Audit every account. Returns:
//   { total, ok, mismatched: [...] }
// `mismatched` contains the same shape as auditAccount() for each drifting row.
function auditAll() {
  const sums = new Map();
  for (const row of stmts.allLedgerSums.all()) sums.set(row.address, row.sum);
  const accounts = stmts.allAccounts.all();
  const mismatched = [];
  for (const a of accounts) {
    const sum = sums.get(a.address) || 0;
    const delta = a.credits - sum;
    if (delta !== 0) {
      mismatched.push({
        address: a.address,
        credits: a.credits,
        ledgerSum: sum,
        delta,
        ok: false,
      });
    }
  }
  return { total: accounts.length, ok: mismatched.length === 0, mismatched };
}

// Throw if the given account is inconsistent. Useful as a post-condition in
// hot paths like the per-minute tick to fail loud rather than silently drift.
function assertConsistent(address) {
  const r = auditAccount(address);
  if (!r) return;
  if (!r.ok) {
    const e = new Error(
      `ledger inconsistency for ${address}: credits=${r.credits} ledgerSum=${r.ledgerSum} delta=${r.delta}`
    );
    e.code = 'LEDGER_INCONSISTENT';
    e.audit = r;
    throw e;
  }
}

// Wrap a credit/debit-style mutation so a drift is detected immediately.
// `fn` is the mutating function (e.g. accounts.credit/debit). The wrapper
// runs `fn`, then asserts consistency for the affected address. Returns
// whatever `fn` returns.
function withAudit(address, fn) {
  const before = auditAccount(address);
  const result = fn();
  const after = auditAccount(address);
  if (after && !after.ok) {
    const e = new Error(
      `mutation broke ledger invariant for ${address}: ` +
      `before delta=${before ? before.delta : 'n/a'}, ` +
      `after credits=${after.credits} ledgerSum=${after.ledgerSum} delta=${after.delta}`
    );
    e.code = 'LEDGER_INCONSISTENT';
    e.audit = after;
    throw e;
  }
  return result;
}

module.exports = { auditAccount, auditAll, assertConsistent, withAudit };
