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
// Performance pragmas — single-writer SQLite, tuned for high read concurrency
// and rare batched writes (see credits.js tick()). Tradeoff: synchronous=NORMAL
// can lose the last few committed transactions on hard power loss; for a
// metering database that's an acceptable tradeoff for ~5× write throughput.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');      // 256 MB memory-mapped read cache
db.pragma('cache_size = -65536');        // 64 MB page cache
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

  CREATE TABLE IF NOT EXISTS forum_questions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    author_address    TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    body              TEXT NOT NULL,
    tags_json         TEXT NOT NULL DEFAULT '[]',
    status            TEXT NOT NULL DEFAULT 'open',
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    bumped_at         INTEGER NOT NULL,
    bump_count        INTEGER NOT NULL DEFAULT 0,
    answer_count      INTEGER NOT NULL DEFAULT 0,
    last_answered_at  INTEGER,
    last_answered_by  TEXT REFERENCES accounts(address) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_forum_questions_bumped ON forum_questions(bumped_at DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_forum_questions_author ON forum_questions(author_address, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_forum_questions_status ON forum_questions(status, bumped_at DESC);

  CREATE TABLE IF NOT EXISTS forum_answers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id     INTEGER NOT NULL REFERENCES forum_questions(id) ON DELETE CASCADE,
    author_address  TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_forum_answers_question ON forum_answers(question_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_forum_answers_author ON forum_answers(author_address, created_at DESC);

  CREATE TABLE IF NOT EXISTS forum_saved_posts (
    address      TEXT NOT NULL REFERENCES accounts(address) ON DELETE CASCADE,
    question_id  INTEGER NOT NULL REFERENCES forum_questions(id) ON DELETE CASCADE,
    saved_at     INTEGER NOT NULL,
    PRIMARY KEY (address, question_id)
  );
  CREATE INDEX IF NOT EXISTS idx_forum_saved_posts_address ON forum_saved_posts(address, saved_at DESC);

  CREATE TABLE IF NOT EXISTS forum_user_state (
    address            TEXT PRIMARY KEY REFERENCES accounts(address) ON DELETE CASCADE,
    notifications_seen_at INTEGER NOT NULL DEFAULT 0
  );
`);

// --- Lightweight migrations (additive only) -------------------------------
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
if (!hasColumn('accounts', 'is_admin')) {
  db.exec(`ALTER TABLE accounts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
}

// Listings: hardware / network metadata + validation state.
const LISTING_ADDS = [
  ['tunnel_id',          'INTEGER'],
  ['cpu_model',          'TEXT'],
  ['cpu_cores',          'INTEGER'],
  ['ram_gb',             'INTEGER'],
  ['disk_gb',            'INTEGER'],
  ['bandwidth_mbps',     'INTEGER'],
  ['os',                 'TEXT'],
  ['country_code',       'TEXT'],
  ['ip_address',         'TEXT'],
  ['sudo_user',          'TEXT'],
  ['validated',          'INTEGER NOT NULL DEFAULT 0'],
  ['validated_at',       'INTEGER'],
  ['protocol',           "TEXT NOT NULL DEFAULT 'tcp'"],
  ['subdomain',          'TEXT'],
  ['lease_term_minutes', 'INTEGER NOT NULL DEFAULT 60'],
];
for (const [name, ddl] of LISTING_ADDS) {
  if (!hasColumn('listings', name)) {
    db.exec(`ALTER TABLE listings ADD COLUMN ${name} ${ddl}`);
  }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country_code);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_cores   ON listings(cpu_cores);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_ram     ON listings(ram_gb);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_price   ON listings(price_per_minute);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_protocol ON listings(protocol);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_subdomain ON listings(subdomain);`);

// Leases: per-lease passcode + expiry for HTTP/HTTPS gated access.
const LEASE_ADDS = [
  ['passcode',      'TEXT'],
  ['expires_at',    'INTEGER'],
  ['term_minutes',  'INTEGER'],
];
for (const [name, ddl] of LEASE_ADDS) {
  if (!hasColumn('leases', name)) {
    db.exec(`ALTER TABLE leases ADD COLUMN ${name} ${ddl}`);
  }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_leases_expires ON leases(expires_at);`);

console.log(`[db] sqlite at ${dbPath}`);

module.exports = db;
module.exports.path = dbPath;
