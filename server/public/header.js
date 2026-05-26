// Shared header behavior for AirWeb — used by landing, login, and dashboard.
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

  function currentTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
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
        try { localStorage.setItem(THEME_KEY, t); } catch (err) {}
        applyTheme(t);
      });
    }

    // Re-sync active class after wiring (in case DOM was injected later).
    applyTheme(currentTheme());

    // Inject a "Docs" link as the first nav item if the internal doc
    // tunnel is configured. We probe /api/config (cheap, already used
    // elsewhere) and only render the link if the server reports a docUrl.
    injectDocsNavLink();
  }

  function injectDocsNavLink() {
    if (document.querySelector('[data-aw-docs-nav]')) return; // already added
    try {
      fetch('/api/config', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) {
          if (!cfg || !cfg.docUrl) return;
          if (document.querySelector('[data-aw-docs-nav]')) return;
          var brand = document.querySelector('header.site .inner .brand')
                   || document.querySelector('header .brand');
          if (!brand || !brand.parentNode) return;
          var link = document.createElement('a');
          link.href = cfg.docUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'navlink';
          link.id = 'navDocs';
          link.setAttribute('data-aw-docs-nav', '');
          link.setAttribute('data-no-i18n', '1');
          link.style.marginLeft = '.5rem';
          link.textContent = 'Docs';
          brand.parentNode.insertBefore(link, brand.nextSibling);
        })
        .catch(function () { /* silently ignore — link is optional */ });
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // Expose for pages that want to programmatically set theme.
  window.AirWebHeader = { applyTheme: applyTheme, currentTheme: currentTheme };
})();
