// Spanish (es) translations for AirWeb docs.
module.exports = {
  'getting-started.label': 'Primeros pasos',
  'tunneling.label':       'Túneles',
  'platform.label':        'Plataforma',
  'reference.label':       'Referencia',

  // ---------- introduction ----------
  'introduction.title': 'Introducción a AirWeb',
  'introduction.description':
    'AirWeb convierte un único comando SSH en una URL HTTPS pública. ' +
    'Aprende qué es AirWeb, cómo funcionan los túneles SSH inversos y ' +
    'por qué es la forma más rápida de compartir un servicio de localhost con el mundo.',
  'introduction.html': `
<h1>¿Qué es AirWeb?</h1>
<p class="lead">AirWeb es un servicio de túnel inverso que te permite exponer
cualquier servicio que se ejecute en tu portátil o en una red privada a la
internet pública usando únicamente el comando <code>ssh</code>. No hay agente
que instalar — si tienes OpenSSH (las versiones modernas de macOS, Linux y
Windows lo incluyen), ya tienes todo lo que necesitas.</p>

<h2>Cómo funciona</h2>
<p>Cuando ejecutas <code>ssh&nbsp;-R</code> contra AirWeb, nuestro servidor
SSH acepta la solicitud de <em>reenvío de puerto inverso</em> del cliente y
abre un listener público para ti. El tráfico que llega a ese listener se
envía de vuelta por la conexión SSH existente hasta un puerto de tu máquina.</p>
<ul>
  <li>Para HTTP, el listener público es nuestro proxy inverso compartido en
      80/443 sobre <code>{{PUBLIC_DOMAIN}}</code>, enrutando por subdominio.</li>
  <li>Para TCP en crudo, el servidor (o tú) elige un puerto dedicado y se
      reenvían los bytes tal cual.</li>
</ul>

<h2>Por qué la gente usa AirWeb</h2>
<ul>
  <li><strong>Instalación cero.</strong> Sin binarios cliente, ni módulos
      de kernel, ni extensiones de navegador. Solo OpenSSH y un archivo de
      clave.</li>
  <li><strong>URLs públicas reales.</strong> Obtienes
      <code>https://&lt;nombre&gt;.{{PUBLIC_DOMAIN}}</code> — útil para
      webhooks, pruebas móviles, callbacks de OAuth, demos e IoT.</li>
  <li><strong>Identificadores permanentes.</strong> Alquila un nombre en el
      <a href="{{APEX}}/marketplace">mercado</a> y nadie podrá quitártelo.</li>
  <li><strong>Autoalojable.</strong> Todo el código que ejecuta este servicio
      está en el mismo repositorio que puedes desplegar tú mismo.</li>
</ul>

<h2>Siguientes pasos</h2>
<p>La forma más rápida de entender cómo funciona AirWeb es publicar una
aplicación web local <em>ahora mismo</em>. Pasa a la
<a href="/quick-start">guía de inicio rápido</a> — tendrás una URL en vivo
en menos de dos minutos.</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': 'Inicio rápido — tu primer túnel en 60 segundos',
  'quick-start.description':
    'Publica un servicio HTTP local en la internet pública con un único ' +
    'comando ssh. Esta guía paso a paso te da una URL https funcional en aproximadamente un minuto.',
  'quick-start.html': `
<h1>Inicio rápido</h1>
<p class="lead">Tres pasos. Una terminal. Una URL pública.</p>

<h2>1. Crea una cuenta y obtén una clave</h2>
<p>Ve a <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> y haz clic en
<em>Create account</em>. El sitio te dará un archivo llamado
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code>. Esa es tu clave privada SSH —
guárdala en un lugar seguro.</p>
<pre><code># Solo macOS / Linux — omite esto en Windows
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. Inicia algo en localhost</h2>
<p>Cualquier cosa que hable HTTP sirve. Si no tienes una app a mano:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. Abre el túnel</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>Ahora visita <code>http://myapp.{{PUBLIC_DOMAIN}}</code> en tu navegador.
Verás las peticiones aparecer en la terminal de tu servidor local. Pulsa
<kbd>Ctrl</kbd>+<kbd>C</kbd> para tirar la URL.</p>

<h2>Qué hace cada bandera</h2>
<dl>
  <dt><code>-i &lt;archivo&gt;</code></dt>
  <dd>La clave privada que descargaste.</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Nuestro servidor SSH escucha en el puerto {{SSH_PORT}}, no en el 22.</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>Reenvía inversamente el puerto HTTP público al 3000 local.</dd>
  <dt><code>myapp@…</code></dt>
  <dd>El nombre de usuario SSH se convierte en el subdominio público.</dd>
</dl>

<h2>Qué viene después</h2>
<ul>
  <li><a href="/http-tunnels">Publicar varias apps a la vez</a></li>
  <li><a href="/tcp-tunnels">Exponer una base de datos o servidor de juegos (TCP en crudo)</a></li>
  <li><a href="/handles">Reservar un nombre permanente con un identificador</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': 'Instalar el cliente de AirWeb',
  'installation.description':
    'AirWeb funciona con el OpenSSH del sistema en macOS, Linux y Windows. ' +
    'También puedes usar el wrapper Node.js opcional `airweb` si prefieres ' +
    'comandos más amigables. Aquí van las instrucciones para ambos.',
  'installation.html': `
<h1>Instalación</h1>
<p class="lead">El "cliente" de AirWeb es el binario <code>ssh</code> que ya
tienes en tu ordenador. Si quieres una línea de comandos un poco más amigable,
publicamos un wrapper Node.js opcional.</p>

<h2>Paso 1 — Comprueba que tienes OpenSSH</h2>
<ul>
  <li><strong>macOS</strong>: instalado desde tiempos inmemoriales.
      Verifícalo con <code>ssh -V</code>.</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) o el equivalente de tu distro.</li>
  <li><strong>Windows 10/11</strong>: OpenSSH se entrega como funcionalidad
      opcional. Desde PowerShell:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>Paso 2 — Descarga tu clave</h2>
<p>Inicia sesión en <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>. La
clave privada se ofrece como descarga única. Trátala como una contraseña —
cualquiera con ese archivo puede publicar bajo tu cuenta.</p>

<h2>Paso 3 — (Opcional) Instala el wrapper airweb</h2>
<p>El wrapper <code>airweb</code> construye el comando <code>ssh</code>
correcto y muestra primero la URL pública. Instálalo globalmente con npm:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>Después úsalo así:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>Solución de problemas de instalación</h2>
<ul>
  <li><strong>"<code>ssh</code> not found"</strong> — comprueba que OpenSSH
      está en el <code>PATH</code>. En Windows, reabre la terminal tras
      instalar la funcionalidad opcional.</li>
  <li><strong>"Permissions are too open"</strong> en macOS/Linux —
      <code>chmod 600</code> al archivo de clave.</li>
  <li><strong>¿Proxy corporativo?</strong> SSH puede tunelar por encima de
      HTTPS con <code>-o&nbsp;ProxyCommand</code>; consulta
      <a href="/troubleshooting#corporate-proxy">resolución de problemas</a>.</li>
</ul>
`,

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'Túneles HTTP — comparte una app web',
  'http-tunnels.description':
    'Referencia detallada sobre los túneles HTTP de AirWeb: elección de ' +
    'subdominio, flujo de petición, WebSockets, cabeceras Host, rutas ' +
    'personalizadas y múltiples túneles concurrentes en una sola cuenta.',
  'http-tunnels.html': `
<h1>Túneles HTTP</h1>
<p class="lead">Cuando pides a AirWeb <code>-R 80:localhost:&lt;puerto&gt;</code>,
no estamos vinculando realmente el puerto 80 en el servidor para ti — eso
limitaría a un solo túnel por máquina. En su lugar, el router HTTP de AirWeb
trata tu <em>nombre de usuario SSH</em> como un subdominio y enruta por la
cabecera Host.</p>

<h2>El recorrido de una petición</h2>
<ol>
  <li>Un visitante abre <code>https://myapp.{{PUBLIC_DOMAIN}}</code>.</li>
  <li>El router HTTP público recibe la petición y mira la cabecera
      <code>Host</code>.</li>
  <li>Encuentra el túnel registrado para el subdominio <code>myapp</code> y
      pide a tu conexión SSH que abra un canal nuevo.</li>
  <li>Tu cliente <code>ssh</code> recibe el canal y reenvía los bytes a
      <code>localhost:&lt;puerto&gt;</code>.</li>
  <li>La respuesta vuelve por el mismo camino.</li>
</ol>

<h2>Elegir un subdominio</h2>
<p>El subdominio es simplemente el nombre de usuario SSH:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>Cualquier nombre que no esté actualmente alquilado está disponible.
Si quieres uno que nadie pueda robarte, alquila un
<a href="/handles">identificador</a> en el mercado.</p>

<h2>WebSockets y streaming</h2>
<p>La conexión permanece abierta tras el handshake HTTP/1.1 de
<code>Upgrade</code>, así que los túneles para WebSockets y Server-Sent Events
funcionan sin más. No hay capa de búfer delante de tu servicio — los bytes
se reenvían en cuanto llegan.</p>

<h2>Múltiples túneles a la vez</h2>
<p>Abre tantas sesiones SSH como quieras, cada una con su propio subdominio.
Patrón habitual de dos terminales en frontend:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>Los callbacks de OAuth en ambos lados seguirán funcionando tras reinicios,
mientras los subdominios no cambien.</p>

<h2>Cabecera Host y ruta base</h2>
<p>Las peticiones se reenvían reescribiendo el <code>Host</code> original
para usar el nombre público. La mayoría de frameworks lo aceptan; si tu
framework genera URLs absolutas a partir de un host fijo, configura el
"trusted host" o "external URL" del framework a
<code>myapp.{{PUBLIC_DOMAIN}}</code>.</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'Túneles TCP — BD, servidores de juego y más',
  'tcp-tunnels.description':
    'Reenvía tráfico TCP arbitrario — Postgres, Redis, Minecraft, SSH ' +
    'bastión — por un túnel inverso de AirWeb.',
  'tcp-tunnels.html': `
<h1>Túneles TCP</h1>
<p class="lead">HTTP es el caso común, pero AirWeb puede transportar
cualquier protocolo TCP. Pide en el <code>-R</code> un puerto distinto al 80
y el servidor vinculará un listener TCP dedicado para ti.</p>

<h2>Elige un puerto o deja que el servidor lo haga</h2>
<pre><code># Pide un puerto específico
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# Deja que el servidor elija uno libre (puerto 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p>Si pasas <code>0</code>, mira el banner SSH — el puerto asignado se
imprimirá ahí y también aparecerá en tu panel de
<a href="{{APEX}}/connections">conexiones</a>.</p>

<h2>Conectar desde un cliente</h2>
<p>La dirección pública es <code>{{PUBLIC_DOMAIN_BASE}}:&lt;puerto&gt;</code>:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>¿Y UDP?</h2>
<p>SSH solo habla TCP. Para servicios UDP (DNS, QUIC, la mayoría de juegos
en tiempo real), puedes envolverlos en un túnel TCP a la moda
<em>udp-over-tcp</em> en ambos extremos, o correr un pequeño relé
WireGuard sobre un túnel HTTP.</p>

<h2>Aviso de seguridad</h2>
<p>Los túneles TCP en crudo heredan la autenticación que ofrezca el servicio
de abajo. <strong>Nunca expongas una base de datos sin autenticación a la
internet pública</strong>, ni "por un minuto". Ponle contraseña y suma un
firewall por delante.</p>
`,

  // ---------- handles ----------
  'handles.title': 'Identificadores — alquila subdominios permanentes',
  'handles.description':
    'Los identificadores son subdominios reservados a los que solo tu ' +
    'cuenta puede publicar. Aprende a pujar, alquilar y renovarlos en el ' +
    'mercado de AirWeb.',
  'handles.html': `
<h1>Identificadores</h1>
<p class="lead">Por defecto los subdominios son por orden de llegada. En el
momento en que te desconectas, el nombre vuelve a quedar libre.
Un <strong>identificador</strong> es un alquiler — pagas unos pocos créditos
para reservar un nombre y solo tu cuenta puede publicar bajo él.</p>

<h2>Cómo funciona el alquiler</h2>
<ol>
  <li>Busca un nombre en el <a href="{{APEX}}/marketplace">mercado</a>.</li>
  <li>Si no está alquilado, puedes reclamarlo al precio mensual indicado.
      Los nombres populares cuestan más.</li>
  <li>Mientras dure el alquiler, toda sesión SSH desde cualquier otra cuenta
      que intente usar ese nombre de usuario será rechazada.</li>
  <li>Renuévalo con un clic antes de que caduque. Si dejas que expire,
      vuelve al pool tras un breve periodo de gracia.</li>
</ol>

<h2>¿Por qué alquilar?</h2>
<ul>
  <li><strong>Webhooks estables.</strong> Configura GitHub, Stripe, Slack
      etc. una sola vez.</li>
  <li><strong>Marca.</strong> <code>https://tunombre.{{PUBLIC_DOMAIN}}</code>
      se comparte mejor que una cadena aleatoria.</li>
  <li><strong>Seguridad.</strong> Nadie puede llevarse tu nombre mientras
      duermes.</li>
</ul>

<h2>Recargar créditos</h2>
<p>Los alquileres se cobran en créditos (AWC). Compra más desde el
<a href="{{APEX}}/dashboard">panel</a>. Mira la
<a href="/credits">guía de créditos</a> para precios al día.</p>
`,

  // ---------- credits ----------
  'credits.title': 'Créditos, facturación y la economía AWC',
  'credits.description':
    'Los créditos (AWC) son la unidad de valor dentro de AirWeb — pagan ' +
    'alquileres de identificadores, subdominios premium y propinas a ' +
    'creadores. Aprende cómo funciona la economía y cómo recargar.',
  'credits.html': `
<h1>Créditos y facturación</h1>
<p class="lead">Cualquier cosa con precio dentro de AirWeb se cotiza en
<strong>créditos AirWeb (AWC)</strong>. Es una simple unidad contable
interna — nada de blockchain.</p>

<h2>Cómo se obtienen créditos</h2>
<ul>
  <li><strong>Saldo inicial gratis.</strong> Cada cuenta nueva arranca con
      lo suficiente para alquilar su primer identificador sin coste.</li>
  <li><strong>Recargar.</strong> Compra más desde el panel.</li>
  <li><strong>Gana hospedando.</strong> Mientras mantengas túneles vivos,
      el contador de uptime gotea un pequeño estipendio cada minuto a tu
      saldo.</li>
  <li><strong>Mercado.</strong> Vende identificadores que ya no quieras.</li>
</ul>

<h2>Cómo se gastan</h2>
<ul>
  <li>Alquileres de identificadores (recurrentes).</li>
  <li>Opciones premium como rangos de puerto TCP reservados.</li>
  <li>Propinas directas a otras cuentas.</li>
</ul>

<h2>Estimación en USD</h2>
<p>Todo el sitio muestra una estimación en USD junto a tu saldo. La tasa se
configura por despliegue y se expone vía
<code>GET&nbsp;{{APEX}}/api/config</code>. Es una <em>estimación</em>, no un
tipo de cambio — no hay forma de convertir créditos de vuelta a dinero.</p>

<h2>El libro mayor</h2>
<p>Cada movimiento de créditos se registra en un libro de solo añadidura
que puedes inspeccionar:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>El panel renderiza los mismos datos con etiquetas más amigables.</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': 'El panel — tu base en AirWeb',
  'dashboard.description':
    'Gestiona túneles, identificadores, créditos y ajustes de cuenta ' +
    'dentro del panel de AirWeb. Un recorrido por cada sección con los atajos.',
  'dashboard.html': `
<h1>El panel</h1>
<p class="lead">Inicia sesión en <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>
y caerás en una página única que resume todo lo que ocurre en tu cuenta.</p>

<h2>Túneles en vivo</h2>
<p>El panel superior lista cada túnel actualmente vinculado a tu cuenta —
subdominio o puerto TCP, tiempo de conexión, bytes transferidos. Pincha una
fila para copiar la URL pública.</p>

<h2>Identificadores</h2>
<p>Los alquileres que posees aparecen con su fecha de caducidad. Renovación
en un clic.</p>

<h2>Créditos</h2>
<p>Saldo, tasa de ganancia de hoy y un mini-gráfico de actividad reciente.
<a href="/credits">Más sobre créditos aquí.</a></p>

<h2>Cabecera común</h2>
<p>La cabecera superior es la misma en todas las páginas de AirWeb (panel,
mercado, conexiones, documentación y cualquier servicio interno). El icono
del engranaje abre los ajustes de tema, idioma y moneda — tus preferencias
se guardan en cookies con scope <code>.{{PUBLIC_DOMAIN_BASE}}</code>, así
que te siguen entre todos los subdominios.</p>
`,

  // ---------- connections ----------
  'connections.title': 'Página de conexiones — telemetría de túneles en vivo',
  'connections.description':
    'Mira todos los túneles SSH activos hacia el clúster de AirWeb — los ' +
    'tuyos y los públicos — con bytes de entrada/salida en tiempo real e ' +
    'información de origen.',
  'connections.html': `
<h1>Conexiones</h1>
<p class="lead">La página <a href="{{APEX}}/connections">/connections</a>
emite en streaming, en tiempo real, todos los túneles activos.</p>

<h2>Columnas</h2>
<dl>
  <dt>Subdominio / Puerto</dt><dd>Lo que ve el mundo exterior.</dd>
  <dt>Origen</dt><dd>Dirección IP desde la que se estableció la sesión SSH
      (enmascarada para visitantes no admin).</dd>
  <dt>Uptime</dt><dd>Tiempo que lleva activa la sesión.</dd>
  <dt>Bytes In / Out</dt><dd>Tráfico acumulado durante la vida del túnel.</dd>
</dl>

<h2>Filas públicas vs. privadas</h2>
<p>Cualquiera puede ver que existe un túnel en
<code>foo.{{PUBLIC_DOMAIN}}</code> — esa es la idea de un dominio
compartido — pero metadatos como IP de origen y nombre de usuario solo se
muestran al dueño y a los administradores.</p>

<h2>Server-Sent Events</h2>
<p>La página se alimenta del stream SSE en
<code>{{APEX}}/api/connections/events</code>. Suscríbete tú mismo si quieres
construir paneles o reglas de alerta personalizadas.</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': 'Mercado — compra y vende identificadores',
  'marketplace.description':
    'Explora y puja por identificadores de AirWeb. Los vendedores publican ' +
    'los que ya no necesitan; los compradores se llevan el subdominio perfecto.',
  'marketplace.html': `
<h1>El mercado</h1>
<p class="lead">El <a href="{{APEX}}/marketplace">mercado</a> es donde los
identificadores cambian de dueño. A propósito lo hicimos pequeño — busca,
haz clic en comprar, y es tuyo.</p>

<h2>Poner un identificador a la venta</h2>
<ol>
  <li>Abre uno de tus identificadores alquilados en el panel.</li>
  <li>Pincha <em>List for sale</em> y fija un precio en AWC.</li>
  <li>El anuncio aparece de inmediato en el mercado.</li>
  <li>Cuando alguien compra, los créditos se acreditan a tu cuenta y el
      alquiler restante se transfiere al comprador.</li>
</ol>

<h2>Reglas del marketplace</h2>
<ul>
  <li>Solo puedes vender identificadores que poseas actualmente.</li>
  <li>Los anuncios expiran cuando expira el alquiler subyacente.</li>
  <li>El mercado no cobra comisión — el precio publicado es lo que recibes.</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (autenticación obligatoria)</code></pre>
<p>Mira la <a href="/api">referencia de API</a> para el esquema completo.</p>
`,

  // ---------- cli ----------
  'cli.title': 'Referencia del CLI airweb',
  'cli.description':
    'Todas las banderas que acepta el wrapper de línea de comandos airweb, ' +
    'con ejemplos para túneles HTTP y TCP.',
  'cli.html': `
<h1>Referencia del CLI</h1>
<p class="lead">El wrapper opcional <code>airweb</code> evita que tengas que
recordar las banderas de SSH. Instálalo con
<code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code>.</p>

<h2>Uso</h2>
<pre><code>airweb http &lt;puertoLocal&gt; [--sub &lt;nombre&gt;] \\
    --server &lt;host[:puerto]&gt; --key &lt;ruta&gt;

airweb tcp &lt;puertoLocal&gt; [--remote &lt;puerto&gt;] \\
    --server &lt;host[:puerto]&gt; --key &lt;ruta&gt;</code></pre>

<h2>Banderas</h2>
<dl>
  <dt><code>--server &lt;host[:puerto]&gt;</code> <em>(requerido)</em></dt>
  <dd>El endpoint SSH de AirWeb, p. ej.
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>.</dd>

  <dt><code>--key &lt;ruta&gt;</code> <em>(requerido)</em></dt>
  <dd>Ruta al archivo de clave que descargaste.</dd>

  <dt><code>--sub &lt;nombre&gt;</code></dt>
  <dd>Solo modo HTTP. El subdominio al que publicar. Por defecto un nombre
      aleatorio si se omite.</dd>

  <dt><code>--remote &lt;puerto&gt;</code></dt>
  <dd>Solo modo TCP. Solicita al servidor un puerto público concreto. Si se
      omite, el servidor elige uno.</dd>

  <dt><code>--user &lt;nombre&gt;</code></dt>
  <dd>Sobrescribe el nombre de usuario SSH. Útil cuando necesites un usuario
      distinto del subdominio.</dd>

  <dt><code>--help</code></dt>
  <dd>Imprime el uso.</dd>
</dl>

<h2>Ejemplos</h2>
<pre><code># Dev server de React en tu subdominio favorito
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# Postgres en un puerto público elegido
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'Referencia de la API HTTP',
  'api.description':
    'Todos los endpoints JSON que AirWeb expone — incluyendo auth, saldo ' +
    'y libro mayor, mercado de identificadores y telemetría de administradores.',
  'api.html': `
<h1>API HTTP</h1>
<p class="lead">Todos los endpoints son <code>application/json</code> y
viven bajo <code>{{APEX}}/api</code>. La autenticación está basada en
cookies — inicia sesión con <code>POST&nbsp;/api/login</code> o
<code>POST&nbsp;/api/register</code> y el servidor establecerá una cookie
de sesión con scope <code>.{{PUBLIC_DOMAIN_BASE}}</code>.</p>

<h2>Auth</h2>
<table class="api">
  <thead><tr><th>Método</th><th>Ruta</th><th>Notas</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>Crea una cuenta, establece la cookie y devuelve la URL de descarga de la clave.</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>Inicia sesión con usuario + firma de la clave.</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>Limpia la cookie de sesión.</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>Perfil, saldo y resumen de alquileres del usuario actual.</td></tr>
  </tbody>
</table>

<h2>Configuración pública</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>Créditos</h2>
<pre><code>GET /api/ledger        # autenticación requerida
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>Mercado</h2>
<table class="api">
  <thead><tr><th>Método</th><th>Ruta</th><th>Notas</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>Explora todos los anuncios abiertos.</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>Filtra por vendedor.</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>Pon a la venta un identificador que poseas.</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>Alquila un nombre libre o renueva uno que tengas.</td></tr>
  </tbody>
</table>

<h2>Errores</h2>
<p>Todos los endpoints devuelven JSON con un campo <code>error</code> y un
código HTTP adecuado al fallar. Errores de validación dan 400, autenticación
requerida 401, pago requerido 402, recurso ausente 404 y limitación 429.</p>
`,

  // ---------- security ----------
  'security.title': 'Modelo de seguridad y buenas prácticas',
  'security.description':
    'Cómo autentica AirWeb a sus clientes, cómo aísla los túneles y cómo ' +
    'protege los datos de los usuarios — además de buenas prácticas para ' +
    'reforzar los servicios que expongas.',
  'security.html': `
<h1>Modelo de seguridad</h1>
<p class="lead">Un modelo de amenazas breve y honesto: qué hace AirWeb,
qué no hace y cómo usarlo de forma segura.</p>

<h2>Autenticación</h2>
<p>Solo autenticación por pares de claves SSH — las contraseñas están
deshabilitadas en el servidor. La clave se genera en el servidor en el
registro y se descarga una sola vez. Si la pierdes, pierdes el acceso —
no podemos reemitirla (nunca la guardamos).</p>

<h2>Aislamiento por cuenta</h2>
<p>Los subdominios y puertos TCP pertenecen a la cuenta que los registró.
Otros clientes que intenten vincularse a un nombre alquilado son rechazados
durante el handshake <code>tcpip-forward</code>.</p>

<h2>Qué puede ver AirWeb</h2>
<ul>
  <li>Los bytes que pasan por los túneles atraviesan nuestro router público.
      El router nunca registra cuerpos de petición, solo contadores.</li>
  <li>Si tuneleas HTTP sin terminar TLS por tu parte, nuestro router ve las
      peticiones en claro en memoria mientras las enruta.</li>
  <li>Para TLS de punto a punto, termina TLS dentro de tu servicio y envía
      los bytes ya cifrados por un túnel TCP.</li>
</ul>

<h2>Buenas prácticas para los servicios que expongas</h2>
<ul>
  <li><strong>Asume internet hostil.</strong> Pon autenticación incluso en
      prototipos "internos".</li>
  <li>Aplica <strong>rate limiting</strong> a endpoints con efectos
      secundarios costosos.</li>
  <li><strong>Rota tu clave</strong> si sospechas un compromiso — borra la
      cuenta antigua desde el panel y crea una nueva.</li>
  <li>Usa <strong>identificadores efímeros</strong> para cosas atadas a una
      demo concreta o a una charla, para que expiren solos.</li>
</ul>

<h2>Reportar vulnerabilidades</h2>
<p>¿Encontraste un fallo? Escríbenos a
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>. Practicamos divulgación
responsable y reconocemos públicamente a quien lo reporta.</p>
`,

  // ---------- faq ----------
  'faq.title': 'Preguntas frecuentes',
  'faq.description':
    'Respuestas rápidas a las preguntas más comunes sobre AirWeb: comparación ' +
    'con ngrok, autoalojamiento, dominios personalizados, plan gratuito y más.',
  'faq.html': `
<h1>Preguntas frecuentes</h1>

<h3>¿Cómo se compara AirWeb con ngrok o Cloudflare Tunnel?</h3>
<p>Nuestro transporte es OpenSSH puro y duro — no hay protocolo propietario,
ni binario cliente, ni módulo de kernel. A cambio, no tienes la UI de
inspección estilo ngrok ni la red de borde de Cloudflare. Si "ssh me pasa
por cualquier firewall" te basta, AirWeb es la respuesta más simple.</p>

<h3>¿Puedo correr mi propio servidor AirWeb?</h3>
<p>Sí — el repo es el mismo código que ejecuta el servicio alojado. Clónalo,
copia <code>config.default.json</code> a <code>config.json</code>, configura
<code>AIRWEB_PUBLIC_DOMAIN</code> y <code>npm start</code>. Necesitarás un
registro A wildcard apuntando <code>*.tu-dominio</code> al host.</p>

<h3>¿Hay un plan gratis en el servicio alojado?</h3>
<p>Sí — cada cuenta arranca con créditos suficientes para alquilar un
identificador corto durante un mes y correr todos los túneles anónimos que
quieras mientras tanto.</p>

<h3>¿Puedo usar mi propio dominio?</h3>
<p>Aún no en el servicio alojado — los identificadores viven bajo el
dominio público principal. En una instancia autoalojada, claro: configura
el wildcard que controles.</p>

<h3>¿Qué pasa con mis túneles si se cae la red?</h3>
<p>Si usas el wrapper, el cliente SSH reintenta automáticamente con
<code>ServerAliveInterval</code>. Con <code>ssh</code> a pelo, añade
<code>-o&nbsp;ServerAliveInterval=30</code> o envuelve el comando con
<code>autossh</code> para el mismo comportamiento.</p>

<h3>¿AirWeb soporta HTTP/2 o HTTP/3?</h3>
<p>El borde público habla HTTP/1.1 y HTTP/2. HTTP/3 (QUIC) necesita UDP y
está en la hoja de ruta. Tu origen puede hablar lo que quiera — el proxy
normaliza a HTTP/1.1 para el salto del túnel.</p>

<h3>¿Puedo usar AirWeb para tráfico de producción?</h3>
<p>Hay quien lo hace, pero entiende qué estás comprando. Una sola sesión SSH
es un punto único de fallo. Para producción seria recomendamos autoalojarte
con sesiones active/active multirregión detrás de un balanceador.</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': 'Solución de errores comunes de AirWeb',
  'troubleshooting.description':
    'Recetas para los errores más habituales: forwarding rechazado, puerto ' +
    'en uso, permisos de la clave, proxies corporativos y más.',
  'troubleshooting.html': `
<h1>Solución de problemas</h1>

<h2 id="forwarding-failed">"Remote forwarding failed"</h2>
<p>El servidor se negó a vincular el puerto que pediste. Causas comunes:</p>
<ul>
  <li>Otra persona (o tu sesión SSH anterior) todavía tiene ese subdominio o
      puerto TCP. Espera un momento e inténtalo de nuevo.</li>
  <li>Pediste un puerto privilegiado (&lt; 1024) sin ser el dueño del
      identificador. Usa el 80 (tratado especialmente) o un puerto ≥ 1024.</li>
  <li>El identificador está alquilado por otra cuenta. Elige otro o
      alquílalo tú en el <a href="{{APEX}}/marketplace">mercado</a>.</li>
</ul>

<h2 id="permission-denied">"Permission denied (publickey)"</h2>
<ul>
  <li>Comprueba que la ruta de <code>-i</code> apunta al archivo que
      descargaste.</li>
  <li>En macOS/Linux haz <code>chmod 600</code> al archivo de clave — SSH
      rechaza claves privadas legibles por todo el mundo.</li>
  <li>Si tienes un <code>ssh-agent</code> ocupado que ofrece la clave
      equivocada primero, añade <code>-o&nbsp;IdentitiesOnly=yes</code>.</li>
</ul>

<h2 id="corporate-proxy">Detrás de un proxy corporativo</h2>
<p>Si el puerto saliente {{SSH_PORT}} está bloqueado, puedes tunelar SSH por
un proxy con <code>corkscrew</code> o <code>ProxyCommand</code>:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">Mi receptor de webhook responde dos veces</h2>
<p>Probablemente tengas dos sesiones SSH reclamando el mismo subdominio.
Mira la <a href="{{APEX}}/connections">página de conexiones</a> — si hay
dos filas con el mismo nombre, mata una.</p>

<h2 id="https-redirect">"El sitio no tiene HTTPS"</h2>
<p>Cada subdominio del servicio alojado se sirve por <code>http</code> y
<code>https</code> a la vez. Si tu servicio redirige a sí mismo a
<code>http://</code>, ajusta su "external URL" a
<code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>.</p>

<h2>Obtener más debug</h2>
<p>Añade <code>-vvv</code> al comando <code>ssh</code> y verás los logs
completos del handshake. La mayoría de "no me funciona" se resuelven
compartiendo esa salida.</p>
`,

  // ---------- changelog ----------
  'changelog.title': 'Changelog',
  'changelog.description':
    'Los cambios destacados entre versiones de AirWeb — funcionalidades, ' +
    'cambios incompatibles y correcciones de seguridad.',
  'changelog.html': `
<h1>Changelog</h1>
<p class="lead">Los cambios que rompen compatibilidad se marcan como
<strong>BREAKING</strong>. Las fechas son cuando llegaron al servicio
alojado.</p>

<h3>2026-05 — Cabecera unificada y ajustes compartidos</h3>
<ul>
  <li>Mismo diseño de cabecera en landing, panel, mercado, conexiones y
      documentación.</li>
  <li>Tema, idioma y moneda ahora persisten en una cookie con scope
      <code>.{{PUBLIC_DOMAIN_BASE}}</code> y te siguen por todos los
      subdominios.</li>
</ul>

<h3>2026-03 — Economía de recompensas realistas</h3>
<ul>
  <li>Inventario inicial reequilibrado para entregar cosas realmente útiles
      en lugar de chatarra aleatoria.</li>
  <li>Bug fix de certificados de nivel: ahora se otorgan en cada subida de
      nivel, no solo cuando cambia el título.</li>
</ul>

<h3>2025-12 — CORS para servidores internos</h3>
<ul>
  <li>Servicios internos como este sitio de documentación pueden llamar
      ahora a la API apex desde un subdominio distinto.
      <strong>BREAKING</strong>: los scripts que asumían mismo origen al
      llamar a <code>/api/me</code> ahora deben enviar
      <code>credentials:&nbsp;'include'</code>.</li>
</ul>

<h3>2025-09 — Mercado de identificadores</h3>
<ul>
  <li>Lanzamiento del mercado. Alquila, anuncia y transfiere identificadores.</li>
</ul>
`,
};
