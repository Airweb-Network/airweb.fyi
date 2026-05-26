// Safe DOM accessor — returns a no-op proxy when the element is absent so
// the same bundle can run on /dashboard, /marketplace and /connections
// without throwing on page-specific event wiring.
const NULL_EL = new Proxy(function () {}, {
  get(_, key) {
    if (key === Symbol.toPrimitive) return (h) => h === 'string' ? '' : (h === 'number' ? 0 : false);
    if (key === 'valueOf' || key === 'toString') return () => '';
    if (key === 'classList' || key === 'style' || key === 'dataset' ||
        key === 'parentNode' || key === 'parentElement') return NULL_EL;
    if (key === 'value' || key === 'textContent' || key === 'innerHTML' ||
        key === 'innerText' || key === 'src' || key === 'href') return '';
    if (key === 'checked' || key === 'disabled' || key === 'hidden') return false;
    if (key === 'options' || key === 'children' || key === 'childNodes' ||
        key === 'selectedOptions' || key === 'files') return [];
    return NULL_EL;
  },
  set() { return true; },
  apply() { return NULL_EL; },
  has() { return true; },
});
const $ = (id) => document.getElementById(id) || NULL_EL;
let CONFIG = null;
let ME = null;

// Placeholder peg — each credit is worth $0.01 USD.
const USD_PER_CREDIT_DEFAULT = 0.01;
function usdRate() { return (CONFIG && typeof CONFIG.usdPerCredit === 'number') ? CONFIG.usdPerCredit : USD_PER_CREDIT_DEFAULT; }
function fmtCredits(n) { return (Number(n) || 0).toFixed(2); }
function fmtUsd(n) {
  const usd = (Number(n) || 0) * usdRate();
  return (window.currency && window.currency.format)
    ? window.currency.format(usd)
    : '$' + usd.toFixed(2);
}

// Reversible 9×9 identicon. Encodes the 80-bit hash part of an aw_ address
// directly into the grid. Cell (0,0) is a fixed anchor bit; the remaining 80
// cells (row-major) carry the 80 bits, MSB-first per byte. Decode with
// `decodeIdenticonAddress(svgText)`.
const ID_B32 = 'abcdefghijkmnpqrstuvwxyz23456789';
function identiconSvg(address, size) {
  size = size || 30;
  const body = (typeof address === 'string' && address.startsWith('aw_'))
    ? address.slice(3) : (address || '');
  // Decode the 16 base32 chars into 10 bytes (80 bits). Unknown chars → 0.
  const bytes = new Uint8Array(10);
  let bits = 0, val = 0, bi = 0;
  for (let i = 0; i < 16 && bi < 10; i++) {
    const idx = ID_B32.indexOf((body[i] || 'a').toLowerCase());
    val = (val << 5) | (idx < 0 ? 0 : idx);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[bi++] = (val >>> bits) & 0xff;
    }
  }
  // Pull bit i (0..79) MSB-first per byte.
  const bit = (i) => (bytes[i >> 3] >>> (7 - (i & 7))) & 1;
  // Hue from byte sum so the same account always uses the same color.
  let sum = 0; for (let i = 0; i < 10; i++) sum += bytes[i];
  const hue = (sum * 7) % 360;
  const fg = `hsl(${hue}, 65%, 52%)`;
  let rects = '';
  // Anchor bit at (0,0) so orientation is recoverable when decoding.
  rects += '<rect x="0" y="0" width="1" height="1"/>';
  for (let i = 0; i < 80; i++) {
    if (bit(i)) {
      const idx = i + 1;
      const x = idx % 9, y = (idx - x) / 9;
      rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 9 9" shape-rendering="crispEdges" fill="${fg}">${rects}</svg>`;
}

// Parse an identicon SVG (or its inner markup) back into the aw_ address.
function decodeIdenticonAddress(svgText) {
  if (!svgText) return null;
  const cells = new Uint8Array(81);
  const re = /<rect[^>]*x="(\d+)"[^>]*y="(\d+)"/g;
  let m;
  while ((m = re.exec(svgText)) !== null) {
    const x = +m[1], y = +m[2];
    if (x >= 0 && x < 9 && y >= 0 && y < 9) cells[y * 9 + x] = 1;
  }
  if (cells[0] !== 1) return null; // anchor missing → not our format
  const bytes = new Uint8Array(10);
  for (let i = 0; i < 80; i++) {
    if (cells[i + 1]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  }
  // Re-encode bytes with the same base32 alphabet the server uses.
  let bits = 0, val = 0, out = '';
  for (let i = 0; i < 10; i++) {
    val = (val << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { bits -= 5; out += ID_B32[(val >>> bits) & 31]; }
  }
  if (bits > 0) out += ID_B32[(val << (5 - bits)) & 31];
  return 'aw_' + out.slice(0, 16);
}
function fmtUsdSmall(n) {
  const usd = (Number(n) || 0) * usdRate();
  if (window.currency && window.currency.format) {
    return window.currency.format(usd, { small: true });
  }
  const v = usd;
  if (v === 0) return '$0.00';
  if (Math.abs(v) >= 0.01) return '$' + v.toFixed(2);
  if (Math.abs(v) >= 0.0001) return '$' + v.toFixed(4);
  return '<$0.0001';
}
function fmtBoth(n)    { return `${fmtCredits(n)} AWC (${fmtUsd(n)})`; }

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const e = new Error(body.error || ('HTTP ' + r.status));
    e.status = r.status; e.body = body;
    throw e;
  }
  return r.json();
}

async function loadConfig() {
  CONFIG = await api('/api/config');
  $('bonusVal').textContent = CONFIG.signupBonus;
  populateCountrySelects();
  refreshKeyFileNameLabels();
}

function keyFileName() {
  const host = (CONFIG && (CONFIG.sshHost || (CONFIG.publicDomain || '').split(':')[0])) || 'airweb';
  const addr = (ME && ME.address) || '<your account id>';
  return host.replace(/[^a-z0-9.-]+/gi, '_') + '_' + addr + '_key.txt';
}

function refreshKeyFileNameLabels() {
  const name = keyFileName();
  document.querySelectorAll('.key-file-name').forEach(el => { el.textContent = name; });
}

// If a URL targets the AirWeb public domain but lacks an explicit port,
// append the port the browser is currently using (skipping defaults 80/443).
// This keeps subdomain links clickable in dev (e.g. http://mysub.lvh.me:8080)
// or behind non-standard reverse proxies. Non-http(s) URLs (tcp://, etc.)
// are returned unchanged.
function withBrowserPort(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (u.port) return rawUrl; // already explicit
    const browserPort = window.location.port;
    if (!browserPort) return rawUrl; // browser is on default port
    if ((u.protocol === 'http:'  && browserPort === '80') ||
        (u.protocol === 'https:' && browserPort === '443')) return rawUrl;
    u.port = browserPort;
    return u.toString().replace(/\/$/, ''); // strip trailing slash URL adds
  } catch { return rawUrl; }
}

async function tryLoadMe() {
  const _isMarket      = /^\/marketplace\/?$/.test(location.pathname);
  const _isConnections = /^\/connections\/?$/.test(location.pathname);
  try {
    ME = await api('/api/me');
    refreshKeyFileNameLabels();
    renderAuthed();
  } catch (e) {
    if (e.status === 401) {
      if (_isConnections) renderGuestConnections();
      else if (_isMarket) renderGuestMarketplace();
      else renderGuest();
    } else console.error(e);
  }
}

function renderGuest() {
  $('guestState').classList.remove('hide');
  $('authState').classList.add('hide');
  $('navBalance').classList.add('hide');
  $('userMenu').classList.add('hide');
  $('settingsMenu').classList.remove('hide');
}

// Public marketplace preview — same listing UI as authed view, but
// hero/metrics/overview tabs are hidden and lease buttons are disabled.
function renderGuestMarketplace() {
  $('guestState').classList.add('hide');
  $('authState').classList.remove('hide');
  $('navBalance').classList.add('hide');
  $('userMenu').classList.add('hide');
  $('settingsMenu').classList.remove('hide');
  $('pageTitle').textContent = 'Marketplace';
  document.title = 'Marketplace — AirWeb';
  $('tabBar').classList.add('hide');
  $('tabOverview').classList.add('hide');
  $('tabMap').classList.add('hide');
  $('tabTransactions').classList.add('hide');
  if ($('tabAdmin')) $('tabAdmin').classList.add('hide');
  $('tabMarketplace').classList.remove('hide');
  refreshMarketplace().catch(e => console.error('market:', e));
}

// Public network-map preview — anyone can see where AirWeb listings are.
function renderGuestConnections() {
  $('guestState').classList.add('hide');
  $('authState').classList.remove('hide');
  $('navBalance').classList.add('hide');
  $('userMenu').classList.add('hide');
  $('settingsMenu').classList.remove('hide');
  $('pageTitle').textContent = 'Connections';
  document.title = 'Connections — AirWeb';
  $('tabBar').classList.add('hide');
  $('tabOverview').classList.add('hide');
  $('tabMarketplace').classList.add('hide');
  $('tabTransactions').classList.add('hide');
  if ($('tabAdmin')) $('tabAdmin').classList.add('hide');
  $('tabMap').classList.remove('hide');
  refreshMap().catch(e => console.error('map:', e));
}

