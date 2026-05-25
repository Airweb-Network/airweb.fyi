// Marketplace: handle reservations, lease listings, active leases.
//
// "Handle" = a reserved subdomain (<handle>.airweb.fyi) that only the owner
//            can publish tunnels under. Other accounts can't squat it.
// "Listing" = an account advertises an active tunnel they own for lease.
//             A renter "leases" it (debited per minute by the ticker) and
//             gets the public URL to use.

const config = require('./config');
const db = require('./db');
const accounts = require('./accounts');

const HANDLE_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

const stmts = {
  getHandle: db.prepare(`SELECT * FROM handles WHERE handle = ?`),
  insertHandle: db.prepare(`
    INSERT INTO handles (handle, owner_address, acquired_at, cost_credits) VALUES (?, ?, ?, ?)
  `),
  handlesByOwner: db.prepare(`SELECT * FROM handles WHERE owner_address = ? ORDER BY acquired_at DESC`),

  insertListing: db.prepare(`
    INSERT INTO listings (owner_address, title, description, price_per_minute, active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
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
    INSERT INTO leases (listing_id, renter_address, started_at, ended_at, minutes_billed, total_credits)
    VALUES (?, ?, ?, NULL, 0, 0)
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
function createListing(address, { title, description, pricePerMinute }) {
  if (!title || typeof title !== 'string' || title.length > 80) {
    const e = new Error('invalid_title'); e.code = 'INVALID_TITLE'; throw e;
  }
  const price = Math.max(1, Math.floor(Number(pricePerMinute) || config.credits.defaultLeasePricePerMinute));
  const r = stmts.insertListing.run(address, title.trim(), (description || '').slice(0, 500), price, Date.now());
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
  const acct = accounts.getAccount(renterAddress);
  if (!acct || acct.credits < listing.price_per_minute) {
    const e = new Error('insufficient_credits'); e.code = 'INSUFFICIENT_CREDITS'; throw e;
  }
  const r = stmts.insertLease.run(listing.id, renterAddress, Date.now());
  return stmts.getLease.get(r.lastInsertRowid);
}

function endLease(renterAddress, leaseId) {
  stmts.endLease.run(Date.now(), leaseId, renterAddress);
  return stmts.getLease.get(leaseId);
}

function activeLeasesOf(renterAddress) { return stmts.activeLeasesByRenter.all(renterAddress); }
function recentLeasesOf(renterAddress, limit = 25) { return stmts.recentLeasesByRenter.all(renterAddress, limit); }

// Called by the credits ticker once per minute. For every active lease:
//   * debit renter price_per_min
//   * credit owner price_per_min (minus 0% fee for now)
// If the renter can't pay, end the lease.
function tickLeases() {
  const leases = stmts.allActiveLeases.all();
  for (const le of leases) {
    const price = le.price_per_minute;
    try {
      accounts.debit(le.renter_address, price, 'lease_spend', `lease:${le.id}`);
      accounts.credit(le.owner_address, price, 'lease_earn', `lease:${le.id}`);
      stmts.bumpLeaseBilling.run(price, le.id);
    } catch (err) {
      if (err && err.code === 'INSUFFICIENT_CREDITS') {
        stmts.endLease.run(Date.now(), le.id, le.renter_address);
      } else {
        console.error('[marketplace] lease tick error:', err);
      }
    }
  }
}

module.exports = {
  // handles
  isValidHandle, getHandleOwner, purchaseHandle, handlesOf,
  // listings
  createListing, setListingActive, removeListing, listingsOf, browseListings, getListing,
  // leases
  startLease, endLease, activeLeasesOf, recentLeasesOf, tickLeases,
};
