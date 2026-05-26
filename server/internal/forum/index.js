// Internal "forum" server — placeholder community forum, proxied at
// forum.<publicDomain>. Disabled by default; enable via config.internalForum.
const { createInternalServer, escapeHtml } = require('../base');

function render(req, { title }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         max-width: 760px; margin: 3rem auto; padding: 0 1.2rem; color:#1f2330; }
  h1 { font-size: 1.6rem; margin: 0 0 .6rem; }
  p  { color:#475063; }
  .pill { display:inline-block; font-size:.7rem; font-weight:700; letter-spacing:1px;
          text-transform:uppercase; padding:3px 8px; border-radius:5px;
          background:#fff3e6; color:#b35900; border:1px solid #ffd9ad; }
</style>
</head><body>
  <span class="pill">internal · forum</span>
  <h1>${escapeHtml(title)}</h1>
  <p>The community forum is coming soon. This placeholder is served by the
     AirWeb built-in forum server and proxied via the public HTTP router.</p>
</body></html>`;
}

module.exports = createInternalServer({
  key: 'forum',
  label: 'Forum',
  configKey: 'internalForum',
  defaultPort: 8091,
  defaultSubdomain: 'forum',
  defaultTitle: 'AirWeb Forum',
  handler: (req, res, ctx) => {
    const body = render(req, ctx);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  },
});