function renderAuthed() {
  // Delegate all header rendering (avatar, balance, short address, USD est.)
  // to header.js so every page shows the same chrome.
  try { window.AirWebHeader && window.AirWebHeader.applyAuthState(ME); } catch (e) {}
  $('guestState').classList.add('hide');
  $('authState').classList.remove('hide');
  // Marketplace-only mode when URL is /marketplace
  const _isMarket      = /^\/marketplace\/?$/.test(location.pathname);
  const _isConnections = /^\/connections\/?$/.test(location.pathname);
  $('tabBar').classList.toggle('hide', _isMarket || _isConnections);
  if (_isMarket) {
    $('pageTitle').textContent = 'Marketplace';
    document.title = 'Marketplace — AirWeb';
    switchTab('marketplace');
  } else if (_isConnections) {
    $('pageTitle').textContent = 'Connections';
    document.title = 'Connections — AirWeb';
    switchTab('map');
  } else {
    $('pageTitle').textContent = 'Dashboard';
  }
  $('addrVal').textContent = ME.address;
  $('tunnelsCount').textContent = ME.onlineTunnels.length;
  $('leasesCount').textContent = ME.activeLeases.length;
  const e = ME.earnings || {};
  // Live "earn rate" = average per-minute uptime credits over the last 24h.
  // Falls back to the configured rate × online tunnel count when no history exists yet.
  const liveAvg = (e.avgPerMinute && e.avgPerMinute > 0)
    ? e.avgPerMinute
    : ME.onlineTunnels.length * (CONFIG.uptimePerMinute || 0);
  $('earnRateVal').innerHTML = fmtCredits(liveAvg) + '<span class="cr">AWC</span>';
  $('earnRateUsd').textContent = fmtUsdSmall(liveAvg);
  $('earn24hVal').textContent = `+${fmtCredits(e.uptime24h || 0)} AWC (${fmtUsd(e.uptime24h || 0)}) in 24h`;
  // Live "charge rate": fall back to instant accruing charges (sum of active
  // lease prices) when the 24h ledger average is still 0 — mirrors the
  // earn-rate fallback so the card actually moves once leases are running.
  const liveLeaseCharge = (ME.activeLeases || []).reduce((s, l) => s + (Number(l.price_per_minute) || 0), 0);
  const chargeRate = Math.max(e.avgChargePerMinute || 0, liveLeaseCharge);
  $('totalChargedVal').innerHTML = fmtCredits(chargeRate) + '<span class="cr">AWC</span>';
  $('totalChargedUsd').textContent = fmtUsdSmall(chargeRate);
  $('charged24hVal').textContent = `\u2212${fmtCredits(e.bandwidth24h || 0)} AWC (${fmtUsd(e.bandwidth24h || 0)}) in 24h`;
  const netRate = (typeof e.avgNetPerMinute === 'number') ? e.avgNetPerMinute : (liveAvg - chargeRate);
  const net24h  = (e.uptime24h || 0) - (e.bandwidth24h || 0);
  const netEl   = $('netMetric');
  const netPositive = netRate >= 0;
  netEl.classList.remove('metric-pos', 'metric-neg');
  netEl.classList.add(netPositive ? 'metric-pos' : 'metric-neg');
  $('netLabel').textContent = netPositive ? 'Earning / min' : 'Consuming / min';
  const sign = netPositive ? '+' : '\u2212';
  $('netRateVal').innerHTML = sign + fmtCredits(Math.abs(netRate)) + '<span class="cr">AWC</span>';
  $('netRateUsd').textContent = (netPositive ? '+' : '\u2212') + fmtUsdSmall(Math.abs(netRate)).replace(/^[-+]/, '');
  const sign24 = net24h >= 0 ? '+' : '\u2212';
  $('net24hVal').textContent = `${sign24}${fmtCredits(Math.abs(net24h))} AWC (${fmtUsd(Math.abs(net24h))}) in 24h`;
  // The Connect-a-Tunnel modal owns its own command rendering (multi-protocol);
  // we just prime its default values from the loaded config.
  if (typeof renderConnectCmd === 'function') renderConnectCmd();
  renderActivity();
  renderAdmin();
  // Per-tab on-demand loads:
  const active = document.querySelector('#tabBar button.active')?.dataset.tab;
  if (active === 'marketplace')  refreshMarketplace();
  if (active === 'transactions') refreshLedger(true);
}

function renderAdmin() {
  const tabBtn = $('adminTabBtn');
  if (!ME.isAdmin) {
    tabBtn.classList.add('hide');
    if (document.querySelector('#tabBar button.active')?.dataset.tab === 'admin') switchTab('overview');
    return;
  }
  tabBtn.classList.remove('hide');
  if (document.querySelector('#tabBar button.active')?.dataset.tab === 'admin') {
    refreshAdmin().catch(e => console.error('admin refresh:', e));
  }
}

