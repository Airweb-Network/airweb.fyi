// Accounts, sessions, credit ledger.
//
// An account is identified by a short address derived from the user's
// SSH public key (`aw_` + base32 of sha256(pubkey)[0:10]). The private key is
// generated server-side once, returned to the user for download, and never
// persisted.
//
// Auth has two surfaces:
//   * Browser  -> session cookie (created on /api/register, restored via /api/login
//                                  which re-derives the address from an uploaded key)
//   * SSH      -> publickey auth checked against accounts.ssh_public_key

const crypto = require('crypto');
const ssh2 = require('ssh2');
const config = require('./config');
const db = require('./db');

const SESSION_TTL_MS = (config.sessions.ttlDays || 30) * 24 * 60 * 60 * 1000;

// Prepared statements
const stmts = {
  insertAccount: db.prepare(`
    INSERT INTO accounts (address, ssh_public_key, algo, fingerprint, credits, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getAccountByAddress: db.prepare(`SELECT * FROM accounts WHERE address = ?`),
  getAccountByFingerprint: db.prepare(`SELECT * FROM accounts WHERE fingerprint = ?`),
  updateLastSeen: db.prepare(`UPDATE accounts SET last_seen_at = ? WHERE address = ?`),
  addCredits: db.prepare(`UPDATE accounts SET credits = credits + ? WHERE address = ?`),
  insertLedger: db.prepare(`
    INSERT INTO ledger (address, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)
  `),
  recentLedger: db.prepare(`
    SELECT id, delta, reason, ref, created_at FROM ledger
    WHERE address = ? ORDER BY created_at DESC LIMIT ?
  `),

  insertSession: db.prepare(`
    INSERT INTO sessions (token, address, created_at, expires_at) VALUES (?, ?, ?, ?)
  `),
  getSession: db.prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  cleanupSessions: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),

  pubkeyAll: db.prepare(`SELECT address, ssh_public_key, algo FROM accounts`),

  countAdmins:    db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE is_admin = 1`),
  setAdminFlag:   db.prepare(`UPDATE accounts SET is_admin = ? WHERE address = ?`),
  listAccounts:   db.prepare(`SELECT address, credits, is_admin, created_at, last_seen_at FROM accounts ORDER BY created_at ASC`),
};

// ---------------------------------------------------------------------------
// Address derivation
// ---------------------------------------------------------------------------
// Base32 alphabet (Crockford-ish, lowercase, no padding). Avoids 0x-hex so
// the address is visibly distinct from an Ethereum wallet.
const B32_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function deriveAddress(sshPubData /* Buffer */) {
  const h = crypto.createHash('sha256').update(sshPubData).digest();
  // 10 bytes => 16 base32 chars; prefix gives total length 19.
  return 'aw_' + base32Encode(h.slice(0, 10));
}

