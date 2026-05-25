// SQLite persistence layer.
//
// Single connection, WAL mode, synchronous API (better-sqlite3).
// Schema is created on first run; subsequent runs are no-ops thanks to
// "IF NOT EXISTS".
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const dataDir = path.resolve(config.data && config.data.dir || './data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, (config.data && config.data.dbFile) || 'airweb.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    address          TEXT PRIMARY KEY,
    ssh_public_key   TEXT NOT NULL,
    algo             TEXT NOT NULL,
    fingerprint      TEXT NOT NULL,
    credits          INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL,
    last_seen_at     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_fingerprint ON accounts(fingerprint);

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    address     TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address);

  CREATE TABLE IF NOT EXISTS handles (
    handle         TEXT PRIMARY KEY,
    owner_address  TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    acquired_at    INTEGER NOT NULL,
    cost_credits   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_handles_owner ON handles(owner_address);

  CREATE TABLE IF NOT EXISTS listings (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_address      TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    description        TEXT,
    price_per_minute   INTEGER NOT NULL,
    active             INTEGER NOT NULL DEFAULT 1,
    created_at         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active);
  CREATE INDEX IF NOT EXISTS idx_listings_owner  ON listings(owner_address);

  CREATE TABLE IF NOT EXISTS leases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id      INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    renter_address  TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    minutes_billed  INTEGER NOT NULL DEFAULT 0,
    total_credits   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_leases_renter  ON leases(renter_address);
  CREATE INDEX IF NOT EXISTS idx_leases_listing ON leases(listing_id);
  CREATE INDEX IF NOT EXISTS idx_leases_active  ON leases(ended_at);

  CREATE TABLE IF NOT EXISTS ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    address     TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    delta       INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    ref         TEXT,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_address ON ledger(address, created_at DESC);
`);

// --- Lightweight migrations (additive only) -------------------------------
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
if (!hasColumn('accounts', 'is_admin')) {
  db.exec(`ALTER TABLE accounts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
}

console.log(`[db] sqlite at ${dbPath}`);

module.exports = db;
module.exports.path = dbPath;
