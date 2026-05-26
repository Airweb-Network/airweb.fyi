// German (de) translations for AirWeb docs.
module.exports = {
  'getting-started.label': 'Einstieg',
  'tunneling.label':       'Tunnel',
  'platform.label':        'Plattform',
  'reference.label':       'Referenz',

  // ---------- introduction ----------
  'introduction.title': 'Einführung in AirWeb',
  'introduction.description':
    'AirWeb verwandelt einen einzigen SSH-Befehl in eine öffentliche HTTPS-URL. ' +
    'Erfahre, was AirWeb ist, wie reverse SSH-Tunnel funktionieren und ' +
    'warum es der schnellste Weg ist, einen lokalen Service mit der Welt zu teilen.',
  'introduction.html': `
<h1>Was ist AirWeb?</h1>
<p class="lead">AirWeb ist ein Reverse-Tunneling-Dienst, mit dem du jeden
Dienst auf deinem Laptop oder in einem privaten Netzwerk allein mit dem
<code>ssh</code>-Befehl ins öffentliche Internet stellst. Kein Agent zu
installieren — wenn OpenSSH da ist (in modernem macOS, Linux und Windows
standardmäßig dabei), hast du schon alles.</p>

<h2>So funktioniert's</h2>
<p>Wenn du <code>ssh&nbsp;-R</code> gegen AirWeb startest, akzeptiert unser
SSH-Server die <em>Reverse-Port-Forward</em>-Anfrage des Clients und
öffnet einen öffentlichen Listener für dich. Traffic, der diesen Listener
erreicht, wird über die bestehende SSH-Verbindung zurück an einen Port auf
deiner Maschine geschickt.</p>
<ul>
  <li>Für HTTP ist der öffentliche Listener unser geteilter
      80/443-Reverse-Proxy auf <code>{{PUBLIC_DOMAIN}}</code>, der per
      Subdomain routet.</li>
  <li>Für rohes TCP wählt der Server (oder du) einen dedizierten Port und
      die Bytes werden unverändert weitergereicht.</li>
</ul>

<h2>Warum man AirWeb nutzt</h2>
<ul>
  <li><strong>Null Installation.</strong> Keine Client-Binärdateien, keine
      Kernel-Module, keine Browser-Erweiterungen. Nur OpenSSH und eine
      Schlüsseldatei.</li>
  <li><strong>Echte öffentliche URLs.</strong> Du bekommst
      <code>https://&lt;name&gt;.{{PUBLIC_DOMAIN}}</code> — nützlich für
      Webhooks, Mobile-Tests, OAuth-Callbacks, Demos und IoT.</li>
  <li><strong>Dauerhafte Handles.</strong> Miete einen Namen im
      <a href="{{APEX}}/marketplace">Marketplace</a> und niemand kann ihn
      dir wegschnappen.</li>
  <li><strong>Selbst hostbar.</strong> Der gesamte Code, der diesen Dienst
      betreibt, liegt im selben Repo, das du selbst deployen kannst.</li>
</ul>

<h2>Wie weiter</h2>
<p>Am schnellsten kapierst du AirWeb, wenn du <em>jetzt</em> eine lokale
Web-App veröffentlichst. Weiter zur
<a href="/quick-start">Schnellstart-Anleitung</a> — in unter zwei Minuten
hast du eine Live-URL.</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': 'Schnellstart — dein erster Tunnel in 60 Sekunden',
  'quick-start.description':
    'Veröffentliche einen lokalen HTTP-Dienst mit einem einzigen ssh-Befehl. ' +
    'Diese Schritt-für-Schritt-Anleitung gibt dir in etwa einer Minute eine funktionierende https-URL.',
  'quick-start.html': `
<h1>Schnellstart</h1>
<p class="lead">Drei Schritte. Ein Terminal. Eine öffentliche URL.</p>

<h2>1. Account anlegen und Schlüssel holen</h2>
<p>Geh auf <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> und klick
auf <em>Create account</em>. Die Seite reicht dir eine Datei namens
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code>. Das ist dein privater
SSH-Schlüssel — sicher aufbewahren.</p>
<pre><code># nur macOS / Linux — unter Windows überspringen
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. Irgendwas auf localhost starten</h2>
<p>Alles, was HTTP spricht, geht. Falls du keine App zur Hand hast:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. Den Tunnel aufmachen</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>Öffne jetzt <code>http://myapp.{{PUBLIC_DOMAIN}}</code> im Browser. Die
Anfragen tauchen im Terminal deines lokalen Servers auf. Mit
<kbd>Strg</kbd>+<kbd>C</kbd> nimmst du die URL wieder offline.</p>

<h2>Was jede Option tut</h2>
<dl>
  <dt><code>-i &lt;datei&gt;</code></dt>
  <dd>Der heruntergeladene private Schlüssel.</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Unser SSH-Server lauscht auf Port {{SSH_PORT}}, nicht auf 22.</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>Reverse-Forward des öffentlichen HTTP-Ports auf lokal 3000.</dd>
  <dt><code>myapp@…</code></dt>
  <dd>Der SSH-Username wird zur öffentlichen Subdomain.</dd>
</dl>

<h2>Was als Nächstes</h2>
<ul>
  <li><a href="/http-tunnels">Mehrere Apps gleichzeitig veröffentlichen</a></li>
  <li><a href="/tcp-tunnels">Datenbank oder Gameserver freigeben (rohes TCP)</a></li>
  <li><a href="/handles">Einen Namen mit einem geleasten Handle dauerhaft sichern</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': 'AirWeb-Client installieren',
  'installation.description':
    'AirWeb läuft mit dem System-OpenSSH unter macOS, Linux und Windows. ' +
    'Wer freundlichere Befehle möchte, kann zusätzlich den optionalen ' +
    '`airweb`-Node.js-Wrapper nutzen. Anleitung für beides unten.',
  'installation.html': `
<h1>Installation</h1>
<p class="lead">Der AirWeb-„Client" ist einfach die <code>ssh</code>-Binary,
die schon auf deinem Rechner liegt. Wenn du es etwas freundlicher willst,
gibt es einen optionalen Node.js-Wrapper.</p>

<h2>Schritt 1 — Prüfen, dass OpenSSH installiert ist</h2>
<ul>
  <li><strong>macOS</strong>: seit Ewigkeiten vorinstalliert. Prüfe mit
      <code>ssh -V</code>.</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) oder das Äquivalent deiner Distribution.</li>
  <li><strong>Windows 10/11</strong>: OpenSSH gibt's als optionales
      Feature. In PowerShell:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>Schritt 2 — Schlüssel herunterladen</h2>
<p>Melde dich bei <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> an.
Der private Schlüssel wird einmalig zum Download angeboten. Behandle ihn
wie ein Passwort — wer die Datei hat, kann unter deinem Account
veröffentlichen.</p>

<h2>Schritt 3 — (Optional) den airweb-Wrapper installieren</h2>
<p>Der <code>airweb</code>-Wrapper baut den richtigen
<code>ssh</code>-Befehl für dich und zeigt zuerst die öffentliche URL an.
Global per npm installieren:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>Dann so verwenden:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>Installations-Probleme</h2>
<ul>
  <li><strong>„<code>ssh</code> not found"</strong> — prüfe, dass OpenSSH
      im <code>PATH</code> liegt. Unter Windows nach dem Installieren des
      optionalen Features Terminal neu öffnen.</li>
  <li><strong>„Permissions are too open"</strong> unter macOS/Linux —
      <code>chmod 600</code> auf die Schlüsseldatei.</li>
  <li><strong>Firmenproxy?</strong> SSH kann mit
      <code>-o&nbsp;ProxyCommand</code> über HTTPS tunneln; siehe
      <a href="/troubleshooting#corporate-proxy">Troubleshooting</a>.</li>
</ul>
`,

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'HTTP-Tunnel — eine Web-App teilen',
  'http-tunnels.description':
    'Detaillierte Referenz zu AirWebs HTTP-Tunneln: Subdomain-Wahl, ' +
    'Request-Fluss, WebSockets, Host-Header, eigene Pfade und mehrere ' +
    'gleichzeitige Tunnel pro Account.',
  'http-tunnels.html': `
<h1>HTTP-Tunnel</h1>
<p class="lead">Wenn du AirWeb <code>-R 80:localhost:&lt;port&gt;</code>
gibst, binden wir nicht wirklich Port 80 auf dem Server für dich — das
würde dich auf einen Tunnel pro Maschine festnageln. Stattdessen behandelt
AirWebs HTTP-Router deinen <em>SSH-Usernamen</em> als Subdomain und routet
über den Host-Header.</p>

<h2>Der Weg eines Requests</h2>
<ol>
  <li>Ein Besucher öffnet <code>https://myapp.{{PUBLIC_DOMAIN}}</code>.</li>
  <li>Unser öffentlicher HTTP-Router empfängt den Request und schaut auf
      den <code>Host</code>-Header.</li>
  <li>Er findet den für die Subdomain <code>myapp</code> registrierten
      Tunnel und bittet deine SSH-Verbindung, einen neuen Channel zu
      öffnen.</li>
  <li>Dein <code>ssh</code>-Client empfängt den Channel und reicht Bytes an
      <code>localhost:&lt;port&gt;</code> weiter.</li>
  <li>Die Antwort geht denselben Weg zurück.</li>
</ol>

<h2>Subdomain wählen</h2>
<p>Die Subdomain ist einfach der SSH-Username:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>Jeder gerade nicht geleaste Name ist frei. Willst du einen, den dir
niemand wegnehmen kann, lease ein <a href="/handles">Handle</a> im
Marketplace.</p>

<h2>WebSockets und Streaming</h2>
<p>Die Verbindung bleibt nach dem HTTP/1.1 <code>Upgrade</code>-Handshake
am Leben, also funktionieren Tunnel für WebSockets und Server-Sent Events
sofort. Es gibt keinerlei Buffer-Schicht vor deinem Dienst — Bytes werden
sofort weitergereicht.</p>

<h2>Mehrere Tunnel zur gleichen Zeit</h2>
<p>Öffne so viele SSH-Sessions, wie du willst, jede mit eigener Subdomain.
Häufiges Frontend-Muster mit zwei Terminals:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>OAuth-Callbacks auf beiden Seiten überleben Neustarts, solange die
Subdomains gleich bleiben.</p>

<h2>Host-Header und Base-Pfad</h2>
<p>Requests werden mit überschriebenem <code>Host</code> (zum öffentlichen
Hostnamen) weitergeleitet. Die meisten Frameworks akzeptieren das; baut
dein Framework absolute URLs aus einem fest verdrahteten Host, setze sein
„trusted host" oder „external URL" auf
<code>myapp.{{PUBLIC_DOMAIN}}</code>.</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'TCP-Tunnel — DBs, Gameserver und mehr',
  'tcp-tunnels.description':
    'Beliebigen TCP-Verkehr — Postgres, Redis, Minecraft, Bastion-SSH — ' +
    'durch einen AirWeb-Reverse-Tunnel weiterleiten.',
  'tcp-tunnels.html': `
<h1>TCP-Tunnel</h1>
<p class="lead">HTTP ist der häufige Fall, aber AirWeb kann jedes
TCP-Protokoll tragen. Frage im <code>-R</code> nach einem anderen Port als
80, und der Server bindet einen dedizierten TCP-Listener für dich.</p>

<h2>Port wählen oder dem Server überlassen</h2>
<pre><code># Bestimmten Port anfragen
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# Server soll freien Port wählen (Port 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p>Wenn du <code>0</code> übergibst, achte aufs SSH-Banner — der
zugewiesene Port wird dort ausgegeben und erscheint auch in deinem
<a href="{{APEX}}/connections">Connections</a>-Dashboard.</p>

<h2>Von einem Client verbinden</h2>
<p>Die öffentliche Adresse ist <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code>:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>Und UDP?</h2>
<p>SSH spricht nur TCP. Für UDP-Dienste (DNS, QUIC, die meisten
Echtzeitspiele) packst du sie auf beiden Seiten in einen TCP-Tunnel à la
<em>udp-over-tcp</em> oder lässt einen kleinen WireGuard-Relay über einem
HTTP-Tunnel laufen.</p>

<h2>Sicherheits-Hinweis</h2>
<p>Rohe TCP-Tunnel erben die Authentifizierung des darunterliegenden
Dienstes. <strong>Niemals eine Datenbank ohne Auth ins öffentliche
Internet stellen</strong>, auch nicht „nur kurz". Setz ein Passwort und
einen Firewall davor.</p>
`,

  // ---------- handles ----------
  'handles.title': 'Handles — dauerhafte Subdomains leasen',
  'handles.description':
    'Handles sind reservierte Subdomains, unter denen nur dein Account ' +
    'veröffentlichen darf. Lerne, wie du im AirWeb-Marketplace bietest, ' +
    'leasest und verlängerst.',
  'handles.html': `
<h1>Handles</h1>
<p class="lead">Standardmäßig gilt bei Subdomains: wer zuerst kommt, mahlt
zuerst. Sobald du dich abmeldest, ist der Name wieder frei. Ein
<strong>Handle</strong> ist ein Leasing — du zahlst ein paar Credits, um
einen Namen zu reservieren, und nur dein Account darf darunter
veröffentlichen.</p>

<h2>So funktioniert das Leasing</h2>
<ol>
  <li>Suche einen Namen im <a href="{{APEX}}/marketplace">Marketplace</a>.</li>
  <li>Ist er nicht geleast, kannst du ihn zum angegebenen Monatspreis
      beanspruchen. Beliebte Namen kosten mehr.</li>
  <li>Während der Leasingdauer wird jede SSH-Session von einem anderen
      Account, die diesen Usernamen versucht, abgewiesen.</li>
  <li>Vor Ablauf per Klick verlängern. Lässt du ihn ablaufen, wandert er
      nach kurzer Karenz zurück in den Pool.</li>
</ol>

<h2>Warum leasen?</h2>
<ul>
  <li><strong>Stabile Webhooks.</strong> GitHub, Stripe, Slack usw. nur
      einmal konfigurieren.</li>
  <li><strong>Branding.</strong>
      <code>https://deinname.{{PUBLIC_DOMAIN}}</code> teilt sich besser als
      ein Zufallsstring.</li>
  <li><strong>Sicherheit.</strong> Niemand schnappt dir nachts den Namen
      weg.</li>
</ul>

<h2>Credits aufladen</h2>
<p>Leasings werden in Credits (AWC) abgerechnet. Mehr im
<a href="{{APEX}}/dashboard">Dashboard</a> kaufen. Aktuelle Preise im
<a href="/credits">Credits-Guide</a>.</p>
`,

  // ---------- credits ----------
  'credits.title': 'Credits, Abrechnung und die AWC-Ökonomie',
  'credits.description':
    'Credits (AWC) sind die Werteinheit innerhalb von AirWeb — sie zahlen ' +
    'Handle-Leasings, Premium-Subdomains und Trinkgelder an Creator. ' +
    'Lerne, wie die Ökonomie tickt und wie man auflädt.',
  'credits.html': `
<h1>Credits & Abrechnung</h1>
<p class="lead">Alles mit Preis in AirWeb wird in
<strong>AirWeb-Credits (AWC)</strong> abgerechnet. Eine schlichte interne
Recheneinheit — keine Blockchain.</p>

<h2>Wie du Credits bekommst</h2>
<ul>
  <li><strong>Gratis-Startguthaben.</strong> Jeder neue Account startet
      mit genug, um sein erstes Handle kostenlos zu leasen.</li>
  <li><strong>Aufladen.</strong> Im Dashboard nachkaufen.</li>
  <li><strong>Beim Hosten verdienen.</strong> Solange du Tunnel am Leben
      hältst, tropft dir der Uptime-Zähler pro Minute eine kleine
      Aufwandsentschädigung aufs Guthaben.</li>
  <li><strong>Marketplace.</strong> Handles verkaufen, die du nicht mehr
      brauchst.</li>
</ul>

<h2>Wie du Credits ausgibst</h2>
<ul>
  <li>Handle-Leasings (wiederkehrend).</li>
  <li>Premium-Optionen wie reservierte TCP-Portbereiche.</li>
  <li>Direkte Trinkgelder an andere Accounts.</li>
</ul>

<h2>USD-Schätzung</h2>
<p>Die ganze Seite zeigt neben deinem Guthaben eine USD-Schätzung. Der
Kurs wird pro Deployment konfiguriert und per
<code>GET&nbsp;{{APEX}}/api/config</code> bereitgestellt. Es ist eine
<em>Schätzung</em>, kein Wechselkurs — du kannst Credits nicht in Bargeld
zurücktauschen.</p>

<h2>Das Ledger</h2>
<p>Jede Credit-Bewegung wird in einem nur erweiternden Ledger
festgehalten, das du einsehen kannst:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>Das Dashboard rendert dieselben Daten mit freundlicheren Labels.</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': 'Das Dashboard — deine AirWeb-Basis',
  'dashboard.description':
    'Verwalte Tunnel, Handles, Credits und Account-Einstellungen im ' +
    'AirWeb-Dashboard. Ein Rundgang durch jedes Panel und alle Shortcuts.',
  'dashboard.html': `
<h1>Das Dashboard</h1>
<p class="lead">Melde dich bei <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>
an und du landest auf einer einzigen Seite, die alles zu deinem Account
auf einen Blick zeigt.</p>

<h2>Live-Tunnel</h2>
<p>Das obere Panel listet jeden Tunnel, der gerade an deinen Account
gebunden ist — Subdomain bzw. TCP-Port, Verbindungsdauer, übertragene
Bytes. Eine Zeile klicken kopiert die öffentliche URL.</p>

<h2>Handles</h2>
<p>Deine Leasings erscheinen mit Ablaufdatum. Verlängern per Klick.</p>

<h2>Credits</h2>
<p>Guthaben, heutige Verdienstrate und ein Sparkline-Diagramm der jüngsten
Aktivität. <a href="/credits">Mehr zu Credits hier.</a></p>

<h2>Die gemeinsame Kopfzeile</h2>
<p>Die obere Kopfzeile sieht auf jeder AirWeb-Seite gleich aus (Dashboard,
Marketplace, Connections, Doku und alle internen Services). Über das
Zahnrad öffnest du Theme-, Sprach- und Währungseinstellungen — deine
Präferenzen liegen in Cookies mit Scope
<code>.{{PUBLIC_DOMAIN_BASE}}</code>, also folgen sie dir über alle
Subdomains hinweg.</p>
`,

  // ---------- connections ----------
  'connections.title': 'Connections-Seite — Echtzeit-Tunnel-Telemetrie',
  'connections.description':
    'Sieh jeden aktiven SSH-Tunnel zum AirWeb-Cluster — deine und ' +
    'öffentliche — mit Live-In/Out-Bytes und Quellinfos.',
  'connections.html': `
<h1>Connections</h1>
<p class="lead">Die Seite <a href="{{APEX}}/connections">/connections</a>
streamt jeden aktiven Tunnel in Echtzeit.</p>

<h2>Spalten</h2>
<dl>
  <dt>Subdomain / Port</dt><dd>Was die Außenwelt sieht.</dd>
  <dt>Quelle</dt><dd>Die IP-Adresse, von der die SSH-Session aufgebaut
      wurde (für Nicht-Admins maskiert).</dd>
  <dt>Uptime</dt><dd>Wie lange die Session aktiv ist.</dd>
  <dt>Bytes In / Out</dt><dd>Kumulierter Traffic über die Lebenszeit des
      Tunnels.</dd>
</dl>

<h2>Öffentliche vs. private Zeilen</h2>
<p>Jeder kann sehen, dass ein Tunnel auf
<code>foo.{{PUBLIC_DOMAIN}}</code> <em>existiert</em> — das ist der Sinn
einer geteilten Domain — aber Metadaten wie Quell-IP und Username sehen
nur Besitzer und Admins.</p>

<h2>Server-Sent Events</h2>
<p>Die Seite wird vom SSE-Stream
<code>{{APEX}}/api/connections/events</code> gespeist. Abonniere selbst,
wenn du eigene Dashboards oder Alarmregeln bauen willst.</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': 'Marketplace — Handles kaufen und verkaufen',
  'marketplace.description':
    'Durchstöbere und biete auf AirWeb-Handles. Verkäufer listen, was sie ' +
    'nicht mehr brauchen; Käufer holen sich die perfekte Subdomain.',
  'marketplace.html': `
<h1>Der Marketplace</h1>
<p class="lead">Der <a href="{{APEX}}/marketplace">Marketplace</a> ist
der Ort, an dem Handles den Besitzer wechseln. Wir haben ihn bewusst klein
gebaut — suchen, kaufen klicken, gehört dir.</p>

<h2>Ein Handle anbieten</h2>
<ol>
  <li>Öffne eines deiner geleasten Handles im Dashboard.</li>
  <li>Klick <em>List for sale</em> und setze einen Preis in AWC.</li>
  <li>Das Inserat erscheint sofort im Marketplace.</li>
  <li>Beim Kauf werden die Credits deinem Account gutgeschrieben und das
      Restleasing wandert zum Käufer.</li>
</ol>

<h2>Inserats-Regeln</h2>
<ul>
  <li>Du darfst nur Handles listen, die du aktuell besitzt.</li>
  <li>Inserate verfallen, wenn das zugrundeliegende Leasing verfällt.</li>
  <li>Der Marketplace nimmt keine Provision — der angezeigte Preis ist,
      was du bekommst.</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (Auth erforderlich)</code></pre>
<p>Vollständiges Schema in der <a href="/api">API-Referenz</a>.</p>
`,

  // ---------- cli ----------
  'cli.title': 'airweb-CLI-Referenz',
  'cli.description':
    'Alle Flags, die der airweb-Kommandozeilen-Wrapper akzeptiert, mit ' +
    'Beispielen für HTTP- und TCP-Tunnel.',
  'cli.html': `
<h1>CLI-Referenz</h1>
<p class="lead">Der optionale <code>airweb</code>-Wrapper erspart dir das
Merken der SSH-Flags. Installation via
<code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code>.</p>

<h2>Nutzung</h2>
<pre><code>airweb http &lt;localPort&gt; [--sub &lt;name&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;

airweb tcp &lt;localPort&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;</code></pre>

<h2>Flags</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(Pflicht)</em></dt>
  <dd>Der AirWeb-SSH-Endpoint, z. B.
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>.</dd>

  <dt><code>--key &lt;path&gt;</code> <em>(Pflicht)</em></dt>
  <dd>Pfad zur heruntergeladenen Schlüsseldatei.</dd>

  <dt><code>--sub &lt;name&gt;</code></dt>
  <dd>Nur HTTP-Modus. Die Subdomain, unter der veröffentlicht wird.
      Default: zufälliger Name.</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>Nur TCP-Modus. Fordert vom Server einen bestimmten öffentlichen Port
      an. Ohne Angabe wählt der Server.</dd>

  <dt><code>--user &lt;name&gt;</code></dt>
  <dd>Überschreibt den SSH-Usernamen. Nützlich, wenn User und Subdomain
      unterschiedlich sein müssen.</dd>

  <dt><code>--help</code></dt>
  <dd>Gibt die Hilfe aus.</dd>
</dl>

<h2>Beispiele</h2>
<pre><code># React-Devserver auf deiner Lieblings-Subdomain
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# Postgres auf gewähltem öffentlichem Port
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'HTTP-API-Referenz',
  'api.description':
    'Jeder JSON-Endpoint, den AirWeb anbietet — Auth, Guthaben & Ledger, ' +
    'Handle-Marketplace und Admin-Telemetrie.',
  'api.html': `
<h1>HTTP-API</h1>
<p class="lead">Alle Endpoints sind <code>application/json</code> und
liegen unter <code>{{APEX}}/api</code>. Auth läuft über Cookies — log dich
mit <code>POST&nbsp;/api/login</code> oder
<code>POST&nbsp;/api/register</code> ein, und der Server setzt einen
Session-Cookie mit Scope <code>.{{PUBLIC_DOMAIN_BASE}}</code>.</p>

<h2>Auth</h2>
<table class="api">
  <thead><tr><th>Methode</th><th>Pfad</th><th>Hinweise</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>Legt Account an, setzt Cookie, liefert Download-URL für den Schlüssel.</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>Anmeldung mit Username + Schlüsselsignatur.</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>Löscht den Session-Cookie.</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>Profil, Guthaben und Leasing-Übersicht des angemeldeten Users.</td></tr>
  </tbody>
</table>

<h2>Öffentliche Konfiguration</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>Credits</h2>
<pre><code>GET /api/ledger        # Auth erforderlich
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>Marketplace</h2>
<table class="api">
  <thead><tr><th>Methode</th><th>Pfad</th><th>Hinweise</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>Alle offenen Inserate durchblättern.</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>Nach Verkäufer filtern.</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>Ein eigenes Handle zum Verkauf stellen.</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>Freien Namen leasen oder eigenes Handle verlängern.</td></tr>
  </tbody>
</table>

<h2>Fehler</h2>
<p>Alle Endpoints geben bei Fehler JSON mit
<code>error</code>-Feld und passendem HTTP-Status zurück. 400 =
Validierungsfehler, 401 = Auth nötig, 402 = Bezahlung nötig, 404 =
Ressource fehlt, 429 = Rate-Limit.</p>
`,

  // ---------- security ----------
  'security.title': 'Sicherheitsmodell und Best Practices',
  'security.description':
    'Wie AirWeb Clients authentifiziert, Tunnel isoliert und Nutzerdaten ' +
    'schützt — plus Best Practices, um deine veröffentlichten Dienste zu härten.',
  'security.html': `
<h1>Sicherheitsmodell</h1>
<p class="lead">Ein kurzes, ehrliches Bedrohungsmodell: was AirWeb tut,
was nicht, und wie du es sicher nutzt.</p>

<h2>Authentifizierung</h2>
<p>Nur SSH-Schlüsselpaar-Auth — Passwörter sind serverseitig deaktiviert.
Der Schlüssel wird bei der Registrierung serverseitig erzeugt und ist nur
einmal herunterladbar. Verlierst du ihn, verlierst du den Zugang — wir
können ihn nicht neu ausstellen (wir speichern ihn nie).</p>

<h2>Account-Isolation</h2>
<p>Subdomains und TCP-Ports gehören dem Account, der sie registriert hat.
Andere Clients, die sich an einen geleasten Namen binden wollen, werden
beim <code>tcpip-forward</code>-Handshake abgewiesen.</p>

<h2>Was AirWeb sehen kann</h2>
<ul>
  <li>Bytes, die durch Tunnel laufen, gehen über unseren öffentlichen
      Router. Der Router loggt nie Request-Bodies, nur Zähler.</li>
  <li>Tunnelst du HTTP ohne TLS-Terminierung auf deiner Seite, sieht
      unser Router die Klartext-Requests beim Routing im Speicher.</li>
  <li>Für End-zu-End-TLS terminierst du TLS innerhalb deines Dienstes und
      schickst die bereits verschlüsselten Bytes durch einen TCP-Tunnel.</li>
</ul>

<h2>Best Practices für deine veröffentlichten Dienste</h2>
<ul>
  <li><strong>Geh vom feindseligen Internet aus.</strong> Pack Auth auch
      auf „interne" Prototypen.</li>
  <li>Setze <strong>Rate-Limits</strong> auf Endpoints mit teuren
      Seiteneffekten.</li>
  <li><strong>Rotiere deinen Schlüssel</strong> bei Verdacht auf
      Kompromittierung — alten Account im Dashboard löschen und neuen
      anlegen.</li>
  <li>Nutze <strong>kurzlebige Handles</strong> für Dinge, die an eine
      bestimmte Demo oder einen Vortrag gebunden sind, damit sie von
      allein verfallen.</li>
</ul>

<h2>Schwachstellen melden</h2>
<p>Bug gefunden? Mail an
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>. Wir handhaben Responsible
Disclosure und danken Meldern öffentlich.</p>
`,

  // ---------- faq ----------
  'faq.title': 'Häufige Fragen',
  'faq.description':
    'Kurze Antworten auf die häufigsten Fragen zu AirWeb: Vergleich zu ' +
    'ngrok, Selbst-Hosting, eigene Domains, Free-Tier und mehr.',
  'faq.html': `
<h1>Häufige Fragen</h1>

<h3>Wie verhält sich AirWeb zu ngrok oder Cloudflare Tunnel?</h3>
<p>Unser Transport ist schlicht OpenSSH — kein proprietäres Protokoll,
keine Client-Binary, kein Kernel-Modul. Im Gegenzug bekommst du keine
ngrok-artige Inspektions-UI und kein Cloudflare-Edge-Netzwerk. Wenn dir
„ssh kommt durch jede Firewall" reicht, ist AirWeb die einfachere
Antwort.</p>

<h3>Kann ich meinen eigenen AirWeb-Server betreiben?</h3>
<p>Ja — das Repo ist derselbe Code, der den gehosteten Dienst betreibt.
Klonen, <code>config.default.json</code> nach <code>config.json</code>
kopieren, <code>AIRWEB_PUBLIC_DOMAIN</code> setzen und
<code>npm start</code>. Für DNS brauchst du einen Wildcard-A-Record, der
<code>*.deine-domain</code> auf den Host zeigt.</p>

<h3>Gibt es einen Free-Tier beim gehosteten Dienst?</h3>
<p>Ja — jeder Account startet mit genug Credits, um einen kurzen
Handle einen Monat lang zu leasen und währenddessen beliebig viele
anonyme Tunnel laufen zu lassen.</p>

<h3>Kann ich meine eigene Domain nutzen?</h3>
<p>Beim gehosteten Dienst noch nicht — Handles leben unter der
Haupt-Public-Domain. In einer selbst gehosteten Instanz natürlich:
konfigurier den Wildcard, den du kontrollierst.</p>

<h3>Was passiert mit meinen Tunneln, wenn das Netz wegbricht?</h3>
<p>Mit dem Wrapper macht der SSH-Client automatisches Retry via
<code>ServerAliveInterval</code>. Mit nacktem <code>ssh</code> hänge
<code>-o&nbsp;ServerAliveInterval=30</code> dran oder wickle den Befehl
mit <code>autossh</code> ein.</p>

<h3>Unterstützt AirWeb HTTP/2 oder HTTP/3?</h3>
<p>Das öffentliche Edge spricht HTTP/1.1 und HTTP/2. HTTP/3 (QUIC)
braucht UDP und steht auf der Roadmap. Dein Origin darf sprechen, was er
will — der Proxy normalisiert auf dem Tunnel-Hop auf HTTP/1.1.</p>

<h3>Kann ich AirWeb für Produktions-Traffic nutzen?</h3>
<p>Manche tun es, aber sei dir bewusst, was du kaufst. Eine einzelne
SSH-Session ist ein Single Point of Failure. Für echte Produktion
empfehlen wir Selbst-Hosting mit Multi-Region-Active/Active-Sessions
hinter einem Load Balancer.</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': 'AirWeb — häufige Fehler beheben',
  'troubleshooting.description':
    'Rezepte für die häufigsten Fehler: abgelehntes Forwarding, Port belegt, ' +
    'Schlüssel-Rechte, Firmenproxy und mehr.',
  'troubleshooting.html': `
<h1>Troubleshooting</h1>

<h2 id="forwarding-failed">„Remote forwarding failed"</h2>
<p>Der Server hat den angeforderten Port nicht gebunden. Häufige Gründe:</p>
<ul>
  <li>Jemand anders (oder deine vorherige SSH-Session) hält diese
      Subdomain bzw. den TCP-Port noch. Kurz warten und neu versuchen.</li>
  <li>Du hast einen privilegierten Port (&lt; 1024) angefordert, ohne
      Besitzer des Handles zu sein. Nimm 80 (Sonderfall) oder einen Port
      ≥ 1024.</li>
  <li>Das Handle ist von einem anderen Account geleast. Wähle einen
      anderen Namen oder lease ihn im
      <a href="{{APEX}}/marketplace">Marketplace</a>.</li>
</ul>

<h2 id="permission-denied">„Permission denied (publickey)"</h2>
<ul>
  <li>Check, dass der <code>-i</code>-Pfad auf die heruntergeladene Datei
      zeigt.</li>
  <li>Unter macOS/Linux <code>chmod 600</code> auf die Schlüsseldatei —
      SSH lehnt für alle lesbare private Schlüssel ab.</li>
  <li>Hat dein <code>ssh-agent</code> viel zu tun und bietet zuerst den
      falschen Schlüssel, hänge
      <code>-o&nbsp;IdentitiesOnly=yes</code> dran.</li>
</ul>

<h2 id="corporate-proxy">Hinter einem Firmen-Proxy</h2>
<p>Wenn der ausgehende Port {{SSH_PORT}} blockiert ist, kannst du SSH mit
<code>corkscrew</code> oder <code>ProxyCommand</code> über einen Proxy
tunneln:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">Mein Webhook-Receiver antwortet doppelt</h2>
<p>Wahrscheinlich beanspruchen zwei SSH-Sessions dieselbe Subdomain.
Schau in die <a href="{{APEX}}/connections">Connections-Seite</a> — sind
dort zwei Zeilen mit gleichem Namen, kille eine.</p>

<h2 id="https-redirect">„Die Seite hat kein HTTPS"</h2>
<p>Beim gehosteten Dienst wird jede Subdomain gleichzeitig über
<code>http</code> und <code>https</code> ausgeliefert. Wenn dein Dienst
selbst auf <code>http://</code> umleitet, setze seine „external URL" auf
<code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>.</p>

<h2>Mehr Debug-Ausgabe</h2>
<p>Hänge <code>-vvv</code> an den <code>ssh</code>-Befehl, und du
bekommst das komplette Handshake-Log. Die meisten „funktioniert
nicht"-Berichte lösen sich auf, wenn man diese Ausgabe teilt.</p>
`,

  // ---------- changelog ----------
  'changelog.title': 'Changelog',
  'changelog.description':
    'Die bemerkenswerten Änderungen zwischen AirWeb-Versionen — Features, ' +
    'Breaking Changes, Security-Fixes.',
  'changelog.html': `
<h1>Changelog</h1>
<p class="lead">Inkompatible Änderungen sind als <strong>BREAKING</strong>
markiert. Daten sind der Rollout im gehosteten Dienst.</p>

<h3>2026-05 — Einheitlicher Header und geteilte Einstellungen</h3>
<ul>
  <li>Gleiches Header-Design über Landing, Dashboard, Marketplace,
      Connections und Doku.</li>
  <li>Theme, Sprache und Währung werden jetzt in einem Cookie mit Scope
      <code>.{{PUBLIC_DOMAIN_BASE}}</code> gespeichert und folgen dir
      über jede Subdomain.</li>
</ul>

<h3>2026-03 — Realistische Belohnungs-Ökonomie</h3>
<ul>
  <li>Start-Inventar so ausbalanciert, dass tatsächlich nützliche
      Gegenstände statt Zufallskram ausgegeben werden.</li>
  <li>Level-Zertifikat-Bug behoben: werden jetzt bei jedem Levelaufstieg
      vergeben, nicht nur wenn der Titel wechselt.</li>
</ul>

<h3>2025-12 — CORS für interne Server</h3>
<ul>
  <li>Interne Services wie diese Doku-Seite können jetzt die Apex-API von
      einer anderen Subdomain aus aufrufen.
      <strong>BREAKING</strong>: Skripte, die same-origin annahmen, um
      <code>/api/me</code> zu treffen, müssen jetzt
      <code>credentials:&nbsp;'include'</code> mitschicken.</li>
</ul>

<h3>2025-09 — Handle-Marketplace</h3>
<ul>
  <li>Marketplace startet. Handles leasen, listen und übertragen.</li>
</ul>
`,
};