const TABS = ['overview', 'map', 'marketplace', 'transactions', 'admin'];
function switchTab(name) {
  if (!TABS.includes(name)) name = 'overview';
  document.querySelectorAll('#tabBar button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $('tabOverview').classList.toggle(    'hide', name !== 'overview');
  $('tabMap').classList.toggle(         'hide', name !== 'map');
  $('tabMarketplace').classList.toggle( 'hide', name !== 'marketplace');
  $('tabTransactions').classList.toggle('hide', name !== 'transactions');
  $('tabAdmin').classList.toggle(       'hide', name !== 'admin');
  if (name === 'map')          refreshMap().catch(e => console.error('map:', e));
  if (name === 'marketplace')  refreshMarketplace().catch(e => console.error('market:', e));
  if (name === 'transactions') refreshLedger(true).catch(e => console.error('ledger:', e));
  if (name === 'admin' && ME && ME.isAdmin) refreshAdmin().catch(e => console.error('admin:', e));
}
document.querySelectorAll('#tabBar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); switchTab(a.dataset.jump); }));

async function refreshAdmin() {
  const data = await api('/api/admin/overview');
  // Tunnels
  const tEl = $('adminTunnels');
  if (!data.tunnels.length) {
    tEl.innerHTML = '<div class="empty">No live tunnels.</div>';
  } else {
    tEl.innerHTML = '<table><thead><tr><th>ID</th><th>Status</th><th>Public URL</th><th>Owner</th><th class="right">Started</th><th></th></tr></thead><tbody>' +
      data.tunnels.map(t => `<tr>
        <td class="mono">${t.id}</td>
        <td>${t.internal ? '<span class="pill">internal</span>' : (t.disabled ? '<span class="pill warn">paused</span>' : '<span class="pill good">' + esc(t.type) + '</span>')}</td>
        <td class="mono">${esc(withBrowserPort(t.publicUrl) || '')}</td>
        <td class="mono reason" style="font-size:.75rem">${esc(t.ownerAddress || '\u2014')}</td>
        <td class="right reason">${timeAgo(t.createdAt)}</td>
        <td class="right" style="white-space:nowrap">
          ${t.internal
            ? '<button class="ghost" disabled title="Internal server">Pause</button> <button class="ghost" disabled title="Internal server">Disconnect</button>'
            : (t.disabled
              ? `<button data-admin-toggle="${t.id}" data-toggle-action="enable">Resume</button>`
              : `<button class="ghost" data-admin-toggle="${t.id}" data-toggle-action="disable">Pause</button>`)
              + ` <button class="ghost" data-disc="${t.id}">Disconnect</button>`}
        </td>
      </tr>`).join('') + '</tbody></table>';
    tEl.querySelectorAll('[data-admin-toggle]').forEach(b => b.onclick = async () => {
      await api('/api/tunnels/' + b.dataset.adminToggle + '/' + b.dataset.toggleAction, { method: 'POST' });
      await refreshAdmin();
    });
    tEl.querySelectorAll('[data-disc]').forEach(b => b.onclick = async () => {
      if (!confirm('Disconnect tunnel ' + b.dataset.disc + '?')) return;
      await api('/api/admin/tunnels/' + b.dataset.disc + '/disconnect', { method: 'POST' });
      await refreshAdmin();
    });
  }
  // Accounts
  const aEl = $('adminAccounts');
  if (!data.accounts.length) {
    aEl.innerHTML = '<div class="empty">No accounts.</div>';
  } else {
    aEl.innerHTML = '<table><thead><tr><th>Account ID</th><th class="right">Credits</th><th>Role</th><th class="right">Created</th><th></th></tr></thead><tbody>' +
      data.accounts.map(a => `<tr>
        <td class="mono" style="font-size:.75rem">${esc(a.address)}</td>
        <td class="right mono"><span class="reason" style="font-size:.7rem; display:block; font-family:var(--sans); font-weight:400">est. ${fmtUsd(a.credits)}</span>${fmtCredits(a.credits)}<span class="unit">AWC</span></td>
        <td>${a.is_admin ? '<span class="pill good">admin</span>' : '<span class="reason">user</span>'}</td>
        <td class="right reason">${timeAgo(a.created_at)}</td>
        <td class="right">
          ${a.address === ME.address
            ? '<span class="reason">you</span>'
            : `<button class="ghost" data-role="${a.address}" data-make="${a.is_admin ? '0' : '1'}">${a.is_admin ? 'Demote' : 'Promote'}</button>`}
        </td>
      </tr>`).join('') + '</tbody></table>';
    aEl.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => {
      const isAdmin = b.dataset.make === '1';
      try {
        await api('/api/admin/accounts/' + b.dataset.role + '/role', { method: 'POST', body: JSON.stringify({ isAdmin }) });
        await refreshAdmin();
      } catch (e) { alert('Could not update role: ' + (e.body && e.body.error || e.message)); }
    });
  }
}

let ACTIVITY_FILTER = 'all';

function renderActivity() {
  const el = $('activityList');
  const onlineTunnels = ME.onlineTunnels || [];
  const allListings   = ME.listings      || [];
  const leases        = ME.activeLeases  || [];

  // Pair each online tunnel with its listing (if any) so they render as a single row.
  const listingByTunnel = new Map();
  for (const l of allListings) {
    if (l.tunnel_id != null) listingByTunnel.set(l.tunnel_id, l);
  }
  const onlineTunnelIds = new Set(onlineTunnels.map(t => t.id));

  const tunnelRows = onlineTunnels.map(t => ({
    kind: 'tunnel', data: t, listing: listingByTunnel.get(t.id) || null,
  }));
  // Listings whose backing tunnel is not currently connected → standalone listing row.
  const orphanListings = allListings
    .filter(l => l.tunnel_id == null || !onlineTunnelIds.has(l.tunnel_id))
    .map(l => ({ kind: 'listing', data: l }));
  const leaseRows = leases.map(l => ({ kind: 'lease', data: l }));

  const all = [...tunnelRows, ...orphanListings, ...leaseRows];

  // Summary line
  const onlineCount  = tunnelRows.length;
  const listingCount = allListings.length;
  const earnRate     = onlineCount * (CONFIG.uptimePerMinute || 0);
  const summary = [
    `${onlineCount} online tunnel${onlineCount===1?'':'s'}`,
    `${listingCount} listing${listingCount===1?'':'s'}`,
    `${leases.length} lease${leases.length===1?'':'s'}`,
    onlineCount ? `earning ${fmtCredits(earnRate)} AWC/min (${fmtUsd(earnRate)}/min)` : null,
  ].filter(Boolean).join(' \u00b7 ');
  $('activitySummary').textContent = summary;

  const rows = all.filter(r => {
    if (ACTIVITY_FILTER === 'all')     return true;
    if (ACTIVITY_FILTER === 'tunnel')  return r.kind === 'tunnel';
    if (ACTIVITY_FILTER === 'listing') return r.kind === 'listing' || (r.kind === 'tunnel' && r.listing);
    if (ACTIVITY_FILTER === 'lease')   return r.kind === 'lease';
    return true;
  });
  if (!rows.length) {
    const msg = ACTIVITY_FILTER === 'tunnel'  ? 'No active tunnels. Run the SSH command above to bring one online.'
              : ACTIVITY_FILTER === 'listing' ? 'No marketplace listings. List a TCP (SSH) or HTTP/HTTPS tunnel from the Tunnels view.'
              : ACTIVITY_FILTER === 'lease'   ? 'You are not leasing anything right now.'
              : 'Nothing here yet. Connect a tunnel using the SSH command above.';
    el.innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }

  el.innerHTML = '<table class="activity-table"><thead><tr><th>Type</th><th>Item</th><th>Details</th><th class="right">Reward</th><th class="right">Charge</th><th>Listed</th><th class="right">Earned</th><th class="right">Leases</th><th class="right">Rate</th><th class="right">Actions</th></tr></thead><tbody>' +
    rows.map(r => activityRow(r)).join('') + '</tbody></table>';

  el.querySelectorAll('[data-list-tunnel]').forEach(b => b.onclick = () => openListModal(Number(b.dataset.listTunnel)));
  el.querySelectorAll('[data-list-help]').forEach(b => b.onclick = () => openHelpListModal());
  el.querySelectorAll('[data-disconnect-tunnel]').forEach(b => b.onclick = async () => {
    if (!confirm('Disconnect this tunnel? The SSH session will be closed.')) return;
    try { await api('/api/tunnels/' + b.dataset.disconnectTunnel + '/disconnect', { method: 'POST' }); }
    catch (e) { alert('Failed to disconnect: ' + (e.body && e.body.error || e.message)); }
    await refresh();
  });
  el.querySelectorAll('[data-toggle-tunnel]').forEach(b => b.onclick = async () => {
    const action = b.dataset.toggleAction;
    await api('/api/tunnels/' + b.dataset.toggleTunnel + '/' + action, { method: 'POST' });
    await refresh();
  });
  el.querySelectorAll('[data-rm-listing]').forEach(b => b.onclick = async () => {
    if (!confirm('Remove this listing?')) return;
    await api('/api/listings/' + b.dataset.rmListing, { method: 'DELETE' });
    await refresh();
  });
  applyActivitySearch();
}

function protoBadge(proto) {
  const p = (proto || 'tcp').toLowerCase();
  // Map the generic transport name 'tcp' to the friendlier 'SSH' label only
  // when no more specific service was supplied. Known services (rdp, mysql,
  // postgres, mongodb, redis, vnc, ssh, http, https) render with their own
  // uppercase label and icon.
  const label = p === 'tcp' ? 'SSH' : p.toUpperCase();
  const icon = PROTO_ICONS[p] || PROTO_ICONS.tcp;
  return `<span class="proto-badge" title="${esc(label)}"><span class="proto-icon">${icon}</span>${esc(label)}</span>`;
}

function typeCell(proto, statusHtml) {
  return `<div class="cell-stack">${protoBadge(proto)}${statusHtml ? '<span class="sub">' + statusHtml + '</span>' : ''}</div>`;
}

function listingStatusCell(l) {
  const proto = (l.protocol || 'tcp').toLowerCase();
  const isWeb = (proto === 'http' || proto === 'https');
  const e = l.earnings || {};
  const termLabel = l.lease_term_minutes ? fmtTermMinutes(l.lease_term_minutes) : '';
  const activePill = e.activeLeaseCount
    ? `<span class="pill warn" title="Currently being leased">${e.activeLeaseCount} active</span>`
    : '';
  return `<div class="cell-stack">
      <span class="badges">
        <span class="pill good" title="On the marketplace">listed</span>
        ${isWeb ? '<span class="pill warn" title="Passcode-gated private access">private</span>' : ''}
        ${l.validated ? '<span class="validated-pill" title="Owner-validated listing">validated</span>' : ''}
        ${activePill}
      </span>
      ${termLabel ? '<span class="sub">term ' + esc(termLabel) + '</span>' : ''}
    </div>`;
}

function listingEarnedCell(l) {
  const e = l.earnings || { totalEarnings:0 };
  return `+${fmtCredits(e.totalEarnings)}<span class="sub">${fmtUsdSmall(e.totalEarnings)}</span>`;
}

function listingLeasesCell(l) {
  const e = l.earnings || { leaseCount:0, avgPerLease:0 };
  if (!e.leaseCount) return '<span class="reason">none</span>';
  return `${e.leaseCount}<span class="sub">avg ${fmtCredits(e.avgPerLease)}</span>`;
}

function removeListingIcon(l) {
  const e = l.earnings || {};
  if (e.activeLeaseCount) {
    return '<button class="ghost icon-btn" disabled title="Cannot remove while a lease is active" style="opacity:.45">\uD83D\uDDD1</button>';
  }
  return `<button class="ghost icon-btn" data-rm-listing="${l.id}" title="Remove listing">\uD83D\uDDD1</button>`;
}

function activityRow(r) {
  if (r.kind === 'tunnel') {
    const t = r.data;
    const listing = r.listing;
    const bytes = humanBytes((t.metrics && t.metrics.bytesIn || 0) + (t.metrics && t.metrics.bytesOut || 0));
    const charged = Number((t.metrics && t.metrics.chargedCredits) || 0);
    // Per-tunnel uptime reward accrued since the SSH session opened.
    // Internal tunnels and tunnels being leased out (paid via lease billing)
    // don't earn the uptime stipend — those show "—".
    const minutesUp = Math.max(0, (Date.now() - (t.createdAt || Date.now())) / 60000);
    const rewarded = (!t.internal && !listing && !t.disabled)
      ? minutesUp * (CONFIG.uptimePerMinute || 0)
      : 0;
    const displayUrl = withBrowserPort(t.publicUrl);
    const linkable = t.type === 'http' && !t.disabled;
    const url = linkable
      ? `<a href="${esc(displayUrl)}" target="_blank" rel="noopener">${esc(displayUrl)}</a>`
      : esc(displayUrl);
    const statusText = t.internal
      ? 'internal'
      : (t.disabled
          ? (t.disabledReason === 'insufficient_credits' ? 'no credits' : 'paused')
          : 'online');
    const tunnelProto = t.service || (listing && listing.protocol) || t.type;
    const typeHtml = typeCell(tunnelProto, statusText);
    const toggleBtn = t.internal
      ? `<button class="ghost" disabled title="Internal server \u2014 managed by AirWeb">Pause</button>`
      : (t.disabled
          ? `<button data-toggle-tunnel="${t.id}" data-toggle-action="enable" title="Resume public access">Resume</button>`
          : (listing
              ? `<button class="ghost" disabled title="This tunnel has an active marketplace listing \u2014 remove the listing first">Pause</button>`
              : `<button class="ghost" data-toggle-tunnel="${t.id}" data-toggle-action="disable" title="Pause public access without disconnecting">Pause</button>`));
    const disconnectBtn = t.internal
      ? `<button class="ghost icon-btn" disabled title="Internal server \u2014 cannot be disconnected" style="opacity:.45">\u2715</button>`
      : `<button class="ghost icon-btn" data-disconnect-tunnel="${t.id}" title="Disconnect this tunnel" style="font-weight:700; color:var(--bad,#ff6b6b)">\u2715</button>`;
    const listBtn = t.internal
      ? `<button class="ghost" disabled title="Internal server \u2014 cannot be listed">List</button>`
      : (!listing && t.listable && !t.disabled
          ? `<button data-list-tunnel="${t.id}" title="List this tunnel on the marketplace">List</button>`
          : (!listing && !t.listable
              ? `<button class="ghost" data-list-help="1" title="Why is this not listable?">List?</button>`
              : ''));
    const removeListingBtn = listing ? removeListingIcon(listing) : '';

    const listedCell  = t.internal
      ? '<span class="reason">internal</span>'
      : (listing
          ? listingStatusCell(listing)
          : (t.listable
              ? (t.disabled ? '<span class="reason">resume to list</span>' : '<span class="reason">not listed</span>')
              : '<span class="reason">not listable</span>'));
    const earnedCell  = listing ? listingEarnedCell(listing) : '<span class="reason">\u2014</span>';
    const leasesCell  = listing ? listingLeasesCell(listing) : '<span class="reason">\u2014</span>';
    const rateCell    = listing
      ? `${fmtCredits(CONFIG.uptimePerMinute || 0)}<span class="sub">listed ${fmtCredits(listing.price_per_minute)}/min</span>`
      : `${fmtCredits(CONFIG.uptimePerMinute || 0)}<span class="sub">AWC/min</span>`;

    const rewardCell = t.internal
      ? '<span class="reason">internal</span>'
      : (listing
          ? '<span class="reason">\u2014</span>'
          : `<span style="color:var(--accent)">+${rewarded.toFixed(4)}</span><span class="sub">${fmtUsdSmall(rewarded)}</span>`);
    const chargeCell = t.internal
      ? '<span class="reason">internal</span>'
      : `<span style="color:var(--bad)" title="Bandwidth charged so far">\u2212${charged.toFixed(4)}</span><span class="sub">${fmtUsdSmall(charged)}</span>`;

    return `<tr>
      <td>${typeHtml}</td>
      <td class="mono wrap">${url}<span class="sub">id #${t.id}</span></td>
      <td class="reason">${bytes}<span class="sub">${timeAgo(t.createdAt)}</span></td>
      <td class="right reason">${rewardCell}</td>
      <td class="right reason">${chargeCell}</td>
      <td>${listedCell}</td>
      <td class="right">${earnedCell}</td>
      <td class="right">${leasesCell}</td>
      <td class="right reason">${rateCell}</td>
      <td class="right">${toggleBtn} ${listBtn} ${removeListingBtn} ${disconnectBtn}</td>
    </tr>`;
  }
  if (r.kind === 'listing') {
    const l = r.data;
    return `<tr>
      <td>${typeCell(l.protocol, 'offline')}</td>
      <td class="wrap"><strong>${esc(l.title)}</strong>${l.country_code ? ' <span class="flag">' + flagFor(l.country_code) + '</span>' : ''}<span class="sub">${esc(l.description || '')}</span></td>
      <td class="reason">${esc(specSummary(l))}<span class="sub">tunnel offline</span></td>
      <td class="right reason">\u2014</td>
      <td class="right reason">\u2014</td>
      <td>${listingStatusCell(l)}</td>
      <td class="right">${listingEarnedCell(l)}</td>
      <td class="right">${listingLeasesCell(l)}</td>
      <td class="right reason">${fmtCredits(l.price_per_minute)}<span class="sub">AWC/min</span></td>
      <td class="right">${removeListingIcon(l)}</td>
    </tr>`;
  }
  // lease
  const l = r.data;
  const isWeb = l.protocol === 'http' || l.protocol === 'https';
  const expiresLabel = l.expiresAt ? `expires ${timeUntil(l.expiresAt)}` : '';
  const accessSub = isWeb && l.passcode
    ? `passcode <code class="inline" style="font-weight:600">${esc(l.passcode)}</code>${l.accessUrl ? ' \u00b7 <a href="' + esc(withBrowserPort(l.accessUrl)) + '" target="_blank" rel="noopener">open</a>' : ''}${expiresLabel ? ' \u00b7 ' + esc(expiresLabel) : ''}`
    : (expiresLabel ? esc(expiresLabel) : '');
  const leaseCharge = Number(l.total_credits) || 0;
  return `<tr>
    <td>${typeCell(l.protocol, 'lease')}</td>
    <td class="wrap"><strong>${esc(l.title || ('lease ' + l.id))}</strong><span class="sub mono">${esc(l.owner_address || '')}</span>${accessSub ? '<span class="sub">' + accessSub + '</span>' : ''}</td>
    <td class="reason">spent ${fmtCredits(l.total_credits)} AWC</td>
    <td class="right reason">\u2014</td>
    <td class="right reason"><span style="color:var(--bad)">\u2212${leaseCharge.toFixed(4)}</span><span class="sub">${fmtUsdSmall(leaseCharge)}</span></td>
    <td class="reason">\u2014</td>
    <td class="right reason">\u2014</td>
    <td class="right reason">\u2014</td>
    <td class="right reason">${fmtCredits(l.price_per_minute)}<span class="sub">AWC/min</span></td>
    <td class="right reason">\u2014</td>
  </tr>`;
}

function timeUntil(ts) {
  const diff = (ts || 0) - Date.now();
  if (diff <= 0) return 'expired';
  const m = Math.round(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  if (m < 1440) return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
  const d = Math.floor(m / 1440); const hh = Math.floor((m % 1440) / 60);
  return hh ? `in ${d}d ${hh}h` : `in ${d}d`;
}

document.querySelectorAll('#activityFilter button').forEach(b => b.addEventListener('click', () => {
  ACTIVITY_FILTER = b.dataset.act;
  document.querySelectorAll('#activityFilter button').forEach(x => x.classList.toggle('active', x === b));
  renderActivity();
  applyActivitySearch();
}));

// Client-side dynamic search across rendered rows.
function applyActivitySearch() {
  const q = ($('activitySearch').value || '').trim().toLowerCase();
  const rows = document.querySelectorAll('#activityList tbody tr');
  rows.forEach(tr => {
    if (!q) { tr.style.display = ''; return; }
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
$('activitySearch').addEventListener('input', applyActivitySearch);

// ---- Connect-a-tunnel modal --------------------------------------------
const PROTO_ICONS = {
  http:    '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 8h12M8 2c2 1.8 2 10.2 0 12M8 2c-2 1.8-2 10.2 0 12" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
  https:   '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  ssh:     '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 6.5l2 1.5-2 1.5M7.5 10h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rdp:     '<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 14h6M8 11.5v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  mysql:   '<svg viewBox="0 0 16 16"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 3.5v9c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-9M2.5 8c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  postgres:'<svg viewBox="0 0 16 16"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 3.5v9c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-9M2.5 8c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  mongodb: '<svg viewBox="0 0 16 16"><path d="M8 1c-1 4-3 7-3 9.5C5 13 6.5 14 8 14s3-1 3-3.5C11 8 9 5 8 1Z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 14v1.5" stroke="currentColor" stroke-width="1.2"/></svg>',
  redis:   '<svg viewBox="0 0 16 16"><path d="M2 4c0 1.1 2.7 2 6 2s6-.9 6-2-2.7-2-6-2-6 .9-6 2Zm0 4c0 1.1 2.7 2 6 2s6-.9 6-2M2 12c0 1.1 2.7 2 6 2s6-.9 6-2M2 4v8m12-8v8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  vnc:     '<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="7" r="1.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 14h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  tcp:     '<svg viewBox="0 0 16 16"><path d="M2 8h12M4 5l-2 3 2 3M12 5l2 3-2 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const PROTO_DEFS = {
  http: {
    label: 'HTTP',
    desc:  'Expose a local web app over plain HTTP. Best for quick demos and dev previews.',
    defaultLocalPort: 3000,
    remoteForward: '80',
    needsLocalPort: true,
    endpoint: (sub, host, scheme, port) => buildHttpUrl(sub, host, scheme, port, false),
  },
  https: {
    label: 'HTTPS',
    desc:  'Expose a local web app over TLS. Requires the AirWeb server to be configured with HTTPS (public scheme = https).',
    defaultLocalPort: 3000,
    remoteForward: '80',
    needsLocalPort: true,
    endpoint: (sub, host, scheme, port) => buildHttpUrl(sub, host, scheme, port, true),
  },
  // Raw-TCP protocols: request remote port 0 so the AirWeb server allocates a
  // free public port from its configured tcpPortRange. Hardcoding well-known
  // ports (22, 3389, 3306, ...) is pointless — they sit outside the range and
  // the server silently reassigns them anyway, leaving the displayed endpoint
  // wrong. Using 0 makes the assignment explicit and avoids collisions when
  // multiple users tunnel the same service.
  ssh: {
    label: 'SSH',
    desc:  'Expose your local SSH server (port 22) as a raw TCP tunnel. The public port is assigned by the server on connect. Required for marketplace listings — buyers SSH straight into the box.',
    defaultLocalPort: 22,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `ssh -p <assigned> user@${host}`,
  },
  rdp: {
    label: 'RDP',
    desc:  'Expose Windows Remote Desktop (port 3389) as a raw TCP tunnel. The public port is assigned by the server on connect — see the tunnel card once connected.',
    defaultLocalPort: 3389,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
  mysql: {
    label: 'MySQL',
    desc:  'Expose a local MySQL/MariaDB server (port 3306) as a raw TCP tunnel. The public port is assigned by the server on connect.',
    defaultLocalPort: 3306,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
  postgres: {
    label: 'PostgreSQL',
    desc:  'Expose a local PostgreSQL server (port 5432) as a raw TCP tunnel. The public port is assigned by the server on connect.',
    defaultLocalPort: 5432,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
  mongodb: {
    label: 'MongoDB',
    desc:  'Expose a local MongoDB server (port 27017) as a raw TCP tunnel. The public port is assigned by the server on connect.',
    defaultLocalPort: 27017,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
  redis: {
    label: 'Redis',
    desc:  'Expose a local Redis server (port 6379) as a raw TCP tunnel. The public port is assigned by the server on connect.',
    defaultLocalPort: 6379,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
  vnc: {
    label: 'VNC',
    desc:  'Expose a local VNC server (port 5900) as a raw TCP tunnel. The public port is assigned by the server on connect.',
    defaultLocalPort: 5900,
    remoteForward: '0',
    needsLocalPort: false,
    endpoint: (sub, host) => `${host}:<assigned>`,
  },
};

function buildHttpUrl(sub, host, scheme, browserPort, forceHttps) {
  const proto = forceHttps ? 'https' : scheme;
  let url = `${proto}://${sub}.${host}`;
  // Append browser port for dev (non-default ports), matching withBrowserPort behavior.
  if (browserPort && browserPort !== '80' && browserPort !== '443'
      && !host.includes(':') && (proto === 'http' || proto === 'https')) {
    url += `:${browserPort}`;
  }
  return url;
}

function renderConnectCmd() {
  const proto = $('protoSelect').value || 'http';
  const def = PROTO_DEFS[proto];
  const allowCustom = CONFIG.allowCustomSubdomains !== false;
  // When custom subdomains are disabled, the SSH username is ignored for
  // subdomain assignment — the server picks a random one. Use a fixed token
  // so the example doesn't suggest the input matters.
  const sub = allowCustom
    ? (($('protoSub').value || 'mysub').trim().replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'mysub')
    : 'tunnel';
  const localPort = Math.max(1, Math.min(65535, Number($('protoLocalPort').value) || def.defaultLocalPort));
  const remote = def.remoteForward || String(localPort);
  const sshHost = CONFIG.sshHost || (CONFIG.publicDomain || '').split(':')[0];
  const publicHost = CONFIG.publicDomain || sshHost;
  const scheme = CONFIG.publicScheme || 'http';
  const browserPort = window.location.port;
  const keyName = keyFileName();

  // Toggle local-port input visibility for fixed-port protocols.
  $('protoLocalPortWrap').style.display = def.needsLocalPort ? '' : 'none';
  // Hide the subdomain picker (and show the explanatory note) when the server
  // forbids client-chosen subdomains.
  const subWrap = $('protoSubWrap');
  if (subWrap) subWrap.style.display = allowCustom ? '' : 'none';
  const lockedNote = $('protoSubLockedNote');
  if (lockedNote) lockedNote.style.display = allowCustom ? 'none' : '';

  $('protoDesc').textContent = def.desc;
  const endpointSub = allowCustom ? sub : '<random>';
  $('protoEndpointVal').textContent = def.endpoint(endpointSub, publicHost, scheme, browserPort, localPort);

  // Compose the SSH command, mirroring keyFileName() / sshPort logic.
  const cmd = `ssh -i ./${keyName} -p ${CONFIG.sshPort} -R ${remote}:localhost:${localPort} ${sub}@${sshHost}`;
  const pre = $('sshExample');
  pre.textContent = cmd;
  const btn = $('sshExampleCopy');
  btn.onclick = async () => {
    btn.textContent = (await copyText(cmd)) ? 'Copied!' : 'Failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  };
}

function setProto(proto) {
  const sel = $('protoSelect');
  if (sel) sel.value = proto;
  const def = PROTO_DEFS[proto];
  // Reset local port to the protocol's typical default when user picks a new protocol.
  if (def && def.defaultLocalPort) $('protoLocalPort').value = def.defaultLocalPort;
  renderConnectCmd();
}

function openConnectModal() {
  // Hide HTTPS option when server isn't configured for it.
  const scheme = (CONFIG && CONFIG.publicScheme) || 'http';
  const httpsOpt = $('protoSelect').querySelector('option[value="https"]');
  if (httpsOpt) httpsOpt.hidden = (scheme !== 'https');
  // If the currently-selected option is hidden, fall back to HTTP.
  const cur = $('protoSelect').value;
  if (cur === 'https' && scheme !== 'https') setProto('http');
  else setProto(cur || 'http');
  $('connectModal').classList.add('open');
}
function closeConnectModal() { $('connectModal').classList.remove('open'); }
$('openConnectBtn').onclick = openConnectModal;
$('connectClose').onclick = closeConnectModal;
$('connectModal').addEventListener('click', (e) => {
  if (e.target.id === 'connectModal') closeConnectModal();
});
document.querySelectorAll('#protoTabs .proto-tab').forEach(tab => {
  tab.addEventListener('click', () => setProto(tab.dataset.proto));
});
$('protoSelect').addEventListener('change', () => setProto($('protoSelect').value));
$('protoSub').addEventListener('input', renderConnectCmd);
$('protoLocalPort').addEventListener('input', renderConnectCmd);

// ----- Custom proto picker (icon dropdown wrapping a <select>) -----
// Keeps the underlying <select> as the value source so existing
// `.value` reads and `change` listeners continue to work.
function enhanceProtoSelect(selectId, opts) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.enhanced) return;
  sel.dataset.enhanced = '1';

  const wrap = document.createElement('div');
  wrap.className = 'proto-picker' + ((opts && opts.full) ? ' full' : '');
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'proto-picker-trigger';
  trigger.innerHTML = '<span class="proto-icon" aria-hidden="true"></span><span class="label"></span><span class="caret">\u25BE</span>';
  wrap.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'proto-picker-menu';
  menu.setAttribute('role', 'listbox');
  wrap.appendChild(menu);

  function rebuildOptions() {
    menu.innerHTML = '';
    Array.from(sel.options).forEach(opt => {
      const row = document.createElement('div');
      row.className = 'proto-picker-option' + (opt.value === sel.value ? ' selected' : '') + (opt.hidden ? ' hidden' : '');
      row.dataset.value = opt.value;
      row.setAttribute('role', 'option');
      const icon = opt.value && PROTO_ICONS[opt.value] ? PROTO_ICONS[opt.value] : '';
      row.innerHTML = `<span class="proto-icon" aria-hidden="true">${icon}</span><span>${opt.textContent}</span>`;
      row.addEventListener('click', () => {
        if (sel.value === opt.value) { close(); return; }
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        close();
        updateTrigger();
      });
      menu.appendChild(row);
    });
  }
  function updateTrigger() {
    const opt = sel.options[sel.selectedIndex];
    const labelEl = trigger.querySelector('.label');
    const iconEl = trigger.querySelector('.proto-icon');
    const v = sel.value;
    labelEl.textContent = opt ? opt.textContent : '';
    const iconSvg = v && PROTO_ICONS[v] ? PROTO_ICONS[v] : '';
    iconEl.innerHTML = iconSvg;
    iconEl.style.display = iconSvg ? '' : 'none';
    // refresh selected/hidden state in menu
    menu.querySelectorAll('.proto-picker-option').forEach(row => {
      row.classList.toggle('selected', row.dataset.value === v);
      const o = Array.from(sel.options).find(o => o.value === row.dataset.value);
      row.classList.toggle('hidden', !!(o && o.hidden));
    });
  }
  function open() { rebuildOptions(); updateTrigger(); wrap.classList.add('open'); }
  function close() { wrap.classList.remove('open'); }
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (wrap.classList.contains('open')) close(); else open();
  });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // Reflect programmatic changes (setProto, setProto on init, etc.)
  sel.addEventListener('change', updateTrigger);

  rebuildOptions();
  updateTrigger();
}

enhanceProtoSelect('protoSelect');
enhanceProtoSelect('mfProto');

// ---- Marketplace tab ----------------------------------------------------
function specSummary(l) {
  const bits = [];
  if (l.cpuCores || l.cpu_cores) bits.push((l.cpuCores || l.cpu_cores) + ' cores');
  if (l.cpuModel || l.cpu_model) bits.push(l.cpuModel || l.cpu_model);
  if (l.ramGb || l.ram_gb) bits.push((l.ramGb || l.ram_gb) + ' GB RAM');
  if (l.diskGb || l.disk_gb) bits.push((l.diskGb || l.disk_gb) + ' GB disk');
  if (l.bandwidthMbps || l.bandwidth_mbps) bits.push((l.bandwidthMbps || l.bandwidth_mbps) + ' Mbps');
  if (l.os) bits.push(l.os);
  return bits.join(' \u00b7 ') || '\u2014';
}

function flagFor(cc) {
  if (!cc || cc.length !== 2) return '';
  return cc.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('');
}

const COUNTRY_LIST = [
  ['US','United States'],['CA','Canada'],['MX','Mexico'],['BR','Brazil'],['AR','Argentina'],
  ['GB','United Kingdom'],['IE','Ireland'],['FR','France'],['DE','Germany'],['NL','Netherlands'],
  ['ES','Spain'],['IT','Italy'],['SE','Sweden'],['NO','Norway'],['FI','Finland'],['PL','Poland'],
  ['CH','Switzerland'],['AT','Austria'],['CZ','Czechia'],['UA','Ukraine'],['RU','Russia'],
  ['TR','Turkey'],['IL','Israel'],['AE','UAE'],['SA','Saudi Arabia'],
  ['IN','India'],['CN','China'],['HK','Hong Kong'],['TW','Taiwan'],['JP','Japan'],
  ['KR','South Korea'],['SG','Singapore'],['MY','Malaysia'],['ID','Indonesia'],['TH','Thailand'],
  ['VN','Vietnam'],['PH','Philippines'],['AU','Australia'],['NZ','New Zealand'],
  ['ZA','South Africa'],['NG','Nigeria'],['KE','Kenya'],['EG','Egypt'],
];
function populateCountrySelects() {
  const opts = ['<option value="">Any</option>']
    .concat(COUNTRY_LIST.map(([c, n]) => `<option value="${c}">${flagFor(c)} ${esc(n)} (${c})</option>`))
    .join('');
  if ($('mfCountry')) $('mfCountry').innerHTML = opts;
  if ($('lmCountry')) $('lmCountry').innerHTML = '<option value="">\u2014</option>' +
    COUNTRY_LIST.map(([c, n]) => `<option value="${c}">${flagFor(c)} ${esc(n)} (${c})</option>`).join('');
}

function buildMarketQuery() {
  const params = new URLSearchParams();
  const set = (k, v) => { if (v !== '' && v != null) params.set(k, v); };
  set('q',        $('mfQ').value.trim());
  // Backend stores listings under three logical protocols (tcp/http/https);
  // map UI service choices onto those.
  const mfProto = $('mfProto').value;
  const protoMap = { ssh: 'tcp', rdp: 'tcp', mysql: 'tcp', postgres: 'tcp', mongodb: 'tcp', redis: 'tcp', vnc: 'tcp', http: 'http', https: 'https' };
  set('protocol', mfProto ? (protoMap[mfProto] || mfProto) : '');
  set('country',  $('mfCountry').value);
  set('minCores', $('mfMinCores').value);
  set('minRam',   $('mfMinRam').value);
  const maxPriceRaw = parseFloat($('mfMaxPrice').value);
  if (!isNaN(maxPriceRaw) && maxPriceRaw < 10) set('maxPrice', maxPriceRaw);
  set('os',       $('mfOs').value.trim());
  const s = params.toString();
  return s ? ('?' + s) : '';
}

/* ============================================================
   Network Map — equirectangular projection of listings/tunnels
   ============================================================ */
// Rough continent outlines in equirectangular projection
// (viewBox is 0..1000 x 0..500: x=(lon+180)/360*1000, y=(90-lat)/180*500)
const WORLD_LAND_POLYS = [
  // North America
  '28,61 55,50 222,50 278,22 333,50 361,83 333,111 278,167 222,200 181,167 153,139 125,97',
  // Central America bridge
  '222,200 240,205 255,215 245,228 232,222 222,200',
  // Greenland
  '380,30 425,25 440,55 410,72 385,55',
  // South America
  '272,217 300,217 347,236 403,264 389,319 339,347 306,403 283,389 272,333 283,292',
  // Europe
  '472,150 500,144 528,139 578,139 611,128 639,97 611,61 556,50 514,83 472,97',
  // British Isles
  '478,118 488,112 492,124 482,132',
  // Iceland
  '466,80 478,75 484,85 472,90',
  // Africa
  '450,208 472,161 528,153 583,161 611,208 639,217 644,264 611,306 583,347 556,347 528,292 486,236',
  // Madagascar
  '648,322 658,318 666,338 656,348',
  // Asia (main)
  '578,139 611,128 639,97 667,42 750,33 889,42 972,61 972,97 931,133 875,153 889,194 861,236 819,272 778,236 750,194 722,194 708,222 694,181 667,181 625,217 625,167 611,161 597,153',
  // Arabian peninsula
  '611,208 644,213 650,236 622,244 614,225',
  // India
  '722,194 740,210 745,232 728,242 712,222',
  // SE Asia / Indonesia archipelago (blobs)
  '778,255 808,250 822,265 805,278 782,272',
  '825,272 855,268 868,282 845,290 828,282',
  '870,272 895,268 905,282 882,290',
  // Japan
  '900,140 920,128 930,150 912,162',
  // Philippines
  '850,225 860,220 868,238 855,245',
  // Australia
  '819,300 870,295 905,308 925,330 905,355 855,358 819,348',
  // Tasmania
  '880,372 895,370 898,383 882,385',
  // New Zealand
  '945,355 958,353 965,372 950,378',
  // Antarctica strip
  '0,431 1000,431 1000,486 0,486',
];
function renderWorldLand() {
  const g = $('worldLand');
  if (!g || g.dataset.ready === '1') return;
  g.innerHTML = WORLD_LAND_POLYS.map(p => `<polygon points="${p}"/>`).join('');
  g.dataset.ready = '1';
}

// Approximate country centroids [lon, lat]
const COUNTRY_CENTROIDS = {
  US:[-98.5,39.8], CA:[-106.3,56.1], MX:[-102.5,23.6], BR:[-51.9,-14.2], AR:[-63.6,-38.4],
  GB:[-1.5,54.0],  IE:[-7.7,53.1],   FR:[2.2,46.2],    DE:[10.4,51.2],   NL:[5.3,52.1],
  ES:[-3.7,40.5],  IT:[12.6,42.5],   SE:[18.6,60.1],   NO:[8.5,60.5],    FI:[26.0,61.9],
  PL:[19.1,52.0],  CH:[8.2,46.8],    AT:[14.6,47.5],   CZ:[15.5,49.8],   UA:[31.2,48.4],
  RU:[105.3,61.5], TR:[35.2,38.9],   IL:[34.9,31.0],   AE:[53.8,23.4],   SA:[45.1,23.9],
  IN:[78.9,20.6],  CN:[104.2,35.9],  HK:[114.2,22.3],  TW:[120.9,23.7],  JP:[138.3,36.2],
  KR:[127.8,36.0], SG:[103.8,1.35],  MY:[101.9,4.2],   ID:[113.9,-0.8],  TH:[100.9,15.9],
  VN:[108.3,14.1], PH:[121.8,12.9],  AU:[133.8,-25.3], NZ:[172.0,-41.0],
  ZA:[22.9,-30.6], NG:[8.7,9.1],     KE:[37.9,-0.0],   EG:[30.8,26.8],
};
function lonLatToXY(lon, lat) {
  return [ (lon + 180) / 360 * 1000, (90 - lat) / 180 * 500 ];
}

let MAP_FILTER = 'all';
let MAP_LAST_ITEMS = null;
let MAP_LAST_TUNNELS = null;
async function refreshMap() {
  renderWorldLand();
  // Cache for filter switches without refetch
  try {
    const { items } = await api('/api/listings');
    MAP_LAST_ITEMS = items || [];
  } catch (e) { MAP_LAST_ITEMS = MAP_LAST_ITEMS || []; }
  MAP_LAST_TUNNELS = (ME && ME.onlineTunnels) || [];
  renderMap();
}
function renderMap() {
  const g = $('mapDots'); if (!g) return;
  const filter = MAP_FILTER;
  const points = [];
  if (filter !== 'mine') {
    for (const it of (MAP_LAST_ITEMS || [])) {
      const cc = (it.countryCode || '').toUpperCase();
      const c = COUNTRY_CENTROIDS[cc]; if (!c) continue;
      points.push({
        kind: 'listing',
        lon: c[0], lat: c[1],
        title: it.title || '(untitled)',
        meta: `${(it.protocol || 'tcp').toUpperCase()} · ${cc}${it.tunnelOnline ? ' · online' : ' · offline'}`,
        owner: it.owner || '',
      });
    }
  }
  if (filter !== 'listings') {
    for (const l of (ME && ME.listings) || []) {
      const cc = (l.countryCode || '').toUpperCase();
      const c = COUNTRY_CENTROIDS[cc]; if (!c) continue;
      points.push({
        kind: 'mine',
        lon: c[0], lat: c[1],
        title: l.title || ('Tunnel ' + (l.id || '')),
        meta: `${(l.protocol || 'tcp').toUpperCase()} · ${cc}${l.tunnelOnline ? ' · online' : ' · offline'}`,
        owner: 'you',
      });
    }
  }
  // Deterministic jitter for multiple points in the same country
  const counts = {};
  const out = [];
  for (const p of points) {
    const k = p.lon + ',' + p.lat;
    const n = counts[k] = (counts[k] || 0) + 1;
    let dx = 0, dy = 0;
    if (n > 1) {
      const angle = ((n - 1) * 137.508) * Math.PI / 180; // golden-angle
      const r = 4 + Math.sqrt(n) * 2.2;
      dx = Math.cos(angle) * r;
      dy = Math.sin(angle) * r;
    }
    const [x, y] = lonLatToXY(p.lon, p.lat);
    out.push({ ...p, x: x + dx, y: y + dy });
  }
  g.innerHTML = out.map((p, i) => `
    <circle class="dot-pulse${p.kind === 'mine' ? ' mine' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3"/>
    <circle class="${p.kind === 'mine' ? 'dot-mine' : 'dot-listing'}" data-i="${i}"
            cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/>
  `).join('');
  // Tooltip wiring
  const tip = $('mapTip');
  const wrap = $('mapWrap');
  g.querySelectorAll('circle[data-i]').forEach(c => {
    c.addEventListener('mouseenter', (e) => {
      const p = out[+c.dataset.i]; if (!p) return;
      tip.innerHTML = `<div class="mt-title">${esc(p.title)}</div><div class="mt-meta">${esc(p.meta)}${p.owner ? ' · ' + esc(p.owner) : ''}</div>`;
      tip.classList.remove('hide');
    });
    c.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left + 10;
      const y = e.clientY - r.top  + 10;
      tip.style.left = Math.min(x, r.width  - 250) + 'px';
      tip.style.top  = Math.min(y, r.height - 60)  + 'px';
    });
    c.addEventListener('mouseleave', () => tip.classList.add('hide'));
  });
  $('mapEmpty').classList.toggle('hide', out.length > 0);
  const ls = out.filter(p => p.kind === 'listing').length;
  const ms = out.filter(p => p.kind === 'mine').length;
  $('mapSummary').textContent = `${ls} listing${ls === 1 ? '' : 's'} · ${ms} of yours`;
}
// Filter button wiring (deferred until DOM ready below)
function wireMapFilter() {
  const bar = $('mapFilter'); if (!bar) return;
  bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    bar.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    MAP_FILTER = b.dataset.mf || 'all';
    renderMap();
  }));
}
wireMapFilter();

async function refreshMarketplace() {
  const qs = buildMarketQuery();
  const { items } = await api('/api/listings' + qs);
  $('marketCount').textContent = items.length + ' result' + (items.length === 1 ? '' : 's');
  const el = $('marketList');
  if (!items.length) { el.innerHTML = '<div class="empty">No listings match your filters.</div>'; return; }
  el.innerHTML = items.map(it => {
    const proto = (it.protocol || 'tcp').toLowerCase();
    const protoLabel = proto === 'tcp' ? 'SSH' : proto.toUpperCase();
    const isWeb = (proto === 'http' || proto === 'https');
    const termLabel = it.leaseTermMinutes ? fmtTermMinutes(it.leaseTermMinutes) : '';
    return `
    <div class="node-card">
      <div style="display:flex; align-items:center; gap:.6rem; flex-wrap:wrap">
        <h3 style="margin:0">${esc(it.title)}</h3>
        <span class="proto-badge" title="${esc(protoLabel)}"><span class="proto-icon">${PROTO_ICONS[proto] || PROTO_ICONS.tcp}</span>${esc(protoLabel)}</span>
        ${isWeb ? '<span class="pill warn" title="Passcode-gated private access">private</span>' : ''}
        ${it.countryCode ? '<span class="flag" title="' + esc(it.countryCode) + '">' + flagFor(it.countryCode) + '</span>' : ''}
        ${it.tunnelOnline ? '<span class="pill good">online</span>' : '<span class="pill off">offline</span>'}
        ${it.validated ? '<span class="validated-pill">SSH validated</span>' : ''}
        <span style="margin-left:auto; text-align:right">
          <strong>${fmtCredits(it.pricePerMinute)}<span class="unit">AWC/min</span></strong>
          <br><span class="reason" style="font-size:.75rem">${fmtUsd(it.pricePerMinute)}/min${termLabel ? ' · ' + esc(termLabel) + ' term' : ''}</span>
        </span>
      </div>
      <p style="margin:.4rem 0; color:var(--mute)">${esc(it.description || '')}</p>
      <div class="specs">
        ${it.cpuCores ? '<span class="spec"><strong>' + it.cpuCores + '</strong> cores</span>' : ''}
        ${it.ramGb   ? '<span class="spec"><strong>' + it.ramGb   + '</strong> GB RAM</span>' : ''}
        ${it.diskGb  ? '<span class="spec"><strong>' + it.diskGb  + '</strong> GB disk</span>' : ''}
        ${it.bandwidthMbps ? '<span class="spec"><strong>' + it.bandwidthMbps + '</strong> Mbps</span>' : ''}
        ${it.os      ? '<span class="spec">' + esc(it.os) + '</span>' : ''}
        ${it.cpuModel? '<span class="spec">' + esc(it.cpuModel) + '</span>' : ''}
        ${it.ipAddress && !isWeb ? '<span class="spec">IP ' + esc(it.ipAddress) + '</span>' : ''}
        <span class="spec" style="border-color:transparent">by <span class="mono">${esc(it.owner)}</span></span>
      </div>
      <div style="text-align:right">
        ${!ME
          ? '<button class="ghost" disabled title="Sign in required to lease">Lease</button>'
          : (it.owner === ME.address
              ? '<span class="reason">your listing</span>'
              : (it.tunnelOnline
                  ? '<button data-lease="' + it.id + '">Lease</button>'
                  : '<button class="ghost" disabled title="This connection is offline">Lease</button>'))}
      </div>
    </div>
  `;
  }).join('');
  el.querySelectorAll('[data-lease]').forEach(b => b.onclick = async () => {
    const card = b.closest('.node-card');
    const id = b.dataset.lease;
    const it = items.find(x => String(x.id) === String(id));
    if (it) {
      const term = it.leaseTermMinutes || 60;
      const total = (it.pricePerMinute || 0) * term;
      const msg = `Confirm lease:\n\n` +
        `${it.title}\n` +
        `${fmtCredits(it.pricePerMinute)} AWC/min × ${fmtTermMinutes(term)}\n` +
        `Total (prepaid now): ${fmtCredits(total)} AWC (${fmtUsd(total)})\n\n` +
        `This amount will be charged immediately from your balance.`;
      if (!confirm(msg)) return;
    }
    try {
      const lease = await api('/api/listings/' + id + '/lease', { method: 'POST' });
      await refresh();
      if (lease && lease.passcode) {
        showLeaseGrantedModal(lease);
      } else {
        switchTab('overview');
      }
    } catch (e) { alert('Could not lease: ' + (e.body && e.body.error || e.message)); }
  });
}

function fmtTermMinutes(m) {
  if (!m) return '';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), rem = m % 60;
  if (m < 1440) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(m / 1440); const hh = Math.floor((m % 1440) / 60);
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

function showLeaseGrantedModal(lease) {
  const expires = lease.expiresAt ? new Date(lease.expiresAt) : null;
  const expiresStr = expires ? expires.toLocaleString() : '—';
  const publicUrl = withBrowserPort(lease.publicUrl);
  const accessUrl = withBrowserPort(lease.accessUrl);
  const lines = [];
  lines.push(`Lease started. Passcode: ${lease.passcode}`);
  if (publicUrl) lines.push(`URL: ${publicUrl}`);
  if (accessUrl) lines.push(`One-click access: ${accessUrl}`);
  lines.push(`Expires: ${expiresStr}`);
  // Use the lightweight built-in alert; the dashboard's Overview row also
  // shows the passcode persistently for the duration of the lease.
  alert(lines.join('\n\n'));
  switchTab('overview');
}

// ---- Transactions tab ---------------------------------------------------
let LEDGER_OFFSET = 0;
let LEDGER_ROWS = [];
let LEDGER_FILTERS = {};

function buildLedgerQuery(offset, limit) {
  const p = new URLSearchParams();
  p.set('offset', offset);
  p.set('limit',  limit);
  for (const [k, v] of Object.entries(LEDGER_FILTERS)) {
    if (v !== '' && v != null) p.set(k, v);
  }
  return '?' + p.toString();
}

async function refreshLedger(reset) {
  if (reset) { LEDGER_OFFSET = 0; LEDGER_ROWS = []; }
  const { items, total } = await api('/api/ledger' + buildLedgerQuery(LEDGER_OFFSET, 20));
  LEDGER_ROWS = LEDGER_ROWS.concat(items);
  LEDGER_OFFSET += items.length;
  $('txTotal').textContent = LEDGER_ROWS.length + ' of ' + total + ' transactions';
  $('txLoadMore').style.display = (LEDGER_OFFSET < total) ? '' : 'none';
  const tb = $('ledgerTable').querySelector('tbody');
  if (!LEDGER_ROWS.length) {
    tb.innerHTML = '<tr><td class="empty" colspan="4">No transactions match.</td></tr>';
    return;
  }
  tb.innerHTML = LEDGER_ROWS.map(l => `<tr>
    <td class="reason">${esc(l.reason.replace(/_/g, ' '))}</td>
    <td class="mono reason">${l.ref ? esc(l.ref) : ''}</td>
    <td class="right ${l.delta >= 0 ? 'delta-pos' : 'delta-neg'}"><span class="reason" style="font-size:.7rem; display:block; font-weight:400; color:var(--mute)">est. ${fmtUsd(Math.abs(l.delta))}</span><span class="mono">${l.delta >= 0 ? '+' : '\u2212'}${fmtCredits(Math.abs(l.delta))}<span class="unit">AWC</span></span></td>
    <td class="right reason">${timeAgo(l.created_at)}</td>
  </tr>`).join('');
}

// Debounce helper for column filters.
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---- List-for-lease modal ----------------------------------------------
let LM_TUNNEL_ID = null;
let LM_PROTOCOL = 'tcp';
function openListModal(tunnelId) {
  const t = ME.onlineTunnels.find(x => x.id === tunnelId);
  if (!t) return alert('Tunnel not found.');
  if (!t.listable) return alert('This tunnel cannot be listed.');
  LM_TUNNEL_ID = tunnelId;
  LM_PROTOCOL = (t.type === 'http') ? 'http' : 'tcp';
  $('lmTunnelUrl').textContent = withBrowserPort(t.publicUrl);
  ['lmTitle','lmDesc','lmBw','lmSudoUser','lmSudoPass']
    .forEach(id => { $(id).value = ''; });
  $('lmPrice').value = CONFIG.defaultLeasePricePerMinute || 1;
  $('lmTerm').value  = 60;
  $('lmCountry').value = '';
  $('lmError').style.display = 'none';
  $('lmSubmit').disabled = false;
  const isHttp = (LM_PROTOCOL === 'http' || LM_PROTOCOL === 'https');
  const protoLabel = LM_PROTOCOL.toUpperCase();
  $('lmProtoBadge').innerHTML = `<span class="proto-icon">${PROTO_ICONS[LM_PROTOCOL] || ''}</span>${protoLabel}`;
  document.querySelectorAll('.lm-sudo-row').forEach(el => el.style.display = isHttp ? 'none' : '');
  $('lmHwNote').style.display   = isHttp ? 'none' : '';
  $('lmSshNote').style.display  = isHttp ? 'none' : '';
  $('lmHttpNote').style.display = isHttp ? '' : 'none';
  $('lmSubmit').textContent = isHttp ? 'List for lease' : 'Validate & list';
  $('listModal').classList.add('open');
}
function closeListModal() { $('listModal').classList.remove('open'); LM_TUNNEL_ID = null; }
$('lmCancel').onclick = closeListModal;

$('lmSubmit').onclick = async () => {
  if (!LM_TUNNEL_ID) return;
  const isHttp = (LM_PROTOCOL === 'http' || LM_PROTOCOL === 'https');
  const body = {
    tunnelId:        LM_TUNNEL_ID,
    title:           $('lmTitle').value.trim(),
    description:     $('lmDesc').value.trim(),
    pricePerMinute:  Number($('lmPrice').value) || CONFIG.defaultLeasePricePerMinute,
    leaseTermMinutes:Number($('lmTerm').value) || 60,
    bandwidthMbps:   $('lmBw').value,
    countryCode:     $('lmCountry').value,
    protocol:        LM_PROTOCOL,
  };
  if (!isHttp) {
    body.sudoUser     = $('lmSudoUser').value;
    body.sudoPassword = $('lmSudoPass').value;
  }
  if (!body.title)       { return showLmError('Title is required.'); }
  if (!isHttp && (!body.sudoUser || !body.sudoPassword)) {
    return showLmError('Sudo username and password are required for validation.');
  }
  $('lmSubmit').disabled = true;
  $('lmSubmit').textContent = isHttp ? 'Listing\u2026' : 'Validating SSH login & probing hardware\u2026';
  $('lmError').style.display = 'none';
  try {
    await api('/api/listings', { method: 'POST', body: JSON.stringify(body) });
    closeListModal();
    await refresh();
  } catch (e) {
    const code = e.body && e.body.error;
    let msg = (e.body && e.body.detail) || e.message;
    if (code === 'sudo_auth_failed')     msg = 'Sudo login failed. Wrong username/password, or the SSH daemon rejected the attempt.';
    if (code === 'no_ssh_banner')        msg = 'No SSH banner from the tunnel endpoint. Is your sshd actually exposed on this tunnel?';
    if (code === 'listing_requires_tcp_ssh_tunnel') msg = 'This tunnel is HTTP. Re-open it as TCP forwarding port 22 (e.g. ssh -R 22:localhost:22 \u2026).';
    if (code === 'protocol_tunnel_mismatch') msg = 'The tunnel type does not match the chosen protocol.';
    if (code === 'no_subdomain')         msg = 'This tunnel has no subdomain yet \u2014 reconnect with a subdomain to list it.';
    showLmError(msg);
    $('lmSubmit').disabled = false;
    $('lmSubmit').textContent = isHttp ? 'List for lease' : 'Validate & list';
  }
};
function showLmError(text) {
  const el = $('lmError');
  el.textContent = text;
  el.style.display = '';
}

// ---- "Why can't I list this?" help modal -------------------------------
function openHelpListModal() {
  const sshHost = (CONFIG && CONFIG.sshHost) || (CONFIG && CONFIG.publicDomain && CONFIG.publicDomain.split(':')[0]) || 'airweb.fyi';
  const sshPort = (CONFIG && CONFIG.sshPort) || 2222;
  const allowCustom = !CONFIG || CONFIG.allowCustomSubdomains !== false;
  const user = allowCustom ? 'mysub' : 'tunnel';
  const intro = $('helpListIntro');
  if (intro) {
    intro.innerHTML = allowCustom
      ? 'Reconnect using the command below. Pick any free <code class="mono">mysub</code> name (or use one of your handles):'
      : 'Reconnect using the command below. The server will assign a random subdomain — the SSH username below is just a placeholder.';
  }
  // Use remote port 0 so the AirWeb server allocates a free public port from
  // its tcpPortRange. Hardcoding `22` would be rejected (it's in reservedPorts).
  const cmd = `ssh -i ./${keyFileName()} -p ${sshPort} -R 0:localhost:22 ${user}@${sshHost}`;
  const pre = $('helpListCmd');
  pre.textContent = cmd;
  // Inject a small copy button in the top-right corner of the <pre>.
  const btn = document.createElement('button');
  btn.textContent = 'copy';
  btn.className = 'ghost';
  btn.style.cssText = 'position:absolute; top:.5rem; right:.5rem; max-width:70px; padding:3px 10px; font-size:.75rem';
  btn.onclick = async () => {
    btn.textContent = (await copyText(cmd)) ? 'copied!' : 'copy failed';
    setTimeout(() => { btn.textContent = 'copy'; }, 1500);
  };
  pre.appendChild(btn);
  $('helpListModal').classList.add('open');
}
function closeHelpListModal() { $('helpListModal').classList.remove('open'); }
$('helpListClose').onclick = closeHelpListModal;
$('helpListModal').addEventListener('click', (e) => {
  if (e.target.id === 'helpListModal') closeHelpListModal();
});

async function refresh() {
  ME = await api('/api/me');
  refreshKeyFileNameLabels();
  renderAuthed();
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function humanBytes(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n/1024).toFixed(1)+' KB'; if (n < 1073741824) return (n/1048576).toFixed(1)+' MB'; return (n/1073741824).toFixed(2)+' GB'; }

// Copy text to the clipboard with a fallback for non-secure-context pages
// (navigator.clipboard requires HTTPS or localhost). Returns true on success.
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed; top:-1000px; left:0; opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
function timeAgo(ts) { const s = Math.floor((Date.now() - ts)/1000); if (s < 60) return s+'s ago'; if (s<3600) return Math.floor(s/60)+'m ago'; if (s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }

// ---- event handlers ----
function triggerKeyDownload(privateKey, filename) {
  const blob = new Blob([privateKey], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'airweb_key';
  // Must be in DOM in some browsers for the click to trigger a download.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$('openDisclaimerBtn').onclick = () => {
  $('disclaimerAck').checked = false;
  $('confirmDisclaimerBtn').disabled = true;
  $('confirmDisclaimerBtn').textContent = 'Generate, download & sign in';
  $('disclaimerModal').classList.add('open');
};
$('cancelDisclaimerBtn').onclick = () => $('disclaimerModal').classList.remove('open');
$('disclaimerAck').onchange = (e) => {
  $('confirmDisclaimerBtn').disabled = !e.target.checked;
};

// Single user gesture: register, download key, and finalise sign-in.
// Download is triggered synchronously from inside the click handler so the
// browser treats it as a user-initiated download.
$('confirmDisclaimerBtn').onclick = async () => {
  if (!$('disclaimerAck').checked) return;
  const btn = $('confirmDisclaimerBtn');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const r = await api('/api/register', { method: 'POST' });
    // Download first — if this throws, we don't proceed to authed UI.
    triggerKeyDownload(r.privateKey, r.saveAs);
    $('disclaimerModal').classList.remove('open');
    showKeyModal(r);
    await tryLoadMe();
  } catch (e) {
    alert('Registration failed: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Generate, download & sign in';
  }
};

function showKeyModal(r) {
  $('newAddr').textContent = r.address;
  $('privKeyText').value = r.privateKey;
  $('firstSshCmd').textContent = `ssh -i ./${r.saveAs} -p ${r.sshPort} -R 80:localhost:3000 mysub@${r.sshHost}`;
  $('keyModal').classList.add('open');
  $('downloadKeyBtn').onclick = () => triggerKeyDownload(r.privateKey, r.saveAs);
  $('copyKeyBtn').onclick = async () => {
    const ok = await copyText(r.privateKey);
    $('copyKeyBtn').textContent = ok ? 'copied!' : 'copy failed';
    setTimeout(() => $('copyKeyBtn').textContent = 'Copy', 1500);
  };
}
$('dismissModalBtn').onclick = () => $('keyModal').classList.remove('open');

// ---- Marketplace filter wiring ------------------------------------------
const MF_PRICE_MAX = 10; // slider's upper bound = "All"
function updateMfPriceLabel() {
  const v = parseFloat($('mfMaxPrice').value);
  const label = (isNaN(v) || v >= MF_PRICE_MAX)
    ? (window.i18n ? window.i18n.t('All') : 'All')
    : (v.toFixed(2));
  $('mfMaxPriceVal').textContent = label;
}
if ($('mfMaxPrice')) {
  $('mfMaxPrice').addEventListener('input', updateMfPriceLabel);
  updateMfPriceLabel();
}
if ($('mfAdvToggle')) {
  $('mfAdvToggle').addEventListener('click', () => {
    const adv = $('mfAdv');
    const btn = $('mfAdvToggle');
    const open = adv.hasAttribute('hidden');
    if (open) { adv.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); btn.classList.add('active'); }
    else { adv.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); btn.classList.remove('active'); }
  });
}
$('mfApply').onclick = () => refreshMarketplace().catch(e => alert('Filter failed: ' + e.message));
// Live-apply on Enter in the search box.
if ($('mfQ')) $('mfQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('mfApply').click(); });
$('mfClear').onclick = () => {
  ['mfQ','mfMinCores','mfMinRam','mfOs'].forEach(id => $(id).value = '');
  $('mfCountry').value = '';
  $('mfProto').value = '';
  $('mfMaxPrice').value = MF_PRICE_MAX;
  updateMfPriceLabel();
  refreshMarketplace().catch(() => {});
};

// ---- Transactions filter wiring -----------------------------------------
const reapplyLedger = debounce(() => refreshLedger(true).catch(e => console.error(e)), 250);
document.querySelectorAll('.col-filter').forEach(el => {
  const col = el.dataset.col;
  el.addEventListener('input',  () => { LEDGER_FILTERS[col === 'reason' ? 'reason' : col === 'ref' ? 'q' : col] = el.value; reapplyLedger(); });
  el.addEventListener('change', () => { LEDGER_FILTERS[col === 'reason' ? 'reason' : col === 'ref' ? 'q' : col] = el.value; reapplyLedger(); });
});
$('txLoadMore').onclick = () => refreshLedger(false).catch(e => alert('Load failed: ' + e.message));
$('txClearFilters').onclick = () => {
  LEDGER_FILTERS = {};
  document.querySelectorAll('.col-filter').forEach(el => { el.value = ''; });
  refreshLedger(true).catch(() => {});
};

// ---- User menu (avatar dropdown) ----------------------------------------
// Wiring (toggle, copy, logout) lives in /header.js so every page — including
// login and internal-server pages that don't load this script — gets the same
// dropdown behaviour. Kept here only as a tiny shim for legacy call sites.
function toggleUserMenu(force) {
  const panel = $('userMenuPanel');
  const btn   = $('avatarBtn');
  const open  = force !== undefined ? force : panel.hasAttribute('hidden');
  if (open) {
    panel.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
  }
}

// Settings gear popover + theme switcher live in /header.js (shared across pages).

$('addrCopyBtn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const ok = await copyText(ME && ME.address ? ME.address : '');
  $('addrCopyBtn').textContent = ok ? 'Copied!' : 'Failed';
  setTimeout(() => { $('addrCopyBtn').textContent = 'Copy'; }, 1500);
});


// Re-render numeric displays whenever the user changes their local currency.
if (window.currency && typeof window.currency.onChange === 'function') {
  window.currency.onChange(() => {
    if (ME) {
      try { renderAuthed(); } catch (e) {}
    }
    if (typeof refreshLedger === 'function') {
      try { refreshLedger(true); } catch (e) {}
    }
    if (typeof refreshMarketplace === 'function') {
      const active = document.querySelector('#tabBar button.active')?.dataset.tab;
      if (active === 'marketplace') { try { refreshMarketplace(); } catch (e) {} }
    }
  });
}

$('adminRefreshBtn').onclick = () => refreshAdmin().catch(e => alert('Refresh failed: ' + e.message));

// Auto-refresh every 15s when authed
setInterval(() => { if (ME) refresh().catch(() => {}); }, 15000);

// ---- Collapsible cards (state persisted in localStorage) ---------------
// Any non-stat .card with an <h2> (direct child, or inside its first child
// div) becomes collapsible. The h2 is the toggle; clicking it flips
// .collapsed on the card and writes to localStorage so the choice survives
// reloads. Keyed by the h2's text (trimmed, lowercased).
function initCollapsibleCards() {
  // Regular cards with an h2 toggle (excludes stat cards and main sections)
  document.querySelectorAll('.card:not(.stat)').forEach(card => {
    const h2 = card.querySelector(':scope > h2, :scope > div:first-child > h2');
    if (!h2) return;
    bindCollapse(card, h2, h2.textContent.trim().toLowerCase().slice(0, 60));
  });
  // Overview hero: clicking the Account header row toggles
  const hero = document.getElementById('overviewHero');
  const heroHead = document.getElementById('heroHead');
  if (hero && heroHead) bindCollapse(hero, heroHead, 'overview-hero');
}
function bindCollapse(el, handle, slug) {
  const key = 'card-collapsed:' + slug;
  el.dataset.collapsible = '1';
  if (localStorage.getItem(key) === '1') el.classList.add('collapsed');
  handle.addEventListener('click', () => {
    const next = !el.classList.contains('collapsed');
    el.classList.toggle('collapsed', next);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch {}
  });
}
initCollapsibleCards();

(async () => { await loadConfig(); await tryLoadMe(); })();
