// Shared header behavior for Airweb — used by landing, login, and dashboard.
// Handles:
//   • Theme bootstrap (sets data-theme on <html> from localStorage / system pref)
//   • Settings gear (#settingsBtn) open/close popover
//   • Theme button (#themeRow [data-theme]) wiring
//
// Markup contract — see header.css.
//
// Safe to load multiple times; guards against re-init via window.__awHeaderInit.
(function () {
  if (window.__awHeaderInit) return;
  window.__awHeaderInit = true;

  var THEME_KEY = 'airweb-theme';
  var API_BASE  = window.__awApiBase || '';

  // ---------------------------------------------------------------------
  // Shared settings store — persists user prefs (theme, locale, currency)
  // in a cookie scoped to the registrable parent domain so apex and every
  // subdomain (doc.<domain>, forum.<domain>, …) share the same values.
  // Falls back to localStorage when cookies are unavailable.
  // ---------------------------------------------------------------------
  var STORE_DOMAIN = (function () {
    var h = location.hostname || '';
    if (!h || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.indexOf('.') < 0) return null;
    var parts = h.split('.');
    if (parts.length < 2) return null;
    return '.' + parts.slice(-2).join('.');
  })();
  function storeGet(key) {
    try {
      var safe = key.replace(/[-.$^|?*+(){}[\]\\]/g, '\\$&');
      var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + safe + '=([^;]*)'));
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    // Fallback to localStorage; migrate the value into the shared cookie
    // so other subdomains can pick it up on their next visit.
    var ls = null;
    try { ls = localStorage.getItem(key); } catch (e) {}
    if (ls != null) { try { storeSet(key, ls); } catch (e) {} }
    return ls;
  }
  function storeSet(key, val) {
    try {
      var parts = [key + '=' + encodeURIComponent(val), 'Path=/', 'Max-Age=' + (60 * 60 * 24 * 365), 'SameSite=Lax'];
      if (STORE_DOMAIN) parts.push('Domain=' + STORE_DOMAIN);
      if (location.protocol === 'https:') parts.push('Secure');
      document.cookie = parts.join('; ');
    } catch (e) {}
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  window.AirwebStore = { get: storeGet, set: storeSet };

  // One-time migration: copy any pre-existing localStorage values for the
  // known setting keys into the shared cookie so they propagate to
  // subdomains the next time the user visits them.
  try {
    ['airweb-theme', 'airweb-locale', 'airweb-currency'].forEach(function (k) {
      var safe = k.replace(/[-.$^|?*+(){}[\]\\]/g, '\\$&');
      var has = new RegExp('(?:^|;\\s*)' + safe + '=').test(document.cookie || '');
      if (has) return;
      var v = null;
      try { v = localStorage.getItem(k); } catch (e) {}
      if (v != null) storeSet(k, v);
    });
  } catch (e) {}

  // Shared header markup — injected into any page that contains
  // <div id="aw-header"></div>. Keeps brand, internal-nav links, the
  // settings popover (shown to anonymous visitors) and the user menu
  // (shown to signed-in accounts) consistent across landing, login,
  // dashboard, marketplace, connections and internal servers.
  var HEADER_HTML = [
    '<header class="site"><div class="inner">',
      '<a href="', API_BASE, '/" class="brand" title="Airweb home">',
        '<img class="logo" src="', API_BASE, '/logo.png" alt="" aria-hidden="true" decoding="async">',
        '<strong>Airweb</strong>',
      '</a>',
      '<a href="', API_BASE, '/marketplace" id="navMarketplace" class="navlink" style="margin-left:.5rem">Marketplace</a>',
      '<a href="', API_BASE, '/connections" id="navConnections" class="navlink" style="margin-left:.5rem">Connections</a>',
      '<nav>',
        '<a id="navLogin" class="navlink hide" href="', API_BASE, '/login" style="margin-right:.5rem">Login</a>',
        '<span id="settingsMenu" class="settings-menu" style="margin-right:.5rem">',
          '<button type="button" id="settingsBtn" class="ghost settings-trigger" title="Settings" aria-label="Settings" aria-haspopup="menu" aria-expanded="false">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
          '</button>',
          '<div id="settingsPanel" class="settings-panel" role="menu" hidden>',
            '<div class="settings-section"><div class="label">Theme</div>',
              '<div class="theme-row" id="themeRow">',
                '<button type="button" data-theme="dark">Dark</button>',
                '<button type="button" data-theme="light">Light</button>',
              '</div>',
            '</div>',
            '<div class="settings-sep"></div>',
            '<div class="settings-row"><div class="label">Language</div><span id="i18nPickerSlotMenu" data-no-i18n="1"></span></div>',
            '<div class="settings-row"><div class="label">Currency</div><span id="currencyPickerSlotMenu" data-no-i18n="1"></span></div>',
          '</div>',
        '</span>',
        '<span id="userMenu" class="user-menu hide">',
          '<a id="navBalance" class="nav-balance hide" href="', API_BASE, '/dashboard" title="Go to dashboard">',
            '<span class="usd" id="navCreditsUsd"></span>',
            '<span class="amt"><span id="navCreditsVal">\u2026</span><span class="unit">AWB</span></span>',
          '</a>',
          '<button id="avatarBtn" class="avatar-trigger" type="button" aria-haspopup="menu" aria-expanded="false" title="Account">',
            '<span class="avatar"><span id="avatarLetter" aria-hidden="true"></span></span>',
            '<span id="navAddr" class="nav-addr hide"></span>',
          '</button>',
          '<div id="userMenuPanel" class="user-menu-panel" role="menu" hidden>',
            '<div class="user-menu-section"><div class="label">Account</div>',
              '<div class="user-menu-addr">',
                '<code id="menuAddrFull"></code>',
                '<button id="menuAddrCopy" type="button">Copy</button>',
              '</div>',
            '</div>',
            '<div class="user-menu-sep"></div>',
            '<div class="settings-section"><div class="label">Theme</div>',
              '<div class="theme-row" id="themeRowUser">',
                '<button type="button" data-theme="dark">Dark</button>',
                '<button type="button" data-theme="light">Light</button>',
              '</div>',
            '</div>',
            '<div class="settings-row"><div class="label">Language</div><span id="i18nPickerSlotUser" data-no-i18n="1"></span></div>',
            '<div class="settings-row"><div class="label">Currency</div><span id="currencyPickerSlotUser" data-no-i18n="1"></span></div>',
            '<div class="user-menu-sep"></div>',
            '<button id="logoutBtn" class="user-menu-item" type="button">Sign out</button>',
          '</div>',
        '</span>',
      '</nav>',
    '</div></header>'
  ].join('');

  function injectHeader() {
    var slot = document.getElementById('aw-header');
    if (!slot || slot.firstElementChild) return;
    slot.outerHTML = HEADER_HTML;
  }

  // Render the shared header as soon as the script loads (defer scripts run
  // with a parsed DOM but before DOMContentLoaded). This must happen before
  // i18n.js / currency.js mount their pickers, so their picker slots exist.
  try { injectHeader(); } catch (e) {}

  function currentTheme() {
    try {
      var saved = storeGet(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return sysDark ? 'dark' : 'light';
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var buttons = document.querySelectorAll('.theme-row [data-theme]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].dataset.theme === t);
    }
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && bg) meta.setAttribute('content', bg);
  }

  // Apply early to avoid flash.
  try { applyTheme(currentTheme()); } catch (e) {}

  function wire() {
    var menu  = document.getElementById('settingsMenu');
    var btn   = document.getElementById('settingsBtn');
    var panel = document.getElementById('settingsPanel');

    if (btn && panel) {
      function toggle(force) {
        var open = force !== undefined ? force : panel.hasAttribute('hidden');
        if (open) { panel.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
        else { panel.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
      }
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      document.addEventListener('click', function (e) { if (menu && !menu.contains(e.target)) toggle(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    var themeBtns = document.querySelectorAll('.theme-row [data-theme]');
    for (var i = 0; i < themeBtns.length; i++) {
      themeBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var t = this.dataset.theme;
        try { storeSet(THEME_KEY, t); } catch (err) {}
        applyTheme(t);
      });
    }

    // Re-sync active class after wiring (in case DOM was injected later).
    applyTheme(currentTheme());

    wireUserMenu();

    // Inject a nav link for every enabled internal server (docs, forum, …).
    // The server reports them via /api/config → internalServers; we only
    // render entries that have a resolvable public URL.
    injectInternalNavLinks();

    // Toggle settings ⇄ user menu based on session. App.js (dashboard
    // pages) will refine this with live balance/currency; here we just
    // make landing, login and internal-server pages reflect auth state.
    refreshAuthState();
  }

  function wireUserMenu() {
    var userMenu = document.getElementById('userMenu');
    var btn      = document.getElementById('avatarBtn');
    var panel    = document.getElementById('userMenuPanel');
    if (btn && panel && !btn.__awWired) {
      btn.__awWired = true;
      var toggle = function (force) {
        var open = force !== undefined ? force : panel.hasAttribute('hidden');
        if (open) { panel.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
        else      { panel.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
      };
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function (e) {
        if (userMenu && !userMenu.contains(e.target)) toggle(false);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
    }

    var copy = document.getElementById('menuAddrCopy');
    if (copy && !copy.__awWired) {
      copy.__awWired = true;
      copy.addEventListener('click', function (e) {
        e.stopPropagation();
        var full = document.getElementById('menuAddrFull');
        var text = full ? (full.textContent || '') : '';
        var label = copy.textContent;
        var done = function (ok) {
          copy.textContent = ok ? 'Copied!' : 'Failed';
          setTimeout(function () { copy.textContent = label || 'Copy'; }, 1500);
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
          } else {
            var ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            var ok = false; try { ok = document.execCommand('copy'); } catch (err) {}
            document.body.removeChild(ta); done(ok);
          }
        } catch (err) { done(false); }
      });
    }

    var logout = document.getElementById('logoutBtn');
    if (logout && !logout.__awWired) {
      logout.__awWired = true;
      logout.addEventListener('click', function (e) {
        e.stopPropagation();
        try {
          fetch(API_BASE + '/api/logout', { method: 'POST', credentials: API_BASE ? 'include' : 'same-origin' })
            .then(function () { location.reload(); }, function () { location.reload(); });
        } catch (err) { location.reload(); }
      });
    }
  }

  function refreshAuthState() {
    var fetchOpts = { credentials: API_BASE ? 'include' : 'same-origin' };
    try {
      fetch(API_BASE + '/api/me', fetchOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (me) { applyAuthState(me); })
        .catch(function () { applyAuthState(null); });
    } catch (e) { applyAuthState(null); }
  }

  // Reversible 9×9 identicon — same algorithm as app.js so dashboard and
  // every other page render an identical avatar for a given address.
  var ID_B32 = 'abcdefghijkmnpqrstuvwxyz23456789';
  function identiconSvg(address, size) {
    size = size || 30;
    var body = (typeof address === 'string' && address.indexOf('aw_') === 0)
      ? address.slice(3) : (address || '');
    var bytes = new Uint8Array(10);
    var bits = 0, val = 0, bi = 0;
    for (var i = 0; i < 16 && bi < 10; i++) {
      var idx = ID_B32.indexOf((body[i] || 'a').toLowerCase());
      val = (val << 5) | (idx < 0 ? 0 : idx);
      bits += 5;
      if (bits >= 8) { bits -= 8; bytes[bi++] = (val >>> bits) & 0xff; }
    }
    function bit(i) { return (bytes[i >> 3] >>> (7 - (i & 7))) & 1; }
    var sum = 0; for (var k = 0; k < 10; k++) sum += bytes[k];
    var hue = (sum * 7) % 360;
    var fg  = 'hsl(' + hue + ', 65%, 52%)';
    var rects = '<rect x="0" y="0" width="1" height="1"/>';
    for (var n = 0; n < 80; n++) {
      if (bit(n)) {
        var ix = n + 1, x = ix % 9, y = (ix - x) / 9;
        rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
           '" viewBox="0 0 9 9" shape-rendering="crispEdges" fill="' + fg + '">' + rects + '</svg>';
  }

  function fmtCredits(n) { return (Number(n) || 0).toFixed(2); }
  function fmtUsdEst(credits) {
    var rate = 0.01;
    try {
      if (window.CONFIG && typeof window.CONFIG.usdPerCredit === 'number') rate = window.CONFIG.usdPerCredit;
      else if (typeof window.__awUsdPerCredit === 'number' && window.__awUsdPerCredit > 0) rate = window.__awUsdPerCredit;
    } catch (e) {}
    var usd = (Number(credits) || 0) * rate;
    if (window.currency && typeof window.currency.format === 'function') {
      try { return window.currency.format(usd, { small: true }); } catch (e) {}
    }
    if (usd === 0) return '$0.00';
    if (Math.abs(usd) >= 0.01) return '$' + usd.toFixed(2);
    if (Math.abs(usd) >= 0.0001) return '$' + usd.toFixed(4);
    return '<$0.0001';
  }

  function setText(id, text)   { var el = document.getElementById(id); if (el) el.textContent = text; }
  function setHtml(id, html)   { var el = document.getElementById(id); if (el) el.innerHTML  = html; }
  function setHide(id, hidden) { var el = document.getElementById(id); if (el) el.classList.toggle('hide', !!hidden); }

  function applyAuthState(me) {
    var settings = document.getElementById('settingsMenu');
    var userMenu = document.getElementById('userMenu');
    var navBal   = document.getElementById('navBalance');
    var navLogin = document.getElementById('navLogin');
    var signedIn = !!(me && me.address);
    if (settings) settings.classList.toggle('hide', signedIn);
    if (userMenu) userMenu.classList.toggle('hide', !signedIn);
    if (navBal)   navBal.classList.toggle('hide', !signedIn);
    if (navLogin) {
      // Show "Login" beside the gear for anonymous visitors, but suppress
      // it on the login page itself to avoid a self-referential link.
      var onLoginPage = /^\/login\/?$/.test(location.pathname || '');
      navLogin.classList.toggle('hide', signedIn || onLoginPage);
    }
    if (!signedIn) return;
    var addr = String(me.address || '');
    var body = addr.indexOf('aw_') === 0 ? addr.slice(3) : addr;
    setHtml('avatarLetter', identiconSvg(addr, 30));
    setText('navAddr', body.length > 4 ? '\u2026' + body.slice(-4) : addr);
    setHide('navAddr', false);
    var avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) avatarBtn.title = addr;
    setText('menuAddrFull', addr);
    if (typeof me.credits === 'number') {
      setText('navCreditsVal', fmtCredits(me.credits));
      setText('navCreditsUsd', 'est. ' + fmtUsdEst(me.credits));
    }
  }

  function injectInternalNavLinks() {
    if (document.querySelector('[data-aw-internal-nav]')) return; // already added
    try {
      var fetchOpts = { credentials: API_BASE ? 'include' : 'same-origin' };
      fetch(API_BASE + '/api/config', fetchOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) {
          if (!cfg) return;
          try {
            if (typeof cfg.usdPerCredit === 'number') window.__awUsdPerCredit = cfg.usdPerCredit;
          } catch (e) {}
          var items = (cfg.internalServers && cfg.internalServers.length)
            ? cfg.internalServers
            : (cfg.docUrl ? [{ key: 'doc', label: 'Docs', url: cfg.docUrl }] : []);
          if (!items.length) return;
          var brand = document.querySelector('header.site .inner .brand')
                   || document.querySelector('header .brand');
          if (!brand || !brand.parentNode) return;
          var anchor = brand; // we'll insert each new link right after the previous
          items.forEach(function (item) {
            if (!item || !item.url) return;
            if (document.querySelector('[data-aw-internal-nav="' + item.key + '"]')) return;
            var link = document.createElement('a');
            link.href = item.url;
            link.className = 'navlink';
            link.id = 'nav' + item.key.charAt(0).toUpperCase() + item.key.slice(1);
            link.setAttribute('data-aw-internal-nav', item.key);
            link.style.marginLeft = '.5rem';
            link.textContent = item.label || item.key;
            anchor.parentNode.insertBefore(link, anchor.nextSibling);
            anchor = link;
          });
          // Re-run the i18n walker so freshly-added links pick up the
          // current locale (they weren't in the DOM during initial apply).
          try { window.i18n && window.i18n.apply && window.i18n.apply(); } catch (e) {}
        })
        .catch(function () { /* silently ignore — links are optional */ });
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // Expose for pages that want to programmatically set theme or refresh auth.
  window.AirwebHeader = {
    applyTheme: applyTheme,
    currentTheme: currentTheme,
    applyAuthState: applyAuthState,
    refreshAuthState: refreshAuthState
  };
})();
