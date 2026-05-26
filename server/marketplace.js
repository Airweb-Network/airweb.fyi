// Marketplace: handle reservations, lease listings, active leases.
//
// "Handle" = a reserved subdomain (<handle>.airweb.fyi) that only the owner
//            can publish tunnels under. Other accounts can't squat it.
// "Listing" = an account advertises an active tunnel they own for lease.
//             A renter "leases" it for a fixed term, paying the full term
//             up-front (price_per_minute × term_minutes); the owner is
//             credited the same amount at lease start.

const config = require('./config');
const crypto = require('crypto');
const db = require('./db');
const accounts = require('./accounts');
const registry = require('./registry');
const sshValidator = require('./sshValidator');

const HANDLE_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const SAFE_TEXT_RE = /^[\w .,()\-+/]{0,80}$/;
const SUPPORTED_PROTOCOLS = new Set(['tcp', 'http', 'https']);
const DEFAULT_LEASE_TERM_MIN = 60;
const MIN_LEASE_TERM_MIN = 5;
const MAX_LEASE_TERM_MIN = 60 * 24 * 7; // 1 week

const stmts = {
  getHandle: db.prepare(`SELECT * FROM handles WHERE handle = ?`),
  insertHandle: db.prepare(`
    INSERT INTO handles (handle, owner_address, acquired_at, cost_credits) VALUES (?, ?, ?, ?)
  `),
  handlesByOwner: db.prepare(`SELECT * FROM handles WHERE owner_address = ? ORDER BY acquired_at DESC`),

  insertListing: db.prepare(`
    INSERT INTO listings (
      owner_address, title, description, price_per_minute, active, created_at,
      tunnel_id, cpu_model, cpu_cores, ram_gb, disk_gb, bandwidth_mbps, os,
      country_code, ip_address, sudo_user, validated, validated_at,
      protocol, subdomain, lease_term_minutes
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getListing: db.prepare(`SELECT * FROM listings WHERE id = ?`),
  listingsByOwner: db.prepare(`SELECT * FROM listings WHERE owner_address = ? ORDER BY created_at DESC`),
  activeListings: db.prepare(`
    SELECT l.*, a.address AS owner FROM listings l
    JOIN accounts a ON a.address = l.owner_address
    WHERE l.active = 1 ORDER BY l.created_at DESC LIMIT ?
  `),
  setListingActive: db.prepare(`UPDATE listings SET active = ? WHERE id = ? AND owner_address = ?`),
  deleteListing: db.prepare(`DELETE FROM listings WHERE id = ? AND owner_address = ?`),

  insertLease: db.prepare(`
    INSERT INTO leases (
      listing_id, renter_address, started_at, ended_at, minutes_billed, total_credits,
      passcode, expires_at, term_minutes
    )
    VALUES (?, ?, ?, NULL, 0, 0, ?, ?, ?)
  `),
  activeLeasesForListing: db.prepare(`
    SELECT * FROM leases WHERE listing_id = ? AND ended_at IS NULL
  `),
  activeLeasedTunnelIds: db.prepare(`
    SELECT DISTINCT l.tunnel_id AS tunnel_id
    FROM leases le JOIN listings l ON l.id = le.listing_id
    WHERE le.ended_at IS NULL AND l.tunnel_id IS NOT NULL
  `),
  activeListingForTunnel: db.prepare(`
    SELECT id FROM listings WHERE tunnel_id = ? AND active = 1 LIMIT 1
  `),
  listingEarnings: db.prepare(`
    SELECT
      COUNT(*)                                   AS leaseCount,
      SUM(CASE WHEN ended_at IS NULL THEN 1 ELSE 0 END) AS activeLeaseCount,
      COALESCE(SUM(total_credits), 0)            AS totalEarnings,
      COALESCE(SUM(minutes_billed), 0)           AS totalMinutesBilled,
      MAX(started_at)                            AS lastLeaseStartedAt,
      MAX(ended_at)                              AS lastLeaseEndedAt
    FROM leases WHERE listing_id = ?
  `),
  expiredActiveLeases: db.prepare(`
    SELECT id, renter_address FROM leases
    WHERE ended_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?
  `),
  endLease: db.prepare(`UPDATE leases SET ended_at = ? WHERE id = ? AND renter_address = ? AND ended_at IS NULL`),
  getLease: db.prepare(`SELECT * FROM leases WHERE id = ?`),
  activeLeasesByRenter: db.prepare(`
    SELECT le.*, li.title, li.price_per_minute, li.owner_address
    FROM leases le JOIN listings li ON li.id = le.listing_id
    WHERE le.renter_address = ? AND le.ended_at IS NULL ORDER BY le.started_at DESC
  `),
  recentLeasesByRenter: db.prepare(`
    SELECT le.*, li.title, li.price_per_minute, li.owner_address
    FROM leases le JOIN listings li ON li.id = le.listing_id
    WHERE le.renter_address = ? ORDER BY le.started_at DESC LIMIT ?
  `),
  allActiveLeases: db.prepare(`
    SELECT le.*, li.price_per_minute, li.owner_address, li.title
    FROM leases le JOIN listings li ON li.id = le.listing_id
    WHERE le.ended_at IS NULL
  `),
  bumpLeaseBilling: db.prepare(`
    UPDATE leases SET minutes_billed = minutes_billed + 1, total_credits = total_credits + ?
    WHERE id = ?
  `),
};

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------
function isValidHandle(h) {
  if (typeof h !== 'string') return false;
  const min = config.credits.handleMinLength || 3;
  const max = config.credits.handleMaxLength || 32;
  if (h.length < min || h.length > max) return false;
  if (!HANDLE_RE.test(h)) return false;
  if ((config.limits.reservedSubdomains || []).includes(h)) return false;
  return true;
}

function getHandleOwner(handle) {
  const row = stmts.getHandle.get(handle.toLowerCase());
  return row ? row.owner_address : null;
}

function purchaseHandle(address, handle) {
  handle = String(handle || '').toLowerCase();
  if (!isValidHandle(handle)) {
    const e = new Error('invalid_handle'); e.code = 'INVALID_HANDLE'; throw e;
  }
  if (stmts.getHandle.get(handle)) {
    const e = new Error('handle_taken'); e.code = 'HANDLE_TAKEN'; throw e;
  }
  const cost = config.credits.handleBaseCost || 50;
  const now = Date.now();
  const tx = db.transaction(() => {
    accounts.debit(address, cost, 'handle_purchase', handle);
    stmts.insertHandle.run(handle, address, now, cost);
  });
  tx();
  return { handle, cost, acquiredAt: now };
}

function handlesOf(address) {
  return stmts.handlesByOwner.all(address);
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
function sanitizeShortText(s, maxLen = 80) {
  if (s == null) return null;
  const v = String(s).trim().slice(0, maxLen);
  return v || null;
}
function posIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function createListing(address, body) {
  const title = sanitizeShortText(body && body.title, 80);
  if (!title) {
    const e = new Error('invalid_title'); e.code = 'INVALID_TITLE'; throw e;
  }
  const description = body && body.description
    ? String(body.description).slice(0, 500) : '';
  const price = Math.max(
    1,
    Math.floor(Number(body && body.pricePerMinute) || config.credits.defaultLeasePricePerMinute)
  );

  const tunnelId = Number(body && body.tunnelId);
  if (!tunnelId) {
    const e = new Error('tunnel_required'); e.code = 'TUNNEL_REQUIRED'; throw e;
  }
  const tunnel = registry.lookupId(tunnelId);
  if (!tunnel || tunnel.ownerAddress !== address) {
    const e = new Error('tunnel_not_owned'); e.code = 'TUNNEL_NOT_OWNED'; throw e;
  }
  if (tunnel.internal) {
    const e = new Error('internal_tunnel'); e.code = 'INTERNAL_TUNNEL'; throw e;
  }

  // Protocol: 'tcp' (legacy SSH-on-TCP listing, requires sudo validation)
  //           'http' / 'https' (passcode-gated web lease)
  let protocol = String((body && body.protocol) || '').toLowerCase();
  if (!protocol) protocol = (tunnel.type === 'http') ? 'http' : 'tcp';
  if (!SUPPORTED_PROTOCOLS.has(protocol)) {
    const e = new Error('invalid_protocol'); e.code = 'INVALID_PROTOCOL'; throw e;
  }
  if ((protocol === 'http' || protocol === 'https') && tunnel.type !== 'http') {
    const e = new Error('http_listing_requires_http_tunnel'); e.code = 'PROTOCOL_TUNNEL_MISMATCH'; throw e;
  }
  if (protocol === 'tcp' && tunnel.type !== 'tcp') {
    const e = new Error('tcp_listing_requires_tcp_tunnel'); e.code = 'PROTOCOL_TUNNEL_MISMATCH'; throw e;
  }

  let termMin = Math.floor(Number(body && body.leaseTermMinutes) || DEFAULT_LEASE_TERM_MIN);
  if (!Number.isFinite(termMin) || termMin < MIN_LEASE_TERM_MIN) termMin = MIN_LEASE_TERM_MIN;
  if (termMin > MAX_LEASE_TERM_MIN) termMin = MAX_LEASE_TERM_MIN;

  const country = (body && body.countryCode || '').toUpperCase();
  const countryCode = COUNTRY_RE.test(country) ? country : null;

  let hw = {};
  let sudoUserStored = null;
  let validated = 0;
  let validatedAt = null;
  let ipAddress = (tunnel.remoteAddr || '').split(':')[0] || null;

  if (protocol === 'tcp') {
    const sudoUser = sanitizeShortText(body && body.sudoUser, 64);
    const sudoPassword = body && body.sudoPassword;
    if (!sudoUser || !sudoPassword || typeof sudoPassword !== 'string') {
      const e = new Error('sudo_credentials_required'); e.code = 'SUDO_REQUIRED'; throw e;
    }
    const validation = await sshValidator.validateTunnelSudo(tunnel, sudoUser, sudoPassword);
    hw = validation.hardware || {};
    sudoUserStored = sudoUser;
    validated = 1;
    validatedAt = Date.now();
    ipAddress = validation.host || ipAddress;
  } else {
    // HTTP/HTTPS lease: no sudo, no SSH probe; the tunnel must already be live.
    if (!tunnel.subdomain) {
      const e = new Error('tunnel_missing_subdomain'); e.code = 'NO_SUBDOMAIN'; throw e;
    }
  }

  const now = Date.now();
  const r = stmts.insertListing.run(
    address, title, description, price, now,
    tunnel.id,
    sanitizeShortText(hw.cpuModel, 120),
    posIntOrNull(hw.cpuCores),
    posIntOrNull(hw.ramGb),
    posIntOrNull(hw.diskGb),
    posIntOrNull(body && body.bandwidthMbps), // bandwidth still user-supplied
    sanitizeShortText(hw.os, 80),
    countryCode,
    ipAddress,
    sudoUserStored,
    validated,
    validatedAt,
    protocol,
    tunnel.subdomain || null,
    termMin,
  );
  return stmts.getListing.get(r.lastInsertRowid);
}

function setListingActive(address, id, active) {
  stmts.setListingActive.run(active ? 1 : 0, id, address);
  return stmts.getListing.get(id);
}

function removeListing(address, id) {
  stmts.deleteListing.run(id, address);
}

function listingsOf(address) { return stmts.listingsByOwner.all(address); }
function browseListings(limit = 50) { return stmts.activeListings.all(limit); }
function getListing(id) { return stmts.getListing.get(id); }

/**
 * Filterable browse for the marketplace page.
 * Filters (all optional): country (ISO-2), minCores, minRam, maxPrice, os (substring), q (free-text in title/desc).
 */
function browseListingsFiltered(filters = {}, limit = 200) {
  const where = ['l.active = 1'];
  const params = [];
  if (filters.country) {
    where.push('UPPER(l.country_code) = ?');
    params.push(String(filters.country).toUpperCase());
  }
  if (filters.minCores) {
    where.push('IFNULL(l.cpu_cores, 0) >= ?');
    params.push(Number(filters.minCores) || 0);
  }
  if (filters.minRam) {
    where.push('IFNULL(l.ram_gb, 0) >= ?');
    params.push(Number(filters.minRam) || 0);
  }
  if (filters.maxPrice) {
    where.push('l.price_per_minute <= ?');
    params.push(Number(filters.maxPrice) || 0);
  }
  if (filters.os) {
    where.push("LOWER(IFNULL(l.os, '')) LIKE ?");
    params.push('%' + String(filters.os).toLowerCase() + '%');
  }
  if (filters.protocol) {
    where.push("LOWER(IFNULL(l.protocol, 'tcp')) = ?");
    params.push(String(filters.protocol).toLowerCase());
  }
  if (filters.q) {
    where.push("(LOWER(l.title) LIKE ? OR LOWER(IFNULL(l.description, '')) LIKE ?)");
    const like = '%' + String(filters.q).toLowerCase() + '%';
    params.push(like, like);
  }
  const sql = `
    SELECT l.* FROM listings l
    WHERE ${where.join(' AND ')}
    ORDER BY l.created_at DESC LIMIT ?
  `;
  params.push(Math.min(500, Number(limit) || 200));
  return db.prepare(sql).all(...params);
}

// ---------------------------------------------------------------------------
// Leases
// ---------------------------------------------------------------------------
function startLease(renterAddress, listingId) {
  const listing = stmts.getListing.get(listingId);
  if (!listing || !listing.active) {
    const e = new Error('listing_not_available'); e.code = 'LISTING_UNAVAILABLE'; throw e;
  }
  if (listing.owner_address === renterAddress) {
    const e = new Error('cannot_lease_own_listing'); e.code = 'SELF_LEASE'; throw e;
  }
  // The backing tunnel must currently be online (registered + not paused).
  const tunnel = listing.tunnel_id ? registry.lookupId(listing.tunnel_id) : null;
  if (!tunnel || tunnel.disabled) {
    const e = new Error('listing_offline'); e.code = 'LISTING_OFFLINE'; throw e;
  }
  const protocol = String(listing.protocol || 'tcp').toLowerCase();
  const termMin = Math.max(MIN_LEASE_TERM_MIN, Number(listing.lease_term_minutes) || DEFAULT_LEASE_TERM_MIN);
  const price = listing.price_per_minute;
  const totalCost = price * termMin;
  // Prepaid: renter pays the full term up-front; owner is credited immediately.
  const acct = accounts.getAccount(renterAddress);
  if (!acct || acct.credits < totalCost) {
    const e = new Error('insufficient_credits'); e.code = 'INSUFFICIENT_CREDITS'; throw e;
  }
  const now = Date.now();
  const expiresAt = now + termMin * 60 * 1000;
  // Passcodes only meaningful for HTTP/HTTPS gated leases, but generate one for
  // every lease so renters always have something to share if needed.
  const passcode = generatePasscode();
  let leaseId;
  const tx = db.transaction(() => {
    accounts.debit(renterAddress, totalCost, 'lease_spend', `listing:${listing.id}`);
    accounts.credit(listing.owner_address, totalCost, 'lease_earn', `listing:${listing.id}`);
    const r = stmts.insertLease.run(
      listing.id, renterAddress, now,
      passcode, expiresAt, termMin,
    );
    leaseId = r.lastInsertRowid;
    // Record the prepaid amount on the lease row up-front.
    db.prepare(`UPDATE leases SET minutes_billed = ?, total_credits = ? WHERE id = ?`)
      .run(termMin, totalCost, leaseId);
  });
  tx();
  return stmts.getLease.get(leaseId);
}

function generatePasscode() {
  // 10-char base32 (no I/O/0/1) — easy to read and type.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

// Used by httpRouter to gate access to HTTP/HTTPS leased tunnels.
// Returns `{ passcodes: Set<string>, expiresAt: number }` if the subdomain has
// at least one active HTTP/HTTPS lease; otherwise null.
function gateForSubdomain(sub) {
  if (!sub) return null;
  const row = db.prepare(`
    SELECT id, lease_term_minutes FROM listings
    WHERE active = 1 AND subdomain = ?
      AND protocol IN ('http', 'https')
    ORDER BY created_at DESC LIMIT 1
  `).get(sub);
  if (!row) return null;
  const now = Date.now();
  const leases = stmts.activeLeasesForListing.all(row.id)
    .filter(le => le.passcode && (!le.expires_at || le.expires_at > now));
  if (!leases.length) {
    // Listing exists but no active lease yet — block public access entirely.
    return { passcodes: new Set(), expiresAt: 0, listingId: row.id };
  }
  const passcodes = new Set(leases.map(le => le.passcode));
  const expiresAt = Math.max(...leases.map(le => le.expires_at || 0));
  return { passcodes, expiresAt, listingId: row.id };
}

function endLease(renterAddress, leaseId) {
  stmts.endLease.run(Date.now(), leaseId, renterAddress);
  return stmts.getLease.get(leaseId);
}

function activeLeasesOf(renterAddress) { return stmts.activeLeasesByRenter.all(renterAddress); }
function recentLeasesOf(renterAddress, limit = 25) { return stmts.recentLeasesByRenter.all(renterAddress, limit); }

// Called by the credits ticker once per minute. Leases are prepaid at
// startLease, so the ticker only auto-ends any lease whose term has elapsed.
function tickLeases() {
  const now = Date.now();
  const expired = stmts.expiredActiveLeases.all(now);
  for (const le of expired) {
    stmts.endLease.run(now, le.id, le.renter_address);
  }
}

// Set of tunnel IDs that currently back at least one active lease. Owners
// don't earn passive uptime credits on those — the renter pays them directly.
function activeLeasedTunnelIds() {
  const rows = stmts.activeLeasedTunnelIds.all();
  return new Set(rows.map(r => Number(r.tunnel_id)));
}

function activeListingIdForTunnel(tunnelId) {
  const row = stmts.activeListingForTunnel.get(Number(tunnelId));
  return row ? row.id : null;
}

// Per-listing earnings aggregate. Returns zero-filled stats even when the
// listing has never been leased.
function listingEarnings(listingId) {
  const r = stmts.listingEarnings.get(Number(listingId)) || {};
  const leaseCount        = Number(r.leaseCount || 0);
  const activeLeaseCount  = Number(r.activeLeaseCount || 0);
  const totalEarnings     = Number(r.totalEarnings || 0);
  const totalMinutesBilled= Number(r.totalMinutesBilled || 0);
  const avgPerLease       = leaseCount ? totalEarnings / leaseCount : 0;
  const avgPerMinute      = totalMinutesBilled ? totalEarnings / totalMinutesBilled : 0;
  return {
    leaseCount, activeLeaseCount, totalEarnings, totalMinutesBilled,
    avgPerLease, avgPerMinute,
    lastLeaseStartedAt: r.lastLeaseStartedAt || null,
    lastLeaseEndedAt:   r.lastLeaseEndedAt   || null,
  };
}

module.exports = {
  // handles
  isValidHandle, getHandleOwner, purchaseHandle, handlesOf,
  // listings
  createListing, setListingActive, removeListing, listingsOf,
  browseListings, browseListingsFiltered, getListing,
  // leases
  startLease, endLease, activeLeasesOf, recentLeasesOf, tickLeases,
  activeLeasedTunnelIds, activeListingIdForTunnel, listingEarnings,
  // http gating
  gateForSubdomain,
};
