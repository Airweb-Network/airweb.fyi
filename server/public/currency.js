/**
 * AirWeb local-currency picker.
 *
 * Exposes `window.currency` with:
 *   - getCurrency()                 → 'USD' | 'EUR' | …
 *   - setCurrency(code)             → switches and fires listeners
 *   - format(usdAmount, opts?)      → "$1.23", "€1,23", "¥190", …
 *   - convert(usdAmount)            → number in the active currency
 *   - onChange(fn)                  → subscribe; fn(code) on every change
 *   - CURRENCIES, LABELS, SYMBOLS, RATES
 *
 * Mounts dropdown pickers into any element with id="currencyPickerSlot"
 * or "currencyPickerSlotMenu" that exists at DOMContentLoaded.
 *
 * Storage key: localStorage['airweb-currency'].
 * Auto-detects from navigator.language region (en-GB → GBP, ja-JP → JPY, …)
 * on first visit; falls back to USD.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'airweb-currency';
  const DEFAULT     = 'USD';

  // Approximate spot rates (units of foreign currency per 1 USD). Updated
  // periodically; the dashboard displays them as estimates anyway.
  const RATES = {
    USD: 1,      EUR: 0.92,    GBP: 0.79,    JPY: 156,
    CNY: 7.24,   KRW: 1370,    INR: 83.4,    CAD: 1.37,
    AUD: 1.52,   CHF: 0.88,    BRL: 5.05,    MXN: 17.2,
    HKD: 7.81,   SGD: 1.34,    SEK: 10.5,    NOK: 10.7,
    PLN: 3.95,   TRY: 32.5,    ZAR: 18.4,    RUB: 92.0,
  };

  const SYMBOLS = {
    USD: '$',  EUR: '€',  GBP: '£',  JPY: '¥',  CNY: '¥',
    KRW: '₩',  INR: '₹',  CAD: 'CA$', AUD: 'A$', CHF: 'CHF ',
    BRL: 'R$', MXN: 'MX$', HKD: 'HK$', SGD: 'S$', SEK: 'kr ',
    NOK: 'kr ', PLN: 'zł ', TRY: '₺',  ZAR: 'R',  RUB: '₽',
  };

  const LABELS = {
    USD: 'USD ($)',  EUR: 'EUR (€)',  GBP: 'GBP (£)',  JPY: 'JPY (¥)',
    CNY: 'CNY (¥)',  KRW: 'KRW (₩)',  INR: 'INR (₹)',  CAD: 'CAD ($)',
    AUD: 'AUD ($)',  CHF: 'CHF',      BRL: 'BRL (R$)', MXN: 'MXN ($)',
    HKD: 'HKD ($)',  SGD: 'SGD ($)',  SEK: 'SEK (kr)', NOK: 'NOK (kr)',
    PLN: 'PLN (zł)', TRY: 'TRY (₺)',  ZAR: 'ZAR (R)',  RUB: 'RUB (₽)',
  };

  // Currencies that conventionally have no fractional unit in display.
  const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

  const CURRENCIES = Object.keys(RATES);

  let current = DEFAULT;
  const listeners = new Set();

  function detectInitial() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && RATES[saved]) return saved;
    } catch (e) {}
    try {
      const lang = (navigator.language || '').toUpperCase();
      const m = lang.match(/-([A-Z]{2})$/);
      const region = m ? m[1] : '';
      const map = {
        US: 'USD', CA: 'CAD', GB: 'GBP', IE: 'EUR', FR: 'EUR', DE: 'EUR',
        ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR',
        FI: 'EUR', GR: 'EUR', JP: 'JPY', CN: 'CNY', HK: 'HKD', SG: 'SGD',
        KR: 'KRW', IN: 'INR', AU: 'AUD', NZ: 'AUD', CH: 'CHF', SE: 'SEK',
        NO: 'NOK', PL: 'PLN', TR: 'TRY', BR: 'BRL', MX: 'MXN', ZA: 'ZAR',
        RU: 'RUB',
      };
      if (map[region]) return map[region];
    } catch (e) {}
    return DEFAULT;
  }

  function getCurrency() { return current; }

  function setCurrency(code) {
    if (!RATES[code]) code = DEFAULT;
    if (code === current) return;
    current = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
    updateAllPickers();
    listeners.forEach(fn => { try { fn(code); } catch (e) {} });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function convert(usdAmount) {
    return (Number(usdAmount) || 0) * (RATES[current] || 1);
  }

  function format(usdAmount, opts) {
    opts = opts || {};
    const v = convert(usdAmount);
    const decimals = ZERO_DECIMAL.has(current)
      ? 0
      : (typeof opts.decimals === 'number' ? opts.decimals : 2);
    const small = opts.small === true;
    // For very small amounts in fractional currencies, surface more precision.
    if (small && !ZERO_DECIMAL.has(current)) {
      if (v === 0) return SYMBOLS[current] + '0.00';
      if (Math.abs(v) >= 0.01) return SYMBOLS[current] + v.toFixed(2);
      if (Math.abs(v) >= 0.0001) return SYMBOLS[current] + v.toFixed(4);
      return '<' + SYMBOLS[current] + '0.0001';
    }
    return SYMBOLS[current] + v.toFixed(decimals);
  }

  // ---------------------------------------------------------------
  // Picker UI
  // ---------------------------------------------------------------
  const pickers = [];

  function buildPicker() {
    const wrap = document.createElement('div');
    wrap.className = 'cur-picker';
    wrap.setAttribute('data-no-i18n', '1');
    wrap.style.cssText = 'position:relative; display:inline-flex;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost cur-picker-trigger';
    btn.setAttribute('aria-label', 'Currency');
    btn.style.cssText = 'padding:.3rem .55rem; font-size:.78rem; line-height:1; min-height:0; max-width:none;';
    btn.innerHTML = '<span aria-hidden="true" style="display:inline-block; margin-right:.3rem">💱</span><span class="cur-current"></span>';
    wrap.appendChild(btn);
    const menu = document.createElement('div');
    menu.className = 'cur-picker-menu';
    menu.style.cssText = 'position:absolute; top:100%; right:0; margin-top:4px; padding:4px; min-width:140px; max-height:260px; overflow:auto; background:var(--panel); border:1px solid var(--line2); border-radius:var(--radius,8px); box-shadow:var(--shadow-card, 0 4px 14px rgba(0,0,0,.25)); z-index:1000; display:none;';
    CURRENCIES.forEach(code => {
      const opt = document.createElement('div');
      opt.setAttribute('role', 'option');
      opt.dataset.code = code;
      opt.style.cssText = 'padding:.35rem .55rem; border-radius:6px; cursor:pointer; font-size:.82rem; color:var(--fg); white-space:nowrap;';
      opt.textContent = LABELS[code];
      opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--hover, rgba(255,255,255,.05))'; });
      opt.addEventListener('mouseleave', () => { opt.style.background = ''; });
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrency(code);
        menu.style.display = 'none';
      });
      menu.appendChild(opt);
    });
    wrap.appendChild(menu);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) menu.style.display = 'none';
    });

    function updateTrigger() {
      btn.querySelector('.cur-current').textContent = current;
      Array.from(menu.children).forEach(c => {
        c.style.fontWeight = c.dataset.code === current ? '600' : '400';
      });
    }
    updateTrigger();
    wrap.__update = updateTrigger;
    return wrap;
  }

  function updateAllPickers() {
    pickers.forEach(p => { try { p.__update(); } catch (e) {} });
  }

  function mountPickers() {
    const slots = [
      document.getElementById('currencyPickerSlot'),
      document.getElementById('currencyPickerSlotMenu'),
    ].filter(Boolean);
    slots.forEach(slot => {
      if (slot.querySelector(':scope > .cur-picker')) return;
      const p = buildPicker();
      slot.appendChild(p);
      pickers.push(p);
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  current = detectInitial();
  window.currency = {
    getCurrency, setCurrency, format, convert, onChange,
    CURRENCIES, LABELS, SYMBOLS, RATES,
  };
  ready(mountPickers);
})();
