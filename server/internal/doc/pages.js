// AirWeb documentation content.
//
// Each entry is a fully self-contained page used by both the HTML renderer
// and the client-side search index. Keep the prose plain — placeholders like
// `{{PUBLIC_DOMAIN}}`, `{{APEX}}`, `{{SSH_HOST}}` and `{{SSH_PORT}}` are
// substituted at render time so the docs always reflect the live deployment.
//
// Sections group pages in the sidebar. The first page of the first section
// is treated as the docs landing page (served at `/`).

const SECTIONS = [
  {
    id: 'getting-started',
    label: 'Getting started',
    pages: [
      {
        slug: 'introduction',
        title: 'Introduction to AirWeb',
        description:
          'AirWeb turns a single SSH command into a public HTTPS URL. ' +
          'Learn what AirWeb is, how reverse SSH tunneling works, and why ' +
          'it is a fast way to share a localhost service with the world.',
        keywords:
          'AirWeb, reverse SSH tunnel, ssh -R, expose localhost, public ' +
          'URL for local server, ngrok alternative, self-hosted tunneling',
        html: `
<h1>What is AirWeb?</h1>
<p class="lead">AirWeb is a reverse-tunneling service that exposes any
service running on your laptop or a private network to the public internet
using nothing but the <code>ssh</code> command. There is no agent to
install — if you have OpenSSH (every modern macOS, Linux and Windows ships
it), you already have everything you need.</p>

<h2>How it works</h2>
<p>When you run <code>ssh&nbsp;-R</code> against AirWeb, the SSH server
accepts a <em>reverse port forward</em> request from your client and binds
a public listener for you. Incoming traffic to that listener is sent
back over the existing SSH connection to a port on your machine.</p>
<ul>
  <li>For HTTP, the public listener is the shared port 80/443 reverse
      proxy on <code>{{PUBLIC_DOMAIN}}</code>, routed by subdomain.</li>
  <li>For raw TCP, the server picks (or you pick) a dedicated port and
      forwards bytes verbatim.</li>
</ul>

<h2>Why people use AirWeb</h2>
<ul>
  <li><strong>Zero install.</strong> No client binary, no kernel module,
      no browser extension. Just OpenSSH and a key file.</li>
  <li><strong>Real public URLs.</strong> You get
      <code>https://&lt;name&gt;.{{PUBLIC_DOMAIN}}</code> — useful for
      webhooks, mobile testing, OAuth callbacks, demos and IoT.</li>
  <li><strong>Permanent handles.</strong> Lease a name on the
      <a href="{{APEX}}/marketplace">marketplace</a> so nobody else can
      claim it.</li>
  <li><strong>Self-hostable.</strong> Every line of code that runs the
      service is in the same repo you can deploy yourself.</li>
</ul>

<h2>Next steps</h2>
<p>The fastest way to feel how AirWeb works is to publish a local web app
right now. Head to the <a href="/quick-start">Quick start</a> guide —
you will have a live URL in under two minutes.</p>
`,
      },
      {
        slug: 'quick-start',
        title: 'Quick start — your first tunnel in 60 seconds',
        description:
          'Publish a local HTTP service to the public internet with one ' +
          'ssh command. This step-by-step quick start gets you from zero ' +
          'to a working https URL in about a minute.',
        keywords:
          'AirWeb quick start, ssh tunnel tutorial, expose localhost ' +
          'http, ssh -R example, share local server, get public URL',
        html: `
<h1>Quick start</h1>
<p class="lead">Three steps. One terminal. A public URL.</p>

<h2>1. Create an account and grab your key</h2>
<p>Visit <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> and click
<em>Create account</em>. The site will hand you a file named
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code>. That file is your private
SSH key — keep it somewhere safe.</p>
<pre><code># macOS / Linux only — Windows can skip
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. Start something on localhost</h2>
<p>Anything that speaks HTTP works. If you do not have an app handy:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. Open the tunnel</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>Now point your browser at
<code>http://myapp.{{PUBLIC_DOMAIN}}</code>. Requests will appear in the
terminal of the local server. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to take
the URL down.</p>

<h2>What the flags mean</h2>
<dl>
  <dt><code>-i &lt;file&gt;</code></dt>
  <dd>The private key you downloaded.</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>AirWeb's SSH server runs on port {{SSH_PORT}} (not 22).</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>Reverse-forward the public HTTP port to your local 3000.</dd>
  <dt><code>myapp@…</code></dt>
  <dd>The SSH username is the subdomain you want to publish under.</dd>
</dl>

<h2>What's next</h2>
<ul>
  <li><a href="/http-tunnels">Publish more than one app at once</a></li>
  <li><a href="/tcp-tunnels">Expose a database or game server (raw TCP)</a></li>
  <li><a href="/handles">Reserve a permanent name with a handle lease</a></li>
</ul>
`,
      },
      {
        slug: 'installation',
        title: 'Installing the AirWeb client',
        description:
          'AirWeb works with stock OpenSSH on macOS, Linux and Windows. ' +
          'You can also use the optional `airweb` Node.js wrapper for a ' +
          'friendlier command. Here is how to set both up.',
        keywords:
          'install AirWeb, OpenSSH client install, ssh on Windows, ' +
          'airweb npm cli, AirWeb setup macOS, AirWeb setup Linux',
        html: `
<h1>Installation</h1>
<p class="lead">AirWeb's "client" is whatever <code>ssh</code> binary is
already on your computer. If you want a slightly nicer command line, an
optional Node.js wrapper is published too.</p>

<h2>Step 1 — make sure you have OpenSSH</h2>
<ul>
  <li><strong>macOS</strong>: pre-installed since the dawn of time.
      Verify with <code>ssh -V</code>.</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) or your distro's equivalent.</li>
  <li><strong>Windows 10/11</strong>: OpenSSH ships as an optional
      feature. From PowerShell:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>Step 2 — download your key</h2>
<p>Log in at <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>. Your
private key is offered as a one-time download. Treat it like a
password — anyone with that file can publish under your account.</p>

<h2>Step 3 — (optional) install the airweb wrapper</h2>
<p>The <code>airweb</code> wrapper just builds the right <code>ssh</code>
command for you and prints the public URL up front. Install it globally
with npm:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>Then use:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>Troubleshooting the install</h2>
<ul>
  <li><strong>"<code>ssh</code> not found"</strong> — confirm OpenSSH is
      on your <code>PATH</code>. On Windows reopen the terminal after
      installing the optional feature.</li>
  <li><strong>"Permissions are too open"</strong> on macOS/Linux — run
      <code>chmod 600</code> on the key file.</li>
  <li><strong>Corporate proxy?</strong> SSH can tunnel over HTTPS using
      <code>-o&nbsp;ProxyCommand</code>. See
      <a href="/troubleshooting#corporate-proxy">Troubleshooting</a>.</li>
</ul>
`,
      },
    ],
  },

  {
    id: 'tunneling',
    label: 'Tunneling',
    pages: [
      {
        slug: 'http-tunnels',
        title: 'HTTP tunnels — sharing a web app',
        description:
          'Detailed reference for AirWeb HTTP tunnels: choosing a ' +
          'subdomain, request flow, websockets, host headers, custom ' +
          'paths and concurrent tunnels on one account.',
        keywords:
          'http tunnel, AirWeb subdomain, websocket tunnel, ssh -R 80, ' +
          'reverse proxy localhost, share react dev server, expose ' +
          'rails server',
        html: `
<h1>HTTP tunnels</h1>
<p class="lead">When you ask AirWeb for <code>-R 80:localhost:&lt;port&gt;</code>
you don't actually bind port 80 on the server — that would be one tunnel
per machine. Instead AirWeb's HTTP router uses the <em>SSH username</em>
as a subdomain and routes by Host header.</p>

<h2>The request flow</h2>
<ol>
  <li>A visitor opens
      <code>https://myapp.{{PUBLIC_DOMAIN}}</code>.</li>
  <li>The public HTTP router receives the request and inspects the
      <code>Host</code> header.</li>
  <li>It finds the tunnel registered for the <code>myapp</code>
      subdomain and asks the SSH connection to open a new channel.</li>
  <li>Your <code>ssh</code> client receives that channel and forwards
      the bytes to <code>localhost:&lt;port&gt;</code>.</li>
  <li>The response travels back the same way.</li>
</ol>

<h2>Choosing a subdomain</h2>
<p>The subdomain is the SSH username:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>Anyone can use any name that is not currently leased. If you want a
name that nobody else can ever grab, lease a
<a href="/handles">handle</a> on the marketplace.</p>

<h2>Websockets and streaming</h2>
<p>Connections survive the HTTP/1.1 <code>Upgrade</code> dance, so
WebSocket and Server-Sent Events tunnels work out of the box. There is
no buffering layer in front of your service — bytes are forwarded as
soon as they arrive.</p>

<h2>Multiple tunnels at once</h2>
<p>Open as many SSH sessions as you like, each with its own subdomain.
A common pattern for a frontend developer is two terminals:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>The OAuth callbacks on both will keep working across restarts as long
as the subdomains stay the same.</p>

<h2>Host headers and base paths</h2>
<p>Requests are forwarded with the original <code>Host</code> rewritten
to match the public hostname. Most frameworks accept this; if yours
generates absolute URLs from a hard-coded host, set the framework's
"trusted host" or "external URL" setting to
<code>myapp.{{PUBLIC_DOMAIN}}</code>.</p>
`,
      },
      {
        slug: 'tcp-tunnels',
        title: 'TCP tunnels — databases, game servers and more',
        description:
          'Forward arbitrary TCP traffic — Postgres, Redis, Minecraft, ' +
          'SSH-into-a-jumpbox — through an AirWeb reverse tunnel.',
        keywords:
          'tcp tunnel, expose postgres, expose redis, expose ssh, ' +
          'minecraft server tunnel, reverse tcp forwarding',
        html: `
<h1>TCP tunnels</h1>
<p class="lead">HTTP is the common case, but AirWeb can carry any TCP
protocol. Ask for a port other than 80 in your <code>-R</code> flag and
the server will bind a dedicated TCP listener for you.</p>

<h2>Pick a port or let the server pick</h2>
<pre><code># Ask for a specific port
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# Let the server pick a free one (port 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p>If you pass <code>0</code>, watch the SSH banner — the assigned port
is printed there and shown on your
<a href="{{APEX}}/connections">connections</a> dashboard.</p>

<h2>Connecting clients</h2>
<p>The public address is <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code>:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>What about UDP?</h2>
<p>SSH only understands TCP. For UDP services (DNS, QUIC, most realtime
games) you can wrap them in a TCP tunnel like <em>udp-over-tcp</em> on
both ends, or run a small WireGuard relay through the HTTP tunnel.</p>

<h2>Security warning</h2>
<p>A raw TCP tunnel inherits whatever authentication the underlying
service offers. <strong>Never expose an unauthenticated database</strong>
to the public internet, even for "just a minute". Add a password, then
add another firewall on top of that.</p>
`,
      },
      {
        slug: 'handles',
        title: 'Handles — leasing a permanent subdomain',
        description:
          'A handle is a reserved subdomain only your account can ' +
          'publish under. Learn how to bid on, lease and renew handles ' +
          'through the AirWeb marketplace.',
        keywords:
          'reserve subdomain, custom URL, handle lease, AirWeb ' +
          'marketplace, vanity subdomain, permanent ngrok URL',
        html: `
<h1>Handles</h1>
<p class="lead">By default subdomains are first-come-first-served. The
moment you disconnect, the name is free again. <strong>Handles</strong>
are leases — you pay a small amount of credit to reserve a name so only
your account can publish on it.</p>

<h2>How leasing works</h2>
<ol>
  <li>Search for a name on the
      <a href="{{APEX}}/marketplace">marketplace</a>.</li>
  <li>If the name is unleased, you can claim it for the listed monthly
      price. Popular names cost more.</li>
  <li>While the lease is active, all SSH sessions trying to use that
      username from any other account are rejected.</li>
  <li>Renew with one click before expiry. If you let a handle lapse, it
      goes back into the pool after a short grace period.</li>
</ol>

<h2>Why bother?</h2>
<ul>
  <li><strong>Stable webhooks.</strong> GitHub, Stripe, Slack and
      friends only have to be configured once.</li>
  <li><strong>Brand.</strong> <code>https://yourname.{{PUBLIC_DOMAIN}}</code>
      is easier to share than a random string.</li>
  <li><strong>Security.</strong> Nobody else can squat on the name
      while you sleep.</li>
</ul>

<h2>Topping up credit</h2>
<p>Lease prices are denominated in credits (AWC). You can buy more from
the <a href="{{APEX}}/dashboard">dashboard</a>. See the
<a href="/credits">credits guide</a> for current pricing.</p>
`,
      },
    ],
  },

  {
    id: 'platform',
    label: 'Platform',
    pages: [
      {
        slug: 'credits',
        title: 'Credits, billing and the AWC economy',
        description:
          'Credits (AWC) are the unit of value inside AirWeb — used for ' +
          'handle leases, premium subdomains and tipping creators. ' +
          'Learn how the economy works and how to top up.',
        keywords:
          'AirWeb credits, AWC token, in-app billing, tunneling pricing, ' +
          'handle pricing, top up balance, credit transfer',
        html: `
<h1>Credits and billing</h1>
<p class="lead">Everything that has a price inside AirWeb is priced in
<strong>AirWeb Credits (AWC)</strong>. They are simple internal
accounting units — there is no blockchain involved.</p>

<h2>How you get credits</h2>
<ul>
  <li><strong>Free starter balance.</strong> Every new account is
      seeded with a small balance so you can lease your first handle
      without paying.</li>
  <li><strong>Top up.</strong> Buy more from the dashboard.</li>
  <li><strong>Earn by hosting.</strong> If you keep a tunnel up, the
      uptime ticker drips a tiny stipend to your balance each minute.</li>
  <li><strong>Marketplace.</strong> Sell handles you no longer need.</li>
</ul>

<h2>How you spend credits</h2>
<ul>
  <li>Leasing handles (recurring).</li>
  <li>Premium options like reserved TCP port ranges.</li>
  <li>Tipping other accounts directly.</li>
</ul>

<h2>USD estimates</h2>
<p>Headers everywhere on the site show a USD estimate next to your
balance. The rate is set per-deployment and exposed via
<code>GET&nbsp;{{APEX}}/api/config</code>. It is an
<em>estimate</em>, not an exchange rate — there is no way to convert
credit back to cash.</p>

<h2>Ledger</h2>
<p>Every movement of credit is recorded in an append-only ledger you
can inspect at any time:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>The dashboard renders the same data with friendlier labels.</p>
`,
      },
      {
        slug: 'dashboard',
        title: 'The dashboard — your AirWeb home base',
        description:
          'Inside the AirWeb dashboard you manage tunnels, handles, ' +
          'credits and account settings. Tour every panel and learn ' +
          'every shortcut.',
        keywords:
          'AirWeb dashboard, manage tunnels, ssh key management, ' +
          'account balance, account settings, language and theme',
        html: `
<h1>The dashboard</h1>
<p class="lead">Sign in at <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>
to land on a single page that gives you eyes on everything happening
on your account.</p>

<h2>Live tunnels</h2>
<p>The top panel lists every tunnel currently bound to your account,
including the subdomain or TCP port, time connected and bytes
transferred. Click a row to copy the public URL.</p>

<h2>Handles</h2>
<p>Leases you own appear here with their expiry date. Renewals are one
click.</p>

<h2>Credits</h2>
<p>Your balance, today's earn rate and a sparkline of recent activity.
<a href="/credits">Read more about credits.</a></p>

<h2>Header chrome</h2>
<p>The top header is the same on every AirWeb page (dashboard,
marketplace, connections, docs and any internal server). The gear icon
opens settings for theme, language and currency — your preferences are
stored in a cookie scoped to
<code>.{{PUBLIC_DOMAIN_BASE}}</code> so they follow you across every
subdomain.</p>
`,
      },
      {
        slug: 'connections',
        title: 'The Connections page — live tunnel telemetry',
        description:
          'See every live SSH tunnel into the AirWeb cluster — yours ' +
          'and the public ones — with real-time bytes-in, bytes-out ' +
          'and origin information.',
        keywords:
          'live tunnels, tunnel telemetry, AirWeb connections, ' +
          'observability, ssh session list',
        html: `
<h1>Connections</h1>
<p class="lead">The <a href="{{APEX}}/connections">/connections</a> page
streams a real-time view of every active tunnel.</p>

<h2>Columns</h2>
<dl>
  <dt>Subdomain / port</dt><dd>What the public sees.</dd>
  <dt>Origin</dt><dd>The IP address the SSH session connected from
      (masked for non-admin users).</dd>
  <dt>Up time</dt><dd>How long the session has been active.</dd>
  <dt>Bytes in / out</dt><dd>Cumulative traffic over the lifetime of
      the tunnel.</dd>
</dl>

<h2>Public vs. private rows</h2>
<p>Anyone can see <em>that</em> a tunnel exists at
<code>foo.{{PUBLIC_DOMAIN}}</code> — that's the whole point of running
on a shared domain — but only the owner and admins can see metadata
like origin IP or username.</p>

<h2>Server-Sent Events</h2>
<p>The page is powered by an SSE stream at
<code>{{APEX}}/api/connections/events</code>. Subscribe yourself if you
want to build a custom dashboard or alerting rule.</p>
`,
      },
      {
        slug: 'marketplace',
        title: 'Marketplace — buy and sell handles',
        description:
          'Browse and bid on AirWeb handles. Sellers list names they no ' +
          'longer need; buyers grab the perfect subdomain.',
        keywords:
          'AirWeb marketplace, handle auction, subdomain marketplace, ' +
          'buy domain alternative, sell handle',
        html: `
<h1>Marketplace</h1>
<p class="lead">The <a href="{{APEX}}/marketplace">marketplace</a> is
where handles change hands. It is small on purpose — search, click
buy, you own it.</p>

<h2>Listing a handle</h2>
<ol>
  <li>Open one of your leased handles in the dashboard.</li>
  <li>Click <em>List for sale</em> and set a price in AWC.</li>
  <li>The listing appears on the marketplace immediately.</li>
  <li>When someone buys, credit is moved to your account and the
      remaining lease transfers to them.</li>
</ol>

<h2>Listing rules</h2>
<ul>
  <li>You can only list handles you currently own.</li>
  <li>Listings expire when the underlying lease expires.</li>
  <li>The marketplace takes no cut — list price equals sale price.</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (auth required)</code></pre>
<p>See the <a href="/api">API reference</a> for full schemas.</p>
`,
      },
    ],
  },

  {
    id: 'reference',
    label: 'Reference',
    pages: [
      {
        slug: 'cli',
        title: 'The airweb CLI reference',
        description:
          'Every flag accepted by the airweb command-line wrapper, with ' +
          'examples for HTTP and TCP tunnels.',
        keywords:
          'airweb cli, command reference, ssh wrapper, --sub --key ' +
          '--server --remote, AirWeb flags',
        html: `
<h1>CLI reference</h1>
<p class="lead">The optional <code>airweb</code> wrapper saves you from
remembering SSH flags. Install it with
<code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code>.</p>

<h2>Usage</h2>
<pre><code>airweb http &lt;localPort&gt; [--sub &lt;name&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;

airweb tcp &lt;localPort&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;</code></pre>

<h2>Flags</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(required)</em></dt>
  <dd>The AirWeb SSH endpoint, e.g.
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>.</dd>

  <dt><code>--key &lt;path&gt;</code> <em>(required)</em></dt>
  <dd>Path to your downloaded key file.</dd>

  <dt><code>--sub &lt;name&gt;</code></dt>
  <dd>HTTP mode only. The subdomain you want to publish under. Defaults
      to a randomly generated name.</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>TCP mode only. Ask the server for a specific public port. Omit to
      let the server pick.</dd>

  <dt><code>--user &lt;name&gt;</code></dt>
  <dd>Override the SSH username. Useful when it must differ from the
      subdomain.</dd>

  <dt><code>--help</code></dt>
  <dd>Print usage.</dd>
</dl>

<h2>Examples</h2>
<pre><code># A React dev server on a vanity subdomain
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# A Postgres database on a chosen public port
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,
      },
      {
        slug: 'api',
        title: 'HTTP API reference',
        description:
          'Every JSON endpoint AirWeb exposes — for authentication, ' +
          'balance and ledger, handle marketplace and admin telemetry.',
        keywords:
          'AirWeb API, json api, ssh tunneling api, /api/me, /api/ledger, ' +
          '/api/listings, oauth-free api',
        html: `
<h1>HTTP API</h1>
<p class="lead">All endpoints are <code>application/json</code> and live
under <code>{{APEX}}/api</code>. Authentication is cookie-based — log
in via <code>POST&nbsp;/api/login</code> or
<code>POST&nbsp;/api/register</code> and the server sets a session
cookie scoped to <code>.{{PUBLIC_DOMAIN_BASE}}</code>.</p>

<h2>Auth</h2>
<table class="api">
  <thead><tr><th>Method</th><th>Path</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>Create an account, set session cookie, return key download URL.</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>Log in with a username + key signature.</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>Clear the session cookie.</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>Profile, balance and lease summary for the signed-in user.</td></tr>
  </tbody>
</table>

<h2>Public configuration</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>Credits</h2>
<pre><code>GET /api/ledger        # auth required
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>Marketplace</h2>
<table class="api">
  <thead><tr><th>Method</th><th>Path</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>Browse all open listings.</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>Filter by seller.</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>List one of your handles for sale.</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>Lease a free name or renew one of yours.</td></tr>
  </tbody>
</table>

<h2>Errors</h2>
<p>All endpoints return JSON with an <code>error</code> field on failure
and an appropriate HTTP status code. Validation errors are 400,
auth-required is 401, payment-required is 402, missing resources are
404 and rate-limited requests are 429.</p>
`,
      },
      {
        slug: 'security',
        title: 'Security model and best practices',
        description:
          'How AirWeb authenticates clients, isolates tunnels and ' +
          'protects user data — plus best practices for hardening any ' +
          'service you expose.',
        keywords:
          'AirWeb security, ssh key auth, tunnel isolation, secret ' +
          'rotation, abuse handling, threat model',
        html: `
<h1>Security model</h1>
<p class="lead">A short, honest threat model: what AirWeb does, what it
does not, and how to use it safely.</p>

<h2>Authentication</h2>
<p>SSH key-pair authentication only — passwords are disabled at the
server level. Your key is generated on the server during registration
and downloaded once. Lose it and you lose access to your account; we
cannot reissue it (we never stored it).</p>

<h2>Per-account isolation</h2>
<p>Subdomains and TCP ports are owned by the account that registers
them. A second client that tries to bind a leased name is rejected
during the <code>tcpip-forward</code> handshake.</p>

<h2>What AirWeb sees</h2>
<ul>
  <li>The bytes flowing through your tunnel pass through the public
      router. The router never logs request bodies, only counters.</li>
  <li>If you tunnel HTTP without TLS termination on your end, the
      router sees plaintext requests in memory while routing.</li>
  <li>If you need end-to-end TLS, terminate it inside your service and
      tunnel the encrypted bytes through a TCP tunnel.</li>
</ul>

<h2>Best practices for the service you expose</h2>
<ul>
  <li><strong>Assume the internet is hostile.</strong> Add
      authentication even on "internal" prototypes.</li>
  <li><strong>Rate-limit endpoints</strong> with serious side effects.</li>
  <li><strong>Rotate keys</strong> if you suspect compromise — delete
      the old account from the dashboard and create a new one.</li>
  <li><strong>Use short-lived handles</strong> for things tied to a
      specific demo or talk so they expire automatically.</li>
</ul>

<h2>Reporting issues</h2>
<p>Found a vulnerability? Email
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>. We disclose responsibly
and credit reporters publicly.</p>
`,
      },
      {
        slug: 'faq',
        title: 'Frequently asked questions',
        description:
          'Quick answers to the most common AirWeb questions: how it ' +
          'compares to ngrok, whether you can self-host, custom ' +
          'domains, free quota and more.',
        keywords:
          'AirWeb FAQ, AirWeb vs ngrok, self-hosted tunneling, custom ' +
          'domain ssh tunnel, free tier, AirWeb pricing FAQ',
        html: `
<h1>Frequently asked questions</h1>

<h3>How does AirWeb compare to ngrok or Cloudflare Tunnel?</h3>
<p>AirWeb's transport is plain OpenSSH — no proprietary protocol, no
client binary, no kernel module. The trade-off is that ngrok-style
inspect UIs and Cloudflare's edge network are not part of the package.
If "ssh works behind every firewall" is enough for you, AirWeb is the
simpler answer.</p>

<h3>Can I run my own AirWeb server?</h3>
<p>Yes — the repo is the same code that runs the hosted service.
Clone it, copy <code>config.default.json</code> to
<code>config.json</code>, set <code>AIRWEB_PUBLIC_DOMAIN</code> and run
<code>npm start</code>. DNS-wise you need a wildcard A record pointing
<code>*.your-domain</code> at the host.</p>

<h3>Is there a free tier on the hosted service?</h3>
<p>Yes — every account starts with enough credit to lease a short
handle for a month and run as many anonymous tunnels as you like in
the meantime.</p>

<h3>Can I bring my own domain?</h3>
<p>On the hosted service, not yet — handles live under the main
public domain. On a self-hosted instance you are of course free to
configure any wildcard you control.</p>

<h3>What happens to my tunnel if the network drops?</h3>
<p>The SSH client retries automatically with
<code>ServerAliveInterval</code> if you used the wrapper. With raw
<code>ssh</code> you can add <code>-o&nbsp;ServerAliveInterval=30</code>
to get the same behaviour, or wrap the command in
<code>autossh</code>.</p>

<h3>Does AirWeb support HTTP/2 or HTTP/3?</h3>
<p>The public edge speaks HTTP/1.1 and HTTP/2. HTTP/3 (QUIC) requires
UDP and is on the roadmap. Your origin can speak whatever it wants —
the proxy normalises to HTTP/1.1 for the tunnel hop.</p>

<h3>Can I use AirWeb for production traffic?</h3>
<p>People do, but understand what you are buying. A single SSH session
is a single point of failure. For real production we recommend the
self-hosted route with multiple regions and active/active sessions
backed by a load balancer.</p>
`,
      },
      {
        slug: 'troubleshooting',
        title: 'Troubleshooting common AirWeb errors',
        description:
          'Recipes for fixing the errors people hit most: forwarding ' +
          'failures, port already bound, key permissions, corporate ' +
          'proxies and more.',
        keywords:
          'AirWeb troubleshooting, ssh forward failed, port already in ' +
          'use, ssh permission denied, corporate proxy ssh, debug ssh',
        html: `
<h1>Troubleshooting</h1>

<h2 id="forwarding-failed">"Remote forwarding failed"</h2>
<p>The server refused to bind the port you asked for. Common causes:</p>
<ul>
  <li>Someone else (or your previous SSH session) already holds that
      subdomain or TCP port. Wait a moment and retry.</li>
  <li>You asked for a privileged port (&lt; 1024) but you are not the
      handle owner. Use port 80 (special-cased) or a port &gt;= 1024.</li>
  <li>The handle is leased by another account. Pick a different name
      or lease it on the <a href="{{APEX}}/marketplace">marketplace</a>.</li>
</ul>

<h2 id="permission-denied">"Permission denied (publickey)"</h2>
<ul>
  <li>Double-check the <code>-i</code> path points at the file you
      downloaded.</li>
  <li>On macOS/Linux run <code>chmod 600</code> on the key file — SSH
      refuses world-readable private keys.</li>
  <li>Add <code>-o&nbsp;IdentitiesOnly=yes</code> if you have a busy
      <code>ssh-agent</code> that is offering wrong keys first.</li>
</ul>

<h2 id="corporate-proxy">Behind a corporate proxy</h2>
<p>If outbound port {{SSH_PORT}} is blocked you can run SSH over the
proxy with <code>corkscrew</code> or
<code>ProxyCommand</code>:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">My webhook receiver responds twice</h2>
<p>You probably have two SSH sessions both claiming the same
subdomain. Look at the
<a href="{{APEX}}/connections">connections page</a> — if two rows
share a name, kill one.</p>

<h2 id="https-redirect">"Site does not have HTTPS"</h2>
<p>On the hosted service every subdomain is served over both
<code>http</code> and <code>https</code>. If your service issues a
redirect to <code>http://</code> on its own, set its "external URL"
config to <code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>.</p>

<h2>Getting more debug output</h2>
<p>Add <code>-vvv</code> to the <code>ssh</code> command for the full
chatty handshake log. Most "it doesn't work" reports get solved by
sharing that output.</p>
`,
      },
      {
        slug: 'changelog',
        title: 'Changelog',
        description:
          'Notable changes to AirWeb across versions — features, ' +
          'breaking changes and security fixes.',
        keywords:
          'AirWeb changelog, release notes, version history, new ' +
          'features, breaking changes',
        html: `
<h1>Changelog</h1>
<p class="lead">Backwards-incompatible changes are flagged with
<strong>BREAKING</strong>. Dates are when the change shipped to the
hosted service.</p>

<h3>2026-05 — Unified header and shared settings</h3>
<ul>
  <li>One header design across the landing page, dashboard,
      marketplace, connections and docs.</li>
  <li>Theme, language and currency now persist via a cookie scoped to
      <code>.{{PUBLIC_DOMAIN_BASE}}</code> so they follow you across
      every subdomain.</li>
</ul>

<h3>2026-03 — Realistic reward economy</h3>
<ul>
  <li>Starter inventory tuned to deliver genuinely useful items
      instead of random junk.</li>
  <li>Level certificates fixed: now awarded on every level
      advancement, not only on title change.</li>
</ul>

<h3>2025-12 — Internal-server CORS</h3>
<ul>
  <li>Internal services like this docs site can now call the apex API
      from a different subdomain.
      <strong>BREAKING</strong>: scripts that previously hit
      <code>/api/me</code> assuming same-origin must now send
      <code>credentials:&nbsp;'include'</code>.</li>
</ul>

<h3>2025-09 — Handle marketplace</h3>
<ul>
  <li>Marketplace launched. Lease, list and transfer handles.</li>
</ul>
`,
      },
    ],
  },
];

module.exports = { SECTIONS };