function fingerprintOf(sshPubData) {
  return 'SHA256:' +
    crypto.createHash('sha256').update(sshPubData).digest('base64').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Registration / login
// ---------------------------------------------------------------------------
// Generates a new Ed25519 keypair, creates the account, returns the private
// key ONCE plus a fresh session token.
function register() {
  const { public: pubOpenSSH, private: privOpenSSH } =
    ssh2.utils.generateKeyPairSync('ed25519');

  const parsed = ssh2.utils.parseKey(pubOpenSSH);
  const pubData = parsed.getPublicSSH();
  const address = deriveAddress(pubData);
  const fp = fingerprintOf(pubData);
  const now = Date.now();

  const bonus = config.credits.signupBonus || 0;
  let promotedToAdmin = false;
  const tx = db.transaction(() => {
    stmts.insertAccount.run(address, pubOpenSSH.trim(), parsed.type, fp, bonus, now, now);
    if (bonus > 0) {
      stmts.insertLedger.run(address, bonus, 'signup_bonus', null, now);
    }
    // Bootstrap rule: if there are no admins yet, promote this account.
    const { n } = stmts.countAdmins.get();
    if (n === 0) {
      stmts.setAdminFlag.run(1, address);
      promotedToAdmin = true;
    }
  });
  tx();

  const session = createSession(address);
  return {
    address,
    fingerprint: fp,
    algo: parsed.type,
    privateKey: privOpenSSH,
    publicKey: pubOpenSSH.trim(),
    credits: bonus,
    isAdmin: promotedToAdmin,
    sessionToken: session.token,
    sessionExpiresAt: session.expires_at,
  };
}

// Given an OpenSSH private key string, derive the address and return the
// existing account + a new session. (Login on a new browser.)
function loginWithPrivateKey(privateKeyText, passphrase) {
  let parsed;
  try {
    parsed = ssh2.utils.parseKey(privateKeyText, passphrase || undefined);
  } catch (e) { parsed = e; }
  if (!parsed || parsed instanceof Error) {
    const err = new Error('invalid_private_key');
    err.detail = parsed && parsed.message;
    throw err;
  }
  // parseKey returns a parsed key object for private keys too; getPublicSSH() gives the pub data.
  const pubData = parsed.getPublicSSH();
  const address = deriveAddress(pubData);
  const account = stmts.getAccountByAddress.get(address);
  if (!account) {
    const err = new Error('account_not_found');
    err.address = address;
    throw err;
  }
  stmts.updateLastSeen.run(Date.now(), address);
  const session = createSession(address);
  return { account, session };
}

function getAccount(address) {
  if (!address) return null;
  return stmts.getAccountByAddress.get(address.toLowerCase()) || null;
}

// ---------------------------------------------------------------------------
// SSH publickey verification (called from sshServer auth handler)
// ---------------------------------------------------------------------------
function verifySshAuth(ctx) {
  // Look up by full public key blob comparison.
  // (Could be sped up with an index on a hash, but accounts table is small per-host.)
  const rows = stmts.pubkeyAll.all();
  for (const row of rows) {
    if (row.algo !== ctx.key.algo) continue;
    let parsed;
    try { parsed = ssh2.utils.parseKey(row.ssh_public_key); } catch { continue; }
    if (!parsed || parsed instanceof Error) continue;
    const pubBlob = parsed.getPublicSSH();
    const ctxData = ctx.key.data;
    if (!ctxData.equals(pubBlob)) continue;
    if (ctx.signature) {
      const ok = parsed.verify(ctx.blob, ctx.signature);
      if (ok !== true) continue;
    }
    stmts.updateLastSeen.run(Date.now(), row.address);
    return { address: row.address };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
function createSession(address) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  stmts.insertSession.run(token, address, now, expiresAt);
  return { token, address, created_at: now, expires_at: expiresAt };
}

function resolveSession(token) {
  if (!token) return null;
  const row = stmts.getSession.get(token, Date.now());
  if (!row) return null;
  const account = stmts.getAccountByAddress.get(row.address);
  return account ? { session: row, account } : null;
}

function destroySession(token) {
  if (!token) return;
  stmts.deleteSession.run(token);
}

function cleanupExpiredSessions() {
  stmts.cleanupSessions.run(Date.now());
}

// ---------------------------------------------------------------------------
// Credits / ledger
// ---------------------------------------------------------------------------
function credit(address, delta, reason, ref) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const now = Date.now();
  const tx = db.transaction(() => {
    stmts.addCredits.run(delta, address);
    stmts.insertLedger.run(address, delta, reason, ref || null, now);
  });
  tx();
}

// Atomic debit; throws if insufficient funds.
const stmtsTryDebit = db.prepare(`
  UPDATE accounts SET credits = credits - ? WHERE address = ? AND credits >= ?
`);
function debit(address, amount, reason, ref) {
  if (!(amount > 0)) return;
  const now = Date.now();
  const tx = db.transaction(() => {
    const r = stmtsTryDebit.run(amount, address, amount);
    if (r.changes !== 1) {
      const e = new Error('insufficient_credits');
      e.code = 'INSUFFICIENT_CREDITS';
      throw e;
    }
    stmts.insertLedger.run(address, -amount, reason, ref || null, now);
  });
  tx();
}

function recentLedger(address, limit = 25) {
  return stmts.recentLedger.all(address, limit);
}

/**
 * Paginated + filterable ledger for the Transactions tab.
 * Filters (all optional): reason (exact), q (substring in reason/ref),
 *                         sign ('pos'|'neg'), since (ms), until (ms).
 * Returns { items, total, offset, limit }.
 */
function queryLedger(address, opts = {}) {
  const where = ['address = ?'];
  const params = [address];
  if (opts.reason) { where.push('reason = ?'); params.push(String(opts.reason)); }
  if (opts.q) {
    where.push("(LOWER(reason) LIKE ? OR LOWER(IFNULL(ref, '')) LIKE ?)");
    const like = '%' + String(opts.q).toLowerCase() + '%';
    params.push(like, like);
  }
  if (opts.sign === 'pos') where.push('delta > 0');
  if (opts.sign === 'neg') where.push('delta < 0');
  if (opts.since) { where.push('created_at >= ?'); params.push(Number(opts.since)); }
  if (opts.until) { where.push('created_at <= ?'); params.push(Number(opts.until)); }

  const limit  = Math.min(200, Math.max(1, Number(opts.limit) || 20));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const whereSql = where.join(' AND ');
  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM ledger WHERE ${whereSql}`
  ).get(...params).n;
  const items = db.prepare(
    `SELECT id, delta, reason, ref, created_at FROM ledger
     WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  return { items, total, offset, limit };
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------
function isAdmin(account) {
  return !!(account && account.is_admin);
}
function setAdmin(address, on) {
  stmts.setAdminFlag.run(on ? 1 : 0, address);
}
function listAccounts() {
  return stmts.listAccounts.all();
}

module.exports = {
  register,
  loginWithPrivateKey,
  getAccount,
  verifySshAuth,
  createSession,
  resolveSession,
  destroySession,
  cleanupExpiredSessions,
  credit,
  debit,
  recentLedger,
  queryLedger,
  isAdmin,
  setAdmin,
  listAccounts,
  deriveAddress,
  fingerprintOf,
};
