// Extract translatable text fragments from server/internal/doc/pages.js
// in the same way the runtime i18n DOM walker would see them.
//
// Run:  node scripts/extract-doc-strings.js
//
// Output is a newline-separated list of unique normalised fragments
// (whitespace collapsed, trimmed). It SKIPS the contents of
// <script>, <style>, <code>, <pre> and <textarea> tags.

const { SECTIONS } = require('../server/internal/doc/pages');

const SKIP = new Set(['script', 'style', 'code', 'pre', 'textarea']);

// Very small HTML tokenizer good enough for the structured prose we ship.
function* tokens(html) {
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i);
      if (close < 0) return;
      const raw = html.slice(i + 1, close);
      const isEnd = raw.startsWith('/');
      const isSelfClose = raw.endsWith('/');
      const name = raw.replace(/^\//, '').split(/[\s/>]/)[0].toLowerCase();
      yield { kind: isEnd ? 'end' : 'start', name, selfClose: isSelfClose };
      i = close + 1;
    } else {
      const next = html.indexOf('<', i);
      const end = next < 0 ? html.length : next;
      const text = html.slice(i, end);
      if (text) yield { kind: 'text', text };
      i = end;
    }
  }
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&hellip;/g, '…');
}

function extract(html) {
  const out = [];
  const stack = [];
  for (const t of tokens(html)) {
    if (t.kind === 'start') {
      if (!t.selfClose) stack.push(t.name);
    } else if (t.kind === 'end') {
      // pop the matching tag
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === t.name) { stack.length = i; break; }
      }
    } else {
      const skipped = stack.some(n => SKIP.has(n));
      if (skipped) continue;
      const norm = decode(t.text).replace(/\s+/g, ' ').trim();
      if (norm) out.push(norm);
    }
  }
  return out;
}

const seen = new Set();
const ordered = [];
SECTIONS.forEach(section => {
  section.pages.forEach(page => {
    extract(page.html).forEach(s => {
      if (!seen.has(s)) { seen.add(s); ordered.push(s); }
    });
    // Also collect title/description (rendered in <title>, meta, h1 area)
    [page.title, page.description].forEach(s => {
      const v = (s || '').replace(/\s+/g, ' ').trim();
      if (v && !seen.has(v)) { seen.add(v); ordered.push(v); }
    });
  });
  const lbl = (section.label || '').trim();
  if (lbl && !seen.has(lbl)) { seen.add(lbl); ordered.push(lbl); }
});

console.log(`# Total unique fragments: ${ordered.length}\n`);
ordered.forEach(s => console.log(JSON.stringify(s)));
