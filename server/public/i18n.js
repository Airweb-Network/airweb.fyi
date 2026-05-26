/* AirWeb i18n
   Runtime DOM-walker translator. Loaded BEFORE the page script so the
   global `i18n.t()` helper is available, and a MutationObserver picks up
   anything added later (dynamic table rows, modal copy, etc.) and replaces
   text nodes and translatable attributes with the active locale's strings.

   Supported locales: en, es, fr, de, zh, ja
*/
(function () {
  const STORAGE_KEY = 'airweb-locale';
  const DEFAULT = 'en';
  const LOCALES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko'];
  const LOCALE_LABELS = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    zh: '中文',
    ja: '日本語',
    ko: '한국어'
  };
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);
  const SKIP_CLASS = /(?:^|\s)(?:mono|key-file-name|keep-en)(?:\s|$)/;

  // ---------------------------------------------------------------
  // Catalog. Keys are the original English source strings exactly as
  // they appear in the markup (after whitespace collapse). Missing
  // entries fall through to English.
  // ---------------------------------------------------------------
  const M = {
    en: {},
    es: {
      // header / user menu
      'AirWeb': 'AirWeb',
      'Dashboard': 'Panel',
      'Marketplace': 'Mercado',
      'My account': 'Mi cuenta',
      'Account': 'Cuenta',
      'Theme': 'Tema',
      'Dark': 'Oscuro',
      'Light': 'Claro',
      'System': 'Sistema',
      'Language': 'Idioma',
      'Sign in': 'Iniciar sesión',
      'Sign out': 'Cerrar sesión',
      'Sign in with key': 'Iniciar sesión con clave',
      'Copy': 'Copiar',
      'Copy account ID': 'Copiar ID de cuenta',
      'Toggle overview': 'Mostrar/ocultar resumen',
      // guest landing
      'Get started in 10 seconds': 'Empieza en 10 segundos',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        'Generaremos una clave SSH Ed25519 en tu navegador, te entregaremos el archivo de clave privada una sola vez y derivaremos tu ID de cuenta corto a partir de ella. Recibirás',
      'credit signup bonus.': 'créditos de bienvenida.',
      'Create account': 'Crear cuenta',
      // tabs
      'Overview': 'Resumen',
      'Transactions': 'Transacciones',
      'Admin': 'Admin',
      // hero metrics
      'Tunnels': 'Túneles',
      'Leases': 'Alquileres',
      'Reward / min': 'Recompensa / min',
      'Charge / min': 'Cobro / min',
      'Earning / min': 'Ganancia / min',
      'est.': 'est.',
      'Number of your SSH tunnels currently online and reachable.':
        'Número de tus túneles SSH actualmente en línea y accesibles.',
      "Active marketplace leases you have purchased on others' tunnels.":
        'Alquileres activos del mercado que has comprado en túneles de otros.',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        'Créditos promedio ganados por minuto por el tiempo en línea durante las últimas 24 horas. Si no hay historial, usa la tarifa configurada × túneles en línea.',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        'Créditos promedio cobrados por minuto por el ancho de banda consumido por tus alquileres activos durante las últimas 24 horas.',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        'Flujo neto de créditos por minuto: Recompensa menos Cobro. Positivo significa que estás ganando, negativo que consumes más de lo que ganas.',
      // sections / actions
      'My Connections': 'Mis conexiones',
      '+ Connection': '+ Conexión',
      'Search connections…': 'Buscar conexiones…',
      'All': 'Todo',
      'Listings': 'Anuncios',
      // marketplace filter
      'Filter nodes': 'Filtrar nodos',
      'Protocol': 'Protocolo',
      'Any': 'Cualquiera',
      'Search title/desc': 'Buscar título/desc',
      'keyword': 'palabra clave',
      'Country': 'País',
      'Min cores': 'Núcleos mín.',
      'Min RAM (GB)': 'RAM mín. (GB)',
      'Max price (cr/min)': 'Precio máx. (ACR/min)',
      'OS contains': 'SO contiene',
      'linux, debian…': 'linux, debian…',
      'Apply': 'Aplicar',
      'Clear': 'Limpiar',
      'Reset': 'Restablecer',
      'Search title or description…': 'Buscar título o descripción…',
      'All listings': 'Todos los anuncios',
      // transactions
      'Recent credit activity': 'Actividad reciente de créditos',
      'Clear filters': 'Limpiar filtros',
      'Reason': 'Motivo',
      'Ref': 'Ref',
      'Delta': 'Variación',
      'When': 'Cuándo',
      'filter…': 'filtrar…',
      'all': 'todos',
      '+ only': '+ solo',
      '− only': '− solo',
      'Load 20 more': 'Cargar 20 más',
      // admin
      'role': 'rol',
      'Refresh': 'Actualizar',
      'All live tunnels': 'Todos los túneles activos',
      'All accounts': 'Todas las cuentas',
      'Resume': 'Reanudar',
      'Pause': 'Pausar',
      'Disconnect': 'Desconectar',
      'Demote': 'Degradar',
      'Promote': 'Promover',
      // disclaimer modal
      '⚠ Read this before you continue': '⚠ Lee esto antes de continuar',
      'You are about to:': 'Estás a punto de:',
      'Generate': 'Generar',
      'a brand-new Ed25519 SSH keypair on the server.': 'un nuevo par de claves SSH Ed25519 en el servidor.',
      'Download': 'Descargar',
      'the private key file (': 'el archivo de clave privada (',
      ') to this device —': ') en este dispositivo —',
      'immediately and automatically': 'de inmediato y automáticamente',
      '.': '.',
      'to the account derived from that key.': 'a la cuenta derivada de esa clave.',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        'La clave privada es la única forma de acceder a tu cuenta. No la almacenamos. Si tu navegador bloquea la descarga o pierdes el archivo, tu cuenta y créditos se pierden para siempre — no hay recuperación.',
      'only': 'única',
      'not': 'no',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        'Asegúrate de que tu navegador puede descargar archivos de este sitio antes de continuar. Los tres pasos ocurren con un solo clic y no se pueden deshacer ni separar.',
      'I understand: if I lose this download, I lose my account.':
        'Entiendo: si pierdo esta descarga, pierdo mi cuenta.',
      'Cancel': 'Cancelar',
      'Generate, download & sign in': 'Generar, descargar e iniciar sesión',
      // key modal
      "✅ You're signed in — your key has been downloaded":
        '✅ Sesión iniciada — tu clave ha sido descargada',
      'Downloads': 'Descargas',
      "Keep it safe — it's the only way back into this account.":
        'Guárdala bien — es la única forma de volver a esta cuenta.',
      'Account ID:': 'ID de cuenta:',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        'Si la descarga no comenzó (bloqueada por el navegador, etc.), usa los botones de abajo ahora mismo:',
      'Re-download key file': 'Volver a descargar el archivo',
      'Linux/macOS:': 'Linux/macOS:',
      'after downloading, run': 'después de descargar, ejecuta',
      'Then connect:': 'Luego conéctate:',
      'Continue to dashboard': 'Continuar al panel',
      // list modal
      'List this tunnel on the marketplace': 'Publicar este túnel en el mercado',
      'Tunnel:': 'Túnel:',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        'El servidor conectará por SSH a este punto final con las credenciales sudo que proporciones. La conexión debe tener éxito antes de publicar el anuncio. Tu contraseña no se almacena.',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        'Los alquileres web son privados: cada inquilino recibe un código único que debe introducirse para acceder al sitio. El código expira automáticamente al final del alquiler.',
      'Title *': 'Título *',
      'Beefy home server': 'Servidor doméstico potente',
      'Price (credits / min) *': 'Precio (créditos / min) *',
      'Lease term (minutes) *': 'Plazo de alquiler (minutos) *',
      'Description': 'Descripción',
      'Optional': 'Opcional',
      'Bandwidth (Mbps)': 'Ancho de banda (Mbps)',
      'optional': 'opcional',
      'Sudo username *': 'Usuario sudo *',
      'Sudo password *': 'Contraseña sudo *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        'CPU, RAM, disco y SO se detectan automáticamente por SSH tras validar tus credenciales — no necesitas introducirlos.',
      'Validate & list': 'Validar y publicar',
      // connect modal
      'Connect a tunnel': 'Conectar un túnel',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        'Elige qué quieres exponer. Ejecuta el comando generado en la máquina origen y mantén abierta la ventana SSH — cerrarla termina el túnel.',
      'Public endpoint': 'Punto final público',
      'Subdomain': 'Subdominio',
      'Local port': 'Puerto local',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        'Los nuevos túneles inician en pausa — haz clic en Reanudar en Mis conexiones para empezar a servir tráfico.',
      'Run this command': 'Ejecuta este comando',
      'Got it': 'Entendido',
      // help-list modal
      'This tunnel is not listable': 'Este túnel no se puede publicar',
      'Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn\'t enough.':
        'Solo los túneles TCP que exponen SSH (puerto 22) pueden publicarse — los compradores necesitan iniciar sesión, así que un reenvío HTTP no es suficiente.',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        'Vuelve a conectar con el comando de abajo. Elige un nombre mysub libre (o usa uno de tus alias):',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        'Cuando conecte, el nuevo túnel aparecerá en Mi actividad con tipo tcp. Haz clic en Reanudar y luego en Publicar para alquiler.',
      // login page
      'Sign in with your AirWeb key': 'Inicia sesión con tu clave AirWeb',
      'Paste your': 'Pega tu archivo',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        '(la clave privada OpenSSH que descargaste al registrarte). Volvemos a derivar tu ID de cuenta en el servidor e iniciamos una sesión — la clave no se almacena.',
      'Private key (OpenSSH format)': 'Clave privada (formato OpenSSH)',
      '…or upload it': '…o súbela',
      'Passphrase (if your key has one)': 'Frase de contraseña (si la clave tiene una)',
      "Don't have a key?": '¿No tienes clave?',
      'Register here': 'Regístrate aquí',
      'Paste or upload your private key.': 'Pega o sube tu clave privada.',
      'Signing in…': 'Iniciando sesión…',
      'Sign in failed:': 'Error de inicio de sesión:',
      'Sign in failed.': 'Error de inicio de sesión.',
      'That doesn\u2019t look like a valid OpenSSH private key.':
        'Eso no parece una clave privada OpenSSH válida.',
      // dynamic statuses & misc
      'online': 'en línea',
      'offline': 'desconectado',
      'paused': 'pausado',
      'no credits': 'sin créditos',
      'lease': 'alquiler',
      'listed': 'publicado',
      'private': 'privado',
      'validated': 'validado',
      'none': 'ninguno',
      'never': 'nunca',
      'expired': 'expirado',
      'open': 'abrir',
      'passcode': 'código',
      'spent': 'gastado',
      'avg': 'prom.',
      'cr/min': 'ACR/min',
      'cr': 'ACR',
      'ACR/min': 'ACR/min',
      'ACR': 'ACR',
      'tunnel offline': 'túnel desconectado',
      'Type': 'Tipo',
      'Item': 'Elemento',
      'Details': 'Detalles',
      'Charged': 'Cobrado',
      'Listed': 'Publicado',
      'Earned': 'Ganado',
      'Rate': 'Tarifa',
      'Actions': 'Acciones',
      'List': 'Publicar',
      'List?': '¿Publicar?',
      'Remove listing': 'Quitar anuncio',
      'Cannot remove while a lease is active': 'No se puede quitar mientras un alquiler está activo',
      'Disconnect this tunnel': 'Desconectar este túnel',
      'Pause public access without disconnecting': 'Pausar acceso público sin desconectar',
      'Resume public access': 'Reanudar acceso público',
      'This tunnel has an active marketplace listing — remove the listing first':
        'Este túnel tiene un anuncio activo — quita el anuncio primero',
      'Lease': 'Alquilar',
      'This connection is offline': 'Esta conexión está desconectada',
      // ---- Landing page ----
      'A people-powered cloud, built from the': 'Una nube impulsada por las personas, construida con los',
      'devices you already own': 'dispositivos que ya tienes',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb convierte laptops sin uso, teléfonos viejos y servidores domésticos inactivos en pequeños endpoints públicos. Muestra una app en segundos, accede a tu computadora desde cualquier lugar o alquila un micro-servidor por minuto, y gana créditos mientras tus dispositivos ayudan a llevar la carga.',
      'get your key →': 'obtén tu clave →',
      'or restore from existing key': 'o restaura desde una clave existente',
      'pay only for traffic': 'paga sólo por el tráfico',
      'no install · just ssh': 'sin instalación · sólo ssh',
      'open source · greener by default': 'código abierto · más ecológico por defecto',
      'What you can do today': 'Lo que puedes hacer hoy',
      'Make spare devices useful': 'Da uso a tus dispositivos',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        'Esa vieja MacBook en un cajón o la Raspberry Pi en tu estante puede servir tráfico real. Enchúfala, ejecuta un',
      'command, and it joins the network as a working node.': 'comando, y se une a la red como un nodo activo.',
      'Demo your app in 30 seconds': 'Demuestra tu app en 30 segundos',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        'Levanta un servidor local, abre un túnel y pega la URL pública en el chat de la reunión. Sin despliegues, sin Dockerfiles, sin CI — sólo el código que ya tienes corriendo en',
      'Reach your home computer anywhere': 'Accede a tu equipo desde cualquier lugar',
      'Claim a permanent': 'Reclama un',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        'permanente para tu equipo de casa. Archivos, paneles, servidores de juegos, SSH al escritorio — todo accesible desde un teléfono al otro lado del mundo.',
      'Lease a micro-server by the minute': 'Alquila un micro-servidor por minuto',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        '¿Necesitas un endpoint público para una prueba de webhook, un taller o un proyecto de fin de semana? Alquila el túnel de otra persona por unos minutos con los créditos que ganaste alojando el tuyo. Sin facturas mensuales.',
      'Quick start': 'Inicio rápido',
      'Grab your key from the': 'Obtén tu clave desde el',
      'and run one command — your local port is public.': 'y ejecuta un solo comando — tu puerto local queda público.',
      'Change': 'Cambia',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': 'al puerto en el que escucha tu aplicación. Para TCP puro (bases de datos, SSH, servidores de juegos), usa',
      'You only need the': 'Sólo necesitas el comando',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        '(integrado en macOS, Linux y Windows moderno). Sin cliente, sin formulario de cuenta.',
      'Get your key': 'Obtén tu clave',
      'Open the': 'Abre el',
      'dashboard': 'panel',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        '— genera una clave SSH Ed25519 en tu navegador, deriva tu id de cuenta corto (',
      '), and downloads the private key file': '), y descarga el archivo de clave privada',
      '. Welcome bonus:': '. Bono de bienvenida:',
      'credits.': 'créditos.',
      'Start something locally': 'Inicia algo localmente',
      'Open a tunnel': 'Abre un túnel',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        'Tu usuario SSH se convierte en tu subdominio público. Reclama un handle permanente en el panel para que nadie más lo tome.',
      'Share the URL': 'Comparte la URL',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        'Envía el enlace a un compañero, un cliente o a tu teléfono. El túnel sigue activo mientras la sesión SSH esté abierta — y ganas créditos todo el tiempo.',
      'Raw TCP works too': 'TCP puro también funciona',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        'Bases de datos, SSH, servidores de juegos, MQTT — cualquier cosa que no sea HTTP. El servidor asigna un puerto público y lo imprime.',
      'Pay only for the traffic you use': 'Paga sólo por el tráfico que usas',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        'Sin suscripciones. Sin precipicios de "plan gratuito". Abrir un túnel es gratis — sólo se te cobra en créditos por los bytes que realmente pasan, y los créditos se reembolsan al desconectar lo no usado.',
      'Metered by the byte': 'Medido por byte',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        'Los túneles inactivos no cuestan nada. Una demo rápida con unas pocas cargas cuesta unos pocos créditos. Una carga pesada paga en proporción al ancho de banda consumido.',
      'Earn while you host': 'Gana mientras alojas',
      'Every minute your own device serves traffic, you earn': 'Cada minuto que tu dispositivo sirve tráfico, ganas',
      'in uptime rewards, plus': 'en recompensas de uptime, más',
      'when someone leases your tunnel from the marketplace.': 'cuando alguien alquila tu túnel desde el mercado.',
      'Earn, learn, and build with the community': 'Gana, aprende y construye con la comunidad',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb se construye sobre un ciclo simple: enchufa un dispositivo libre, comparte su uptime, gana créditos y gástalos en lo que necesitas. En el camino aprendes redes reales, SSH y sistemas distribuidos — junto a otras personas que hacen lo mismo.',
      'Open marketplace': 'Mercado abierto',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        'Publica el túnel de tu dispositivo libre, fija un precio por minuto y mira llegar los alquileres. Explora lo que otros ofrecen y alquila la región o el hardware adecuados.',
      'Learn by hosting': 'Aprende alojando',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        'SSH inverso real, TCP real, medición real. El repositorio es código abierto — léelo, bifurca, y usa AirWeb para enseñarte la infraestructura que la escuela rara vez cubre.',
      'The long view: a micro-server socio-economy': 'La visión a largo plazo: una socio-economía de micro-servidores',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        'El mundo está lleno de hardware perfectamente bueno sin usar — mil millones de teléfonos, cien millones de laptops, racks de servidores "obsoletos". Tienen CPU, memoria y ancho de banda que hoy se desperdician. AirWeb es el primer paso para que todo eso se vuelva útil, propiedad de quienes ya lo pagaron, intercambiado de forma transparente y entre pares.',
      'Open-source cloud provider': 'Proveedor cloud de código abierto',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        'Las capacidades de los hyperscalers no tienen que vivir detrás de tres logos y un formulario de tarjeta de crédito. Nuestro objetivo es una nube abierta y federada donde el "centro de datos" es una coalición de hogares, oficinas y espacios comunitarios.',
      'A micro-server economy': 'Una economía de micro-servidores',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        'Los créditos ganados aportando capacidad compran capacidad de otros. Con el tiempo, ese ciclo se convierte en una economía real — donde pequeños operadores, estudiantes y aficionados son participantes de primera clase, no sólo clientes.',
      'Greener by default': 'Más ecológico por defecto',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        'El servidor más sostenible es el que ya existe. Al dar una segunda vida a dispositivos que de otro modo estarían inactivos — o peor, en un vertedero — AirWeb reduce la necesidad de desplegar nuevas flotas de hardware always-on sólo para servir unas pocas peticiones por minuto. Menos flota, menos carbono incorporado, menos basura electrónica, menos consumo de la red.',
      'Reuses hardware you already own instead of provisioning new servers.':
        'Reutiliza el hardware que ya tienes en lugar de aprovisionar servidores nuevos.',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        'Los túneles inactivos no consumen prácticamente nada — sólo ocupan un socket SSH.',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        'Sin granjas always-on: la capacidad aparece cuando los dispositivos se enchufan y desaparece cuando no.',
      'FAQ': 'Preguntas frecuentes',
      'What kind of "spare device" actually works?': '¿Qué tipo de "dispositivo libre" funciona?',
      'Anything that can run an': 'Cualquier cosa que pueda ejecutar un cliente',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        'y estar en línea: una laptop vieja, un escritorio que apenas usas, una Raspberry Pi, un NAS, un mini-PC, incluso algunos routers. Si puede mantener una sesión SSH abierta, puede ser un nodo AirWeb.',
      'Do I need to install anything?': '¿Necesito instalar algo?',
      'No. Any standard': 'No. Cualquier',
      'client works once you\'ve downloaded': 'estándar funciona una vez que descargas',
      '. There is an optional Node CLI (': '. Existe un CLI opcional de Node (',
      ') that wraps': ') que envuelve',
      'with friendlier flags if you want one.': 'con banderas más amigables si quieres uno.',
      'How exactly am I charged?': '¿Cómo me cobran exactamente?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        'Se mide por los bytes de tráfico público que realmente pasan por tus túneles alquilados. Los endpoints inactivos no cuestan nada. El panel muestra ganancias y cargos en vivo en créditos y un valor estimado en USD.',
      'How do I sign in from another device?': '¿Cómo inicio sesión desde otro dispositivo?',
      'Open': 'Abre',
      'and paste your private key. We never store private keys server-side — your':
        'y pega tu clave privada. Nunca almacenamos claves privadas en el servidor — tu',
      'account id is derived deterministically from the public key.':
        'id de cuenta se deriva de forma determinista desde la clave pública.',
      'Is the traffic encrypted?': '¿Está cifrado el tráfico?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        'El tramo entre tu dispositivo y AirWeb está cifrado por SSH. El tramo público usa lo que hable la puerta de entrada (HTTP en el puerto, HTTPS detrás de un proxy TLS). Para TLS extremo a extremo, termina dentro de tu app local y usa un túnel TCP puro.',
      'Can I pick my own subdomain?': '¿Puedo elegir mi propio subdominio?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        'Sí — el usuario SSH con el que te conectas se convierte en tu subdominio (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        '). Gasta créditos en el panel para reclamar un handle permanente que nadie más pueda tomar.',
      'How do I stop a tunnel?': '¿Cómo detengo un túnel?',
      'Press': 'Pulsa',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        'en la sesión SSH o cierra la terminal. El túnel desaparece inmediatamente de la lista activa y dejas de acumular cargos.',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · túnel ssh inverso autoalojado ·',
      'source': 'código'
    },
    fr: {
      'AirWeb': 'AirWeb',
      'Dashboard': 'Tableau de bord',
      'Marketplace': 'Marché',
      'My account': 'Mon compte',
      'Account': 'Compte',
      'Theme': 'Thème',
      'Dark': 'Sombre',
      'Light': 'Clair',
      'System': 'Système',
      'Language': 'Langue',
      'Sign in': 'Se connecter',
      'Sign out': 'Se déconnecter',
      'Sign in with key': 'Se connecter avec une clé',
      'Copy': 'Copier',
      'Copy account ID': 'Copier l\'ID du compte',
      'Toggle overview': 'Afficher/masquer le résumé',
      'Get started in 10 seconds': 'Lancez-vous en 10 secondes',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        'Nous générerons une clé SSH Ed25519 dans votre navigateur, vous remettrons le fichier de clé privée une seule fois et en dériverons votre ID de compte court. Vous recevrez',
      'credit signup bonus.': 'crédits de bienvenue.',
      'Create account': 'Créer un compte',
      'Overview': 'Aperçu',
      'Transactions': 'Transactions',
      'Admin': 'Admin',
      'Tunnels': 'Tunnels',
      'Leases': 'Locations',
      'Reward / min': 'Récompense / min',
      'Charge / min': 'Coût / min',
      'Earning / min': 'Gain / min',
      'est.': 'est.',
      'Number of your SSH tunnels currently online and reachable.':
        'Nombre de vos tunnels SSH actuellement en ligne et accessibles.',
      "Active marketplace leases you have purchased on others' tunnels.":
        'Locations actives du marché que vous avez achetées sur les tunnels d\'autres utilisateurs.',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        'Crédits moyens gagnés par minute grâce à la disponibilité des tunnels au cours des dernières 24 h. À défaut, utilise le taux configuré × tunnels en ligne.',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        'Crédits moyens facturés par minute pour la bande passante consommée par vos locations actives au cours des dernières 24 h.',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        'Flux net de crédits par minute : Récompense moins Coût. Positif = vous gagnez, négatif = vous consommez plus que vous ne gagnez.',
      'My Connections': 'Mes connexions',
      '+ Connection': '+ Connexion',
      'Search connections…': 'Rechercher des connexions…',
      'All': 'Tout',
      'Listings': 'Annonces',
      'Filter nodes': 'Filtrer les nœuds',
      'Protocol': 'Protocole',
      'Any': 'Tous',
      'Search title/desc': 'Rechercher titre/description',
      'keyword': 'mot-clé',
      'Country': 'Pays',
      'Min cores': 'Cœurs min.',
      'Min RAM (GB)': 'RAM min. (Go)',
      'Max price (cr/min)': 'Prix max. (ACR/min)',
      'OS contains': 'OS contient',
      'linux, debian…': 'linux, debian…',
      'Apply': 'Appliquer',
      'Clear': 'Effacer',
      'Reset': 'Réinitialiser',
      'Search title or description…': 'Rechercher titre ou description…',
      'All listings': 'Toutes les annonces',
      'Recent credit activity': 'Activité récente des crédits',
      'Clear filters': 'Effacer les filtres',
      'Reason': 'Raison',
      'Ref': 'Réf',
      'Delta': 'Variation',
      'When': 'Quand',
      'filter…': 'filtrer…',
      'all': 'tous',
      '+ only': '+ seulement',
      '− only': '− seulement',
      'Load 20 more': 'Charger 20 de plus',
      'role': 'rôle',
      'Refresh': 'Actualiser',
      'All live tunnels': 'Tous les tunnels actifs',
      'All accounts': 'Tous les comptes',
      'Resume': 'Reprendre',
      'Pause': 'Pause',
      'Disconnect': 'Déconnecter',
      'Demote': 'Rétrograder',
      'Promote': 'Promouvoir',
      '⚠ Read this before you continue': '⚠ Lisez ceci avant de continuer',
      'You are about to:': 'Vous êtes sur le point de :',
      'Generate': 'Générer',
      'a brand-new Ed25519 SSH keypair on the server.': 'une toute nouvelle paire de clés SSH Ed25519 sur le serveur.',
      'Download': 'Télécharger',
      'the private key file (': 'le fichier de clé privée (',
      ') to this device —': ') sur cet appareil —',
      'immediately and automatically': 'immédiatement et automatiquement',
      'to the account derived from that key.': 'au compte dérivé de cette clé.',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        'La clé privée est le seul moyen d\'accéder à votre compte. Nous ne la stockons pas. Si votre navigateur bloque le téléchargement ou si vous perdez le fichier, votre compte et vos crédits sont perdus à jamais — aucune récupération possible.',
      'only': 'seule',
      'not': 'pas',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        'Assurez-vous que votre navigateur est autorisé à télécharger depuis ce site avant de continuer. Les trois étapes se déroulent en un seul clic et ne peuvent être annulées ni séparées.',
      'I understand: if I lose this download, I lose my account.':
        'Je comprends : si je perds ce téléchargement, je perds mon compte.',
      'Cancel': 'Annuler',
      'Generate, download & sign in': 'Générer, télécharger et se connecter',
      "✅ You're signed in — your key has been downloaded":
        '✅ Vous êtes connecté — votre clé a été téléchargée',
      'Downloads': 'Téléchargements',
      "Keep it safe — it's the only way back into this account.":
        'Gardez-la précieusement — c\'est le seul moyen de retrouver ce compte.',
      'Account ID:': 'ID du compte :',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        'Si le téléchargement n\'a pas démarré (bloqué par le navigateur, etc.), utilisez les boutons ci-dessous maintenant :',
      'Re-download key file': 'Re-télécharger le fichier de clé',
      'Linux/macOS:': 'Linux/macOS :',
      'after downloading, run': 'après le téléchargement, exécutez',
      'Then connect:': 'Puis connectez-vous :',
      'Continue to dashboard': 'Continuer vers le tableau de bord',
      'List this tunnel on the marketplace': 'Publier ce tunnel sur le marché',
      'Tunnel:': 'Tunnel :',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        'Le serveur se connectera en SSH à ce point d\'extrémité avec les identifiants sudo que vous fournissez. La connexion doit réussir avant la publication. Votre mot de passe n\'est pas stocké.',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        'Les locations web sont privées : chaque locataire reçoit un code unique pour accéder au site. Le code expire automatiquement à la fin de la location.',
      'Title *': 'Titre *',
      'Beefy home server': 'Serveur domestique costaud',
      'Price (credits / min) *': 'Prix (crédits / min) *',
      'Lease term (minutes) *': 'Durée de location (minutes) *',
      'Description': 'Description',
      'Optional': 'Optionnel',
      'Bandwidth (Mbps)': 'Bande passante (Mbps)',
      'optional': 'optionnel',
      'Sudo username *': 'Nom d\'utilisateur sudo *',
      'Sudo password *': 'Mot de passe sudo *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        'CPU, RAM, disque et OS sont détectés automatiquement par SSH après validation — pas besoin de les saisir.',
      'Validate & list': 'Valider et publier',
      'Connect a tunnel': 'Connecter un tunnel',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        'Choisissez ce que vous voulez exposer. Exécutez la commande générée sur la machine source et gardez la fenêtre SSH ouverte — la fermer met fin au tunnel.',
      'Public endpoint': 'Point d\'extrémité public',
      'Subdomain': 'Sous-domaine',
      'Local port': 'Port local',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        'Les nouveaux tunnels démarrent en pause — cliquez sur Reprendre dans Mes connexions pour commencer.',
      'Run this command': 'Exécutez cette commande',
      'Got it': 'Compris',
      'This tunnel is not listable': 'Ce tunnel ne peut pas être publié',
      "Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn't enough.":
        'Seuls les tunnels TCP exposant SSH (port 22) peuvent être publiés — les acheteurs doivent se connecter, un transfert HTTP ne suffit pas.',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        'Reconnectez-vous avec la commande ci-dessous. Choisissez un nom mysub libre (ou utilisez un de vos alias) :',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        'Une fois connecté, le nouveau tunnel apparaîtra dans Mon activité avec le type tcp. Cliquez sur Reprendre, puis sur Publier.',
      'Sign in with your AirWeb key': 'Connectez-vous avec votre clé AirWeb',
      'Paste your': 'Collez votre fichier',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        '(la clé privée OpenSSH téléchargée à l\'inscription). Nous redérivons votre ID de compte localement sur le serveur et démarrons une session — la clé n\'est pas stockée.',
      'Private key (OpenSSH format)': 'Clé privée (format OpenSSH)',
      '…or upload it': '…ou téléversez-la',
      'Passphrase (if your key has one)': 'Phrase de passe (si la clé en a une)',
      "Don't have a key?": 'Pas de clé ?',
      'Register here': 'Inscrivez-vous ici',
      'Paste or upload your private key.': 'Collez ou téléversez votre clé privée.',
      'Signing in…': 'Connexion…',
      'Sign in failed:': 'Échec de connexion :',
      'Sign in failed.': 'Échec de connexion.',
      'That doesn\u2019t look like a valid OpenSSH private key.':
        'Cela ne ressemble pas à une clé privée OpenSSH valide.',
      'online': 'en ligne', 'offline': 'hors ligne', 'paused': 'en pause',
      'no credits': 'sans crédits', 'lease': 'location', 'listed': 'publié',
      'private': 'privé', 'validated': 'validé', 'none': 'aucun', 'never': 'jamais',
      'expired': 'expiré', 'open': 'ouvrir', 'passcode': 'code', 'spent': 'dépensé',
      'avg': 'moy.', 'cr/min': 'ACR/min', 'cr': 'ACR', 'ACR/min': 'ACR/min', 'ACR': 'ACR', 'tunnel offline': 'tunnel hors ligne',
      'Type': 'Type', 'Item': 'Élément', 'Details': 'Détails', 'Charged': 'Coût',
      'Listed': 'Publié', 'Earned': 'Gagné', 'Rate': 'Tarif', 'Actions': 'Actions',
      'List': 'Publier', 'List?': 'Publier ?', 'Remove listing': 'Supprimer l\'annonce',
      'Cannot remove while a lease is active': 'Impossible de supprimer pendant qu\'une location est active',
      'Disconnect this tunnel': 'Déconnecter ce tunnel',
      'Pause public access without disconnecting': 'Mettre en pause l\'accès public sans déconnecter',
      'Resume public access': 'Reprendre l\'accès public',
      'This tunnel has an active marketplace listing — remove the listing first':
        'Ce tunnel a une annonce active — supprimez d\'abord l\'annonce',
      'Lease': 'Louer', 'This connection is offline': 'Cette connexion est hors ligne',
      // ---- Landing page ----
      'A people-powered cloud, built from the': 'Un cloud porté par les gens, construit avec les',
      'devices you already own': 'appareils que vous possédez déjà',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb transforme les ordinateurs portables inutilisés, vieux téléphones et serveurs domestiques inactifs en petits points d\'accès publics. Démontrez une app en quelques secondes, accédez à votre ordinateur depuis n\'importe où ou louez un micro-serveur à la minute — et gagnez des crédits pendant que vos appareils contribuent.',
      'get your key →': 'obtenir votre clé →',
      'or restore from existing key': 'ou restaurer depuis une clé existante',
      'pay only for traffic': 'payez uniquement le trafic',
      'no install · just ssh': 'aucune installation · juste ssh',
      'open source · greener by default': 'open source · plus écologique par défaut',
      'What you can do today': 'Ce que vous pouvez faire aujourd\'hui',
      'Make spare devices useful': 'Rendre vos appareils utiles',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        'Ce vieux MacBook au fond d\'un tiroir ou la Raspberry Pi sur votre étagère peut servir du vrai trafic. Branchez-le, lancez une commande',
      'command, and it joins the network as a working node.': ', et il rejoint le réseau comme nœud actif.',
      'Demo your app in 30 seconds': 'Démontrez votre app en 30 secondes',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        'Démarrez un serveur local, ouvrez un tunnel, collez l\'URL publique dans un chat de réunion. Pas de déploiement, pas de Dockerfile, pas de CI — juste le code que vous avez déjà sur',
      'Reach your home computer anywhere': 'Atteignez votre ordinateur depuis partout',
      'Claim a permanent': 'Réclamez un',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        'permanent pour votre machine. Fichiers, tableaux de bord, serveurs de jeu, SSH sur le bureau — tout accessible depuis un téléphone à l\'autre bout du monde.',
      'Lease a micro-server by the minute': 'Louez un micro-serveur à la minute',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        'Besoin d\'un endpoint public pour tester un webhook, un atelier ou un projet du weekend ? Louez le tunnel d\'un autre pour quelques minutes avec les crédits gagnés en hébergeant le vôtre. Pas de facture mensuelle.',
      'Quick start': 'Démarrage rapide',
      'Grab your key from the': 'Récupérez votre clé depuis le',
      'and run one command — your local port is public.': 'et lancez une seule commande — votre port local devient public.',
      'Change': 'Remplacez',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': 'par le port sur lequel votre application écoute. Pour du TCP brut (bases de données, SSH, serveurs de jeu), utilisez',
      'You only need the': 'Vous avez juste besoin de la commande',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        '(intégrée à macOS, Linux et Windows moderne). Aucun client, aucun formulaire de compte à remplir.',
      'Get your key': 'Obtenez votre clé',
      'Open the': 'Ouvrez le',
      'dashboard': 'tableau de bord',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        '— il génère une clé SSH Ed25519 dans votre navigateur, dérive votre id de compte court (',
      '), and downloads the private key file': '), et télécharge le fichier de clé privée',
      '. Welcome bonus:': '. Bonus de bienvenue :',
      'credits.': 'crédits.',
      'Start something locally': 'Démarrez quelque chose en local',
      'Open a tunnel': 'Ouvrez un tunnel',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        'Votre nom d\'utilisateur SSH devient votre sous-domaine public. Réclamez un identifiant permanent dans le tableau de bord pour que personne d\'autre ne le prenne.',
      'Share the URL': 'Partagez l\'URL',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        'Envoyez le lien à un collègue, un client ou votre téléphone. Le tunnel reste actif tant que la session SSH est ouverte — et vous gagnez des crédits tout du long.',
      'Raw TCP works too': 'Le TCP brut fonctionne aussi',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        'Bases de données, SSH, serveurs de jeu, MQTT — tout ce qui n\'est pas HTTP. Le serveur attribue un port public et l\'affiche.',
      'Pay only for the traffic you use': 'Payez uniquement le trafic utilisé',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        'Pas d\'abonnement. Pas de palier "offre gratuite". Ouvrir un tunnel est gratuit — vous êtes facturé en crédits uniquement pour les octets qui transitent réellement, et les crédits sont remboursés dès que vous déconnectez ce qui n\'a pas servi.',
      'Metered by the byte': 'Mesuré à l\'octet',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        'Les tunnels inactifs ne coûtent rien. Une démo rapide avec quelques chargements coûte quelques crédits. Une charge lourde paie en proportion de la bande passante réellement consommée.',
      'Earn while you host': 'Gagnez en hébergeant',
      'Every minute your own device serves traffic, you earn': 'Chaque minute où votre appareil sert du trafic, vous gagnez',
      'in uptime rewards, plus': 'en récompenses de uptime, plus',
      'when someone leases your tunnel from the marketplace.': 'quand quelqu\'un loue votre tunnel sur le marché.',
      'Earn, learn, and build with the community': 'Gagnez, apprenez et construisez avec la communauté',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb repose sur une boucle simple : branchez un appareil libre, partagez son uptime, gagnez des crédits, dépensez-les pour ce dont vous avez besoin. Au passage, vous acquérez de vraies compétences réseau, SSH et systèmes distribués — aux côtés d\'autres qui font la même chose.',
      'Open marketplace': 'Marché ouvert',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        'Publiez le tunnel de votre appareil libre, fixez un prix à la minute et regardez les locations arriver. Parcourez ce que les autres proposent et louez la bonne région ou le bon matériel.',
      'Learn by hosting': 'Apprenez en hébergeant',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        'Vrai SSH inverse, vrai TCP, vraie facturation. Le dépôt est open source — lisez-le, forkez-le et utilisez AirWeb pour vous enseigner les morceaux d\'infrastructure que l\'école couvre rarement.',
      'The long view: a micro-server socio-economy': 'La vision à long terme : une socio-économie de micro-serveurs',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        'Le monde regorge de matériel parfaitement bon mais inutilisé — un milliard de téléphones, cent millions d\'ordinateurs portables, des baies de serveurs "obsolètes". Ils ont du CPU, de la mémoire et de la bande passante gaspillés. AirWeb est le premier pas pour rendre tout cela utile, aux mains de ceux qui l\'ont déjà payé, échangé de manière transparente et pair-à-pair.',
      'Open-source cloud provider': 'Fournisseur cloud open-source',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        'Les capacités d\'hyperscaler n\'ont pas à se cacher derrière trois logos et un formulaire de carte de crédit. Notre objectif est un cloud ouvert et fédéré où le "centre de données" est une coalition de foyers, bureaux et espaces communautaires.',
      'A micro-server economy': 'Une économie de micro-serveurs',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        'Les crédits gagnés en contribuant achètent la capacité des autres. Avec le temps, cette boucle devient une vraie économie — où petits opérateurs, étudiants et passionnés sont des participants à part entière, pas que des clients.',
      'Greener by default': 'Plus écologique par défaut',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        'Le serveur le plus durable est celui qui existe déjà. En donnant une seconde vie à des appareils qui seraient sinon inactifs — ou pire, à la décharge — AirWeb réduit le besoin de déployer de nouvelles flottes always-on pour servir quelques requêtes par minute. Flotte plus petite, moins de carbone incorporé, moins d\'e-déchets, moins de charge sur le réseau.',
      'Reuses hardware you already own instead of provisioning new servers.':
        'Réutilise le matériel que vous possédez déjà au lieu d\'approvisionner de nouveaux serveurs.',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        'Les tunnels inactifs ne consomment quasiment rien — ils tiennent juste un socket SSH.',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        'Pas de fermes always-on : la capacité apparaît quand les appareils sont branchés et disparaît quand ils ne le sont pas.',
      'FAQ': 'FAQ',
      'What kind of "spare device" actually works?': 'Quel genre d\'"appareil libre" fonctionne vraiment ?',
      'Anything that can run an': 'Tout ce qui peut exécuter un client',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        'et rester en ligne : vieux portable, bureau peu utilisé, Raspberry Pi, NAS, mini-PC, même certains routeurs. S\'il peut maintenir une session SSH, il peut être un nœud AirWeb.',
      'Do I need to install anything?': 'Dois-je installer quelque chose ?',
      'No. Any standard': 'Non. Tout',
      'client works once you\'ve downloaded': 'standard fonctionne une fois que vous avez téléchargé',
      '. There is an optional Node CLI (': '. Il existe un CLI Node optionnel (',
      ') that wraps': ') qui enveloppe',
      'with friendlier flags if you want one.': 'avec des options plus amicales si vous le souhaitez.',
      'How exactly am I charged?': 'Comment suis-je facturé exactement ?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        'Vous êtes facturé aux octets de trafic public qui transitent réellement par vos tunnels loués. Les endpoints inactifs ne coûtent rien. Le tableau de bord affiche en direct les gains et frais en crédits et en valeur USD estimée.',
      'How do I sign in from another device?': 'Comment me connecter depuis un autre appareil ?',
      'Open': 'Ouvrez',
      'and paste your private key. We never store private keys server-side — your':
        'et collez votre clé privée. Nous ne stockons jamais de clés privées côté serveur — votre',
      'account id is derived deterministically from the public key.':
        'id de compte est dérivé de manière déterministe de la clé publique.',
      'Is the traffic encrypted?': 'Le trafic est-il chiffré ?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        'Le segment entre votre appareil et AirWeb est chiffré par SSH. Le segment public utilise ce que parle la porte d\'entrée (HTTP sur le port brut, HTTPS derrière un proxy TLS). Pour du TLS bout-en-bout, terminez dans votre app locale et utilisez un tunnel TCP brut.',
      'Can I pick my own subdomain?': 'Puis-je choisir mon sous-domaine ?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        'Oui — le nom d\'utilisateur SSH avec lequel vous vous connectez devient votre sous-domaine (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        '). Dépensez des crédits dans le tableau de bord pour réserver un identifiant permanent que personne d\'autre ne peut prendre.',
      'How do I stop a tunnel?': 'Comment arrêter un tunnel ?',
      'Press': 'Appuyez sur',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        'dans la session SSH ou fermez le terminal. Le tunnel disparaît immédiatement de la liste active et vous n\'accumulez plus de frais.',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · tunnel ssh inverse auto-hébergé ·',
      'source': 'source'
    },
    de: {
      'AirWeb': 'AirWeb',
      'Dashboard': 'Übersicht',
      'Marketplace': 'Marktplatz',
      'My account': 'Mein Konto',
      'Account': 'Konto',
      'Theme': 'Design',
      'Dark': 'Dunkel',
      'Light': 'Hell',
      'System': 'System',
      'Language': 'Sprache',
      'Sign in': 'Anmelden',
      'Sign out': 'Abmelden',
      'Sign in with key': 'Mit Schlüssel anmelden',
      'Copy': 'Kopieren',
      'Copy account ID': 'Konto-ID kopieren',
      'Toggle overview': 'Übersicht ein/aus',
      'Get started in 10 seconds': 'In 10 Sekunden loslegen',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        'Wir erzeugen einen Ed25519-SSH-Schlüssel in deinem Browser, geben dir die Datei einmalig und leiten deine kurze Konto-ID daraus ab. Du erhältst',
      'credit signup bonus.': 'Credits als Anmeldebonus.',
      'Create account': 'Konto erstellen',
      'Overview': 'Übersicht',
      'Transactions': 'Transaktionen',
      'Admin': 'Admin',
      'Tunnels': 'Tunnel',
      'Leases': 'Mieten',
      'Reward / min': 'Belohnung / min',
      'Charge / min': 'Gebühr / min',
      'Earning / min': 'Verdienst / min',
      'est.': 'gesch.',
      'Number of your SSH tunnels currently online and reachable.':
        'Anzahl deiner aktuell online und erreichbaren SSH-Tunnel.',
      "Active marketplace leases you have purchased on others' tunnels.":
        'Aktive Marktplatz-Mieten, die du auf Tunneln anderer gebucht hast.',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        'Durchschnittliche pro Minute verdiente Credits aus Tunnel-Uptime in den letzten 24 Stunden. Ohne Verlauf wird der konfigurierte Satz × Online-Tunnel verwendet.',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        'Durchschnittliche pro Minute berechnete Credits für Bandbreite deiner aktiven Mieten in den letzten 24 Stunden.',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        'Netto-Credit-Fluss pro Minute: Belohnung minus Gebühr. Positiv = du verdienst, negativ = du verbrauchst mehr als du verdienst.',
      'My Connections': 'Meine Verbindungen',
      '+ Connection': '+ Verbindung',
      'Search connections…': 'Verbindungen suchen…',
      'All': 'Alle',
      'Listings': 'Anzeigen',
      'Filter nodes': 'Knoten filtern',
      'Protocol': 'Protokoll',
      'Any': 'Beliebig',
      'Search title/desc': 'Titel/Beschreibung suchen',
      'keyword': 'Stichwort',
      'Country': 'Land',
      'Min cores': 'Min. Kerne',
      'Min RAM (GB)': 'Min. RAM (GB)',
      'Max price (cr/min)': 'Max. Preis (ACR/min)',
      'OS contains': 'OS enthält',
      'linux, debian…': 'linux, debian…',
      'Apply': 'Anwenden',
      'Clear': 'Zurücksetzen',
      'Reset': 'Zurücksetzen',
      'Search title or description…': 'Titel oder Beschreibung suchen…',
      'All listings': 'Alle Anzeigen',
      'Recent credit activity': 'Letzte Credit-Aktivität',
      'Clear filters': 'Filter löschen',
      'Reason': 'Grund',
      'Ref': 'Ref.',
      'Delta': 'Delta',
      'When': 'Wann',
      'filter…': 'filtern…',
      'all': 'alle',
      '+ only': 'nur +',
      '− only': 'nur −',
      'Load 20 more': '20 weitere laden',
      'role': 'Rolle',
      'Refresh': 'Aktualisieren',
      'All live tunnels': 'Alle aktiven Tunnel',
      'All accounts': 'Alle Konten',
      'Resume': 'Fortsetzen',
      'Pause': 'Pause',
      'Disconnect': 'Trennen',
      'Demote': 'Herabstufen',
      'Promote': 'Befördern',
      '⚠ Read this before you continue': '⚠ Lies das, bevor du fortfährst',
      'You are about to:': 'Du wirst gleich:',
      'Generate': 'Erzeugen',
      'a brand-new Ed25519 SSH keypair on the server.': 'ein brandneues Ed25519-SSH-Schlüsselpaar auf dem Server.',
      'Download': 'Herunterladen',
      'the private key file (': 'die Datei mit dem privaten Schlüssel (',
      ') to this device —': ') auf dieses Gerät —',
      'immediately and automatically': 'sofort und automatisch',
      'to the account derived from that key.': 'beim aus diesem Schlüssel abgeleiteten Konto.',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        'Der private Schlüssel ist der einzige Zugang zu deinem Konto. Wir speichern ihn nicht. Wenn der Browser den Download blockiert oder du die Datei verlierst, sind Konto und Credits für immer verloren — keine Wiederherstellung.',
      'only': 'einzige',
      'not': 'nicht',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        'Stelle vor dem Fortfahren sicher, dass dein Browser Downloads von dieser Seite zulässt. Alle drei Schritte erfolgen mit einem Klick und können nicht rückgängig gemacht oder getrennt werden.',
      'I understand: if I lose this download, I lose my account.':
        'Ich verstehe: Verliere ich diesen Download, verliere ich mein Konto.',
      'Cancel': 'Abbrechen',
      'Generate, download & sign in': 'Erzeugen, herunterladen & anmelden',
      "✅ You're signed in — your key has been downloaded":
        '✅ Angemeldet — dein Schlüssel wurde heruntergeladen',
      'Downloads': 'Downloads',
      "Keep it safe — it's the only way back into this account.":
        'Bewahre ihn gut auf — er ist der einzige Weg zurück in dieses Konto.',
      'Account ID:': 'Konto-ID:',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        'Falls der Download nicht startete (Browser blockiert etc.), nutze jetzt die Buttons unten:',
      'Re-download key file': 'Schlüsseldatei erneut herunterladen',
      'Linux/macOS:': 'Linux/macOS:',
      'after downloading, run': 'nach dem Download ausführen',
      'Then connect:': 'Dann verbinden:',
      'Continue to dashboard': 'Weiter zur Übersicht',
      'List this tunnel on the marketplace': 'Diesen Tunnel auf dem Marktplatz anbieten',
      'Tunnel:': 'Tunnel:',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        'Der Server verbindet sich per SSH mit diesem Endpunkt mit den von dir angegebenen Sudo-Zugangsdaten. Die Verbindung muss vor der Veröffentlichung erfolgreich sein. Dein Passwort wird nicht gespeichert.',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        'Web-Mieten sind privat: jeder Mieter erhält einen eindeutigen Code, der zum Zugriff eingegeben werden muss. Der Code läuft am Ende der Mietzeit automatisch ab.',
      'Title *': 'Titel *',
      'Beefy home server': 'Kräftiger Heimserver',
      'Price (credits / min) *': 'Preis (Credits / min) *',
      'Lease term (minutes) *': 'Mietdauer (Minuten) *',
      'Description': 'Beschreibung',
      'Optional': 'Optional',
      'Bandwidth (Mbps)': 'Bandbreite (Mbps)',
      'optional': 'optional',
      'Sudo username *': 'Sudo-Benutzername *',
      'Sudo password *': 'Sudo-Passwort *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        'CPU, RAM, Festplatte und OS werden nach Validierung automatisch per SSH erkannt — du musst sie nicht eingeben.',
      'Validate & list': 'Validieren & anbieten',
      'Connect a tunnel': 'Tunnel verbinden',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        'Wähle aus, was du freigeben willst. Führe den erzeugten Befehl auf der Quellmaschine aus und halte das SSH-Fenster offen — Schließen beendet den Tunnel.',
      'Public endpoint': 'Öffentlicher Endpunkt',
      'Subdomain': 'Subdomain',
      'Local port': 'Lokaler Port',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        'Neue Tunnel starten pausiert — klicke in Meine Verbindungen auf Fortsetzen, um Traffic zu bedienen.',
      'Run this command': 'Diesen Befehl ausführen',
      'Got it': 'Verstanden',
      'This tunnel is not listable': 'Dieser Tunnel ist nicht anbietbar',
      "Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn't enough.":
        'Nur TCP-Tunnel, die SSH (Port 22) freigeben, können angeboten werden — Käufer müssen sich einloggen, ein HTTP-Forward reicht nicht.',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        'Verbinde dich mit dem Befehl unten neu. Wähle einen freien mysub-Namen (oder einen deiner Aliasse):',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        'Nach der Verbindung erscheint der neue Tunnel unter Meine Aktivität mit Typ tcp. Klicke auf Fortsetzen und dann auf Anbieten.',
      'Sign in with your AirWeb key': 'Mit deinem AirWeb-Schlüssel anmelden',
      'Paste your': 'Füge deine',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        '-Datei ein (den bei der Registrierung heruntergeladenen privaten OpenSSH-Schlüssel). Wir leiten die Konto-ID lokal auf dem Server neu ab und starten eine Sitzung — der Schlüssel wird nicht gespeichert.',
      'Private key (OpenSSH format)': 'Privater Schlüssel (OpenSSH-Format)',
      '…or upload it': '…oder lade ihn hoch',
      'Passphrase (if your key has one)': 'Passphrase (falls dein Schlüssel eine hat)',
      "Don't have a key?": 'Noch keinen Schlüssel?',
      'Register here': 'Hier registrieren',
      'Paste or upload your private key.': 'Privaten Schlüssel einfügen oder hochladen.',
      'Signing in…': 'Anmelden…',
      'Sign in failed:': 'Anmeldung fehlgeschlagen:',
      'Sign in failed.': 'Anmeldung fehlgeschlagen.',
      'That doesn\u2019t look like a valid OpenSSH private key.':
        'Das sieht nicht nach einem gültigen privaten OpenSSH-Schlüssel aus.',
      'online': 'online', 'offline': 'offline', 'paused': 'pausiert',
      'no credits': 'keine Credits', 'lease': 'Miete', 'listed': 'angeboten',
      'private': 'privat', 'validated': 'validiert', 'none': 'keine', 'never': 'nie',
      'expired': 'abgelaufen', 'open': 'öffnen', 'passcode': 'Code', 'spent': 'ausgegeben',
      'avg': 'Ø', 'cr/min': 'ACR/min', 'cr': 'ACR', 'ACR/min': 'ACR/min', 'ACR': 'ACR', 'tunnel offline': 'Tunnel offline',
      'Type': 'Typ', 'Item': 'Element', 'Details': 'Details', 'Charged': 'Berechnet',
      'Listed': 'Angeboten', 'Earned': 'Verdient', 'Rate': 'Tarif', 'Actions': 'Aktionen',
      'List': 'Anbieten', 'List?': 'Anbieten?', 'Remove listing': 'Anzeige entfernen',
      'Cannot remove while a lease is active': 'Kann nicht entfernt werden, solange eine Miete aktiv ist',
      'Disconnect this tunnel': 'Diesen Tunnel trennen',
      'Pause public access without disconnecting': 'Öffentlichen Zugriff pausieren ohne zu trennen',
      'Resume public access': 'Öffentlichen Zugriff fortsetzen',
      'This tunnel has an active marketplace listing — remove the listing first':
        'Dieser Tunnel hat eine aktive Anzeige — entferne zuerst die Anzeige',
      'Lease': 'Mieten', 'This connection is offline': 'Diese Verbindung ist offline',
      // ---- Landing page ----
      'A people-powered cloud, built from the': 'Eine von Menschen getragene Cloud, gebaut aus den',
      'devices you already own': 'Geräten, die du bereits besitzt',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb verwandelt ungenutzte Laptops, alte Handys und leerlaufende Heim-Server in winzige öffentliche Endpunkte. Zeige eine App in Sekunden, erreiche deinen Heimrechner von überall oder miete einen Mikro-Server pro Minute — und verdiene Credits, während deine Geräte mithelfen.',
      'get your key →': 'Schlüssel holen →',
      'or restore from existing key': 'oder aus vorhandenem Schlüssel wiederherstellen',
      'pay only for traffic': 'zahle nur für Traffic',
      'no install · just ssh': 'keine Installation · nur ssh',
      'open source · greener by default': 'Open Source · grüner von Haus aus',
      'What you can do today': 'Was du heute tun kannst',
      'Make spare devices useful': 'Mache ungenutzte Geräte nützlich',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        'Das alte MacBook in der Schublade oder der Raspberry Pi im Regal kann echten Traffic ausliefern. Einstöpseln, einen',
      'command, and it joins the network as a working node.': '-Befehl ausführen, und es tritt dem Netzwerk als aktiver Knoten bei.',
      'Demo your app in 30 seconds': 'Deine App in 30 Sekunden zeigen',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        'Starte einen lokalen Server, öffne einen Tunnel, füge die öffentliche URL in den Meeting-Chat ein. Kein Deploy, kein Dockerfile, kein CI — nur der Code, den du schon hast auf',
      'Reach your home computer anywhere': 'Erreiche deinen Heimrechner überall',
      'Claim a permanent': 'Reserviere einen permanenten',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        'für deinen Heim-Rechner. Dateien, Dashboards, Game-Server, SSH auf den Desktop — alles vom Handy am anderen Ende der Welt erreichbar.',
      'Lease a micro-server by the minute': 'Miete einen Mikro-Server pro Minute',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        'Brauchst du einen öffentlichen Endpunkt für einen Webhook-Test, einen Workshop oder ein Wochenendprojekt? Miete den Tunnel eines anderen für ein paar Minuten mit den Credits, die du mit deinem eigenen verdient hast. Keine Monatsrechnungen.',
      'Quick start': 'Schnellstart',
      'Grab your key from the': 'Hol dir deinen Schlüssel im',
      'and run one command — your local port is public.': 'und führe einen einzigen Befehl aus — dein lokaler Port ist öffentlich.',
      'Change': 'Ersetze',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': 'durch den Port, auf dem deine App lauscht. Für rohes TCP (Datenbanken, SSH, Gameserver) verwende',
      'You only need the': 'Du brauchst nur den',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        '-Befehl (in macOS, Linux und modernen Windows eingebaut). Kein Client, kein Konto-Formular.',
      'Get your key': 'Schlüssel holen',
      'Open the': 'Öffne das',
      'dashboard': 'Dashboard',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        '— es generiert einen Ed25519-SSH-Schlüssel im Browser, leitet deine kurze Konto-ID ab (',
      '), and downloads the private key file': '), und lädt die private Schlüsseldatei herunter',
      '. Welcome bonus:': '. Willkommensbonus:',
      'credits.': 'Credits.',
      'Start something locally': 'Starte etwas lokal',
      'Open a tunnel': 'Öffne einen Tunnel',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        'Dein SSH-Benutzername wird deine öffentliche Subdomain. Reserviere im Dashboard ein permanentes Handle, damit es niemand sonst nehmen kann.',
      'Share the URL': 'URL teilen',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        'Schicke den Link an einen Kollegen, einen Kunden oder dein Handy. Der Tunnel bleibt, solange die SSH-Session offen ist — und du verdienst die ganze Zeit Credits.',
      'Raw TCP works too': 'Raw TCP funktioniert auch',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        'Datenbanken, SSH, Game-Server, MQTT — alles, was nicht HTTP ist. Der Server vergibt einen öffentlichen Port und gibt ihn zurück.',
      'Pay only for the traffic you use': 'Zahle nur für den Traffic, den du nutzt',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        'Keine Abos. Keine "Free-Tier"-Klippen. Einen Tunnel zu öffnen ist kostenlos — abgerechnet wird in Credits nur für die Bytes, die wirklich durchfließen, und Credits werden zurückerstattet, sobald du Ungenutztes trennst.',
      'Metered by the byte': 'Abrechnung pro Byte',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        'Leere Tunnel kosten nichts. Eine kurze Demo mit ein paar Seitenaufrufen kostet ein paar Credits. Eine schwere Last zahlt anteilig zum tatsächlichen Bandbreitenverbrauch.',
      'Earn while you host': 'Verdiene beim Hosten',
      'Every minute your own device serves traffic, you earn': 'Jede Minute, in der dein Gerät Traffic ausliefert, verdienst du',
      'in uptime rewards, plus': 'an Uptime-Belohnungen, plus',
      'when someone leases your tunnel from the marketplace.': ', wenn jemand deinen Tunnel im Marktplatz mietet.',
      'Earn, learn, and build with the community': 'Verdiene, lerne und baue mit der Community',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb basiert auf einem einfachen Kreislauf: ungenutztes Gerät einstöpseln, Uptime teilen, Credits verdienen, sie für Bedarfe ausgeben. Nebenbei lernst du echtes Networking, SSH und Distributed Systems — gemeinsam mit anderen, die dasselbe tun.',
      'Open marketplace': 'Offener Marktplatz',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        'Stelle den Tunnel deines Ersatzgeräts ein, setze einen Preis pro Minute und siehe Mieten eingehen. Stöbere durch Angebote und miete die passende Region oder Hardware.',
      'Learn by hosting': 'Lerne durch Hosten',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        'Echtes Reverse-SSH, echtes TCP, echte Abrechnung. Das Repo ist Open Source — lies, forke und nutze AirWeb, um dir die Infrastruktur-Teile beizubringen, die Schulen selten abdecken.',
      'The long view: a micro-server socio-economy': 'Der lange Blick: eine Mikro-Server-Sozio-Ökonomie',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        'Die Welt ist voll von einwandfreier Hardware, die brachliegt — eine Milliarde Handys, hundert Millionen Laptops, Racks "veralteter" Server. Sie haben CPU, Speicher und Bandbreite, die heute verschwendet werden. AirWeb ist der erste Schritt, all das nützlich zu machen, im Besitz derer, die es bezahlt haben, transparent peer-to-peer gehandelt.',
      'Open-source cloud provider': 'Open-Source-Cloud-Anbieter',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        'Hyperscaler-Fähigkeiten müssen nicht hinter drei Logos und einem Kreditkarten-Formular leben. Unser Langzeit-Ziel ist eine offene, föderierte Cloud, in der das "Rechenzentrum" eine Koalition aus Wohnungen, Büros und Gemeinschaftsräumen ist.',
      'A micro-server economy': 'Eine Mikro-Server-Ökonomie',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        'Credits, die durch beigetragene Kapazität verdient werden, kaufen Kapazität anderer. Mit der Zeit wird daraus eine echte Wirtschaft — in der kleine Betreiber, Studenten und Hobbyisten erstklassige Teilnehmer sind, nicht nur Kunden.',
      'Greener by default': 'Grüner von Haus aus',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        'Der nachhaltigste Server ist der, den es schon gibt. Indem AirWeb Geräten ein zweites Leben gibt, die sonst brachliegen — oder schlimmer, auf dem Schrott landen — verringert es den Bedarf an neuen Always-on-Flotten nur für ein paar Anfragen pro Minute. Kleinere Flotte, weniger graue Energie, weniger E-Müll, weniger Netzbelastung.',
      'Reuses hardware you already own instead of provisioning new servers.':
        'Wiederverwendet Hardware, die du bereits besitzt, statt neue Server bereitzustellen.',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        'Untätige Tunnel verbrauchen praktisch nichts — sie hängen nur an einem SSH-Socket.',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        'Keine Always-on-Overhead-Farmen: Kapazität erscheint, wenn Geräte eingestöpselt sind, und verschwindet, wenn nicht.',
      'FAQ': 'FAQ',
      'What kind of "spare device" actually works?': 'Welche Art "ungenutztes Gerät" funktioniert eigentlich?',
      'Anything that can run an': 'Alles, was einen',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        '-Client laufen lassen und online bleiben kann: ein alter Laptop, ein kaum genutzter Desktop, ein Raspberry Pi, ein NAS, ein Mini-PC, sogar manche Router. Wenn es eine SSH-Session offen halten kann, kann es ein AirWeb-Knoten sein.',
      'Do I need to install anything?': 'Muss ich etwas installieren?',
      'No. Any standard': 'Nein. Jeder Standard-',
      'client works once you\'ve downloaded': '-Client funktioniert, sobald du',
      '. There is an optional Node CLI (': 'heruntergeladen hast. Es gibt ein optionales Node-CLI (',
      ') that wraps': '), das',
      'with friendlier flags if you want one.': 'mit freundlicheren Flags umhüllt, falls gewünscht.',
      'How exactly am I charged?': 'Wie werde ich genau abgerechnet?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        'Abgerechnet wird nach Bytes öffentlichen Traffics, der tatsächlich durch deine vermieteten Tunnel fließt. Untätige Endpunkte kosten nichts. Das Dashboard zeigt Live-Einnahmen und -Kosten in Credits und geschätztem USD-Wert.',
      'How do I sign in from another device?': 'Wie melde ich mich von einem anderen Gerät an?',
      'Open': 'Öffne',
      'and paste your private key. We never store private keys server-side — your':
        'und füge deinen privaten Schlüssel ein. Wir speichern niemals private Schlüssel serverseitig — deine',
      'account id is derived deterministically from the public key.':
        '-Konto-ID wird deterministisch aus dem öffentlichen Schlüssel abgeleitet.',
      'Is the traffic encrypted?': 'Ist der Traffic verschlüsselt?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        'Der Abschnitt zwischen deinem Gerät und AirWeb ist per SSH verschlüsselt. Der öffentliche Abschnitt nutzt, was die Eingangstür spricht (HTTP am Port, HTTPS hinter TLS-Reverse-Proxy). Für End-zu-End-TLS terminiere in deiner lokalen App und nutze einen Raw-TCP-Tunnel.',
      'Can I pick my own subdomain?': 'Kann ich meine eigene Subdomain wählen?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        'Ja — der SSH-Benutzername, mit dem du dich verbindest, wird deine Subdomain (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        '). Gib im Dashboard Credits aus, um ein permanentes Handle zu reservieren, das niemand sonst nehmen kann.',
      'How do I stop a tunnel?': 'Wie stoppe ich einen Tunnel?',
      'Press': 'Drücke',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        'in der SSH-Session oder schließe das Terminal. Der Tunnel verschwindet sofort aus der aktiven Liste und es entstehen keine weiteren Kosten.',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · selbstgehosteter Reverse-SSH-Tunnel ·',
      'source': 'Quelltext'
    },
    zh: {
      'AirWeb': 'AirWeb',
      'Dashboard': '仪表盘',
      'Marketplace': '市场',
      'My account': '我的账户',
      'Account': '账户',
      'Theme': '主题',
      'Dark': '深色',
      'Light': '浅色',
      'System': '系统',
      'Language': '语言',
      'Sign in': '登录',
      'Sign out': '退出登录',
      'Sign in with key': '用密钥登录',
      'Copy': '复制',
      'Copy account ID': '复制账户 ID',
      'Toggle overview': '切换概览',
      'Get started in 10 seconds': '10 秒内开始',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        '我们会在你的浏览器中生成 Ed25519 SSH 密钥，向你交付一次私钥文件，并由此派生你的短账户 ID。你将获得',
      'credit signup bonus.': '积分的注册奖励。',
      'Create account': '创建账户',
      'Overview': '概览',
      'Transactions': '交易',
      'Admin': '管理',
      'Tunnels': '隧道',
      'Leases': '租赁',
      'Reward / min': '奖励 / 分钟',
      'Charge / min': '费用 / 分钟',
      'Earning / min': '收益 / 分钟',
      'est.': '估算',
      'Number of your SSH tunnels currently online and reachable.':
        '当前在线且可访问的 SSH 隧道数量。',
      "Active marketplace leases you have purchased on others' tunnels.":
        '你在他人隧道上购买的有效市场租赁。',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        '过去 24 小时内每分钟通过隧道在线时间获得的平均积分。无历史数据时，使用配置费率 × 在线隧道数。',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        '过去 24 小时内你的有效租赁所消耗带宽每分钟收取的平均积分。',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        '每分钟净积分流：奖励减去费用。正值表示盈利，负值表示消耗大于赚取。',
      'My Connections': '我的连接',
      '+ Connection': '+ 连接',
      'Search connections…': '搜索连接…',
      'All': '全部',
      'Listings': '挂牌',
      'Filter nodes': '筛选节点',
      'Protocol': '协议',
      'Any': '任意',
      'Search title/desc': '搜索标题/描述',
      'keyword': '关键词',
      'Country': '国家',
      'Min cores': '最低核心数',
      'Min RAM (GB)': '最低内存 (GB)',
      'Max price (cr/min)': '最高价 (ACR/分)',
      'OS contains': '操作系统包含',
      'linux, debian…': 'linux, debian…',
      'Apply': '应用',
      'Clear': '清除',
      'Reset': '重置',
      'Search title or description…': '搜索标题或描述…',
      'All listings': '所有挂牌',
      'Recent credit activity': '最近积分活动',
      'Clear filters': '清除筛选',
      'Reason': '原因',
      'Ref': '引用',
      'Delta': '变化',
      'When': '时间',
      'filter…': '筛选…',
      'all': '全部',
      '+ only': '仅 +',
      '− only': '仅 −',
      'Load 20 more': '再加载 20 条',
      'role': '角色',
      'Refresh': '刷新',
      'All live tunnels': '所有活动隧道',
      'All accounts': '所有账户',
      'Resume': '恢复',
      'Pause': '暂停',
      'Disconnect': '断开',
      'Demote': '降级',
      'Promote': '提升',
      '⚠ Read this before you continue': '⚠ 继续前请阅读',
      'You are about to:': '你即将：',
      'Generate': '生成',
      'a brand-new Ed25519 SSH keypair on the server.': '在服务器上生成全新的 Ed25519 SSH 密钥对。',
      'Download': '下载',
      'the private key file (': '私钥文件 (',
      ') to this device —': ') 到本设备 —',
      'immediately and automatically': '立即且自动',
      'to the account derived from that key.': '到由该密钥派生的账户。',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        '私钥是访问账户的唯一方式。我们不存储它。如果浏览器阻止下载或文件丢失，账户和积分将永久丢失 — 无法恢复。',
      'only': '唯一',
      'not': '不',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        '继续前请确保浏览器允许从此站点下载文件。三步在一次点击中完成，无法撤销或拆分。',
      'I understand: if I lose this download, I lose my account.':
        '我明白：丢失此下载即失去账户。',
      'Cancel': '取消',
      'Generate, download & sign in': '生成、下载并登录',
      "✅ You're signed in — your key has been downloaded":
        '✅ 已登录 — 密钥已下载',
      'Downloads': '下载',
      "Keep it safe — it's the only way back into this account.":
        '请妥善保管 — 这是返回此账户的唯一方式。',
      'Account ID:': '账户 ID：',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        '如果下载未开始（被浏览器阻止等），请立即使用下方按钮：',
      'Re-download key file': '重新下载密钥文件',
      'Linux/macOS:': 'Linux/macOS：',
      'after downloading, run': '下载后运行',
      'Then connect:': '然后连接：',
      'Continue to dashboard': '继续到仪表盘',
      'List this tunnel on the marketplace': '将此隧道挂牌到市场',
      'Tunnel:': '隧道：',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        '服务器将使用你提供的 sudo 凭据通过 SSH 连接此端点。挂牌发布前必须连接成功。你的密码不会被存储。',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        'Web 租赁是私密的：每位承租者获得唯一通行码，访问站点需输入。租期结束时通行码自动失效。',
      'Title *': '标题 *',
      'Beefy home server': '强劲的家庭服务器',
      'Price (credits / min) *': '价格（积分/分钟）*',
      'Lease term (minutes) *': '租期（分钟）*',
      'Description': '描述',
      'Optional': '可选',
      'Bandwidth (Mbps)': '带宽 (Mbps)',
      'optional': '可选',
      'Sudo username *': 'Sudo 用户名 *',
      'Sudo password *': 'Sudo 密码 *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        '凭据验证后，CPU、内存、磁盘和操作系统会通过 SSH 自动检测 — 无需手动输入。',
      'Validate & list': '验证并挂牌',
      'Connect a tunnel': '连接隧道',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        '选择要暴露的内容。在源机器上运行生成的命令并保持 SSH 窗口打开 — 关闭即结束隧道。',
      'Public endpoint': '公共端点',
      'Subdomain': '子域名',
      'Local port': '本地端口',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        '新隧道以暂停状态启动 — 在「我的连接」中点击「恢复」以开始提供流量。',
      'Run this command': '运行此命令',
      'Got it': '明白了',
      'This tunnel is not listable': '此隧道不可挂牌',
      "Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn't enough.":
        '只有暴露 SSH（端口 22）的 TCP 隧道可以挂牌 — 买家需登录主机，HTTP 转发不够。',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        '使用以下命令重新连接。选择任意空闲的 mysub 名称（或使用你的别名）：',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        '连接后，新隧道将出现在「我的活动」中，类型为 tcp。点击「恢复」，然后「挂牌出租」。',
      'Sign in with your AirWeb key': '使用你的 AirWeb 密钥登录',
      'Paste your': '粘贴你的',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        '文件（注册时下载的 OpenSSH 私钥）。我们在服务器本地由此重新派生账户 ID 并开始会话 — 密钥不会被存储。',
      'Private key (OpenSSH format)': '私钥（OpenSSH 格式）',
      '…or upload it': '…或上传',
      'Passphrase (if your key has one)': '口令（如果你的密钥有）',
      "Don't have a key?": '还没有密钥？',
      'Register here': '在此注册',
      'Paste or upload your private key.': '粘贴或上传你的私钥。',
      'Signing in…': '登录中…',
      'Sign in failed:': '登录失败：',
      'Sign in failed.': '登录失败。',
      'That doesn\u2019t look like a valid OpenSSH private key.':
        '这不像是有效的 OpenSSH 私钥。',
      'online': '在线', 'offline': '离线', 'paused': '已暂停',
      'no credits': '无积分', 'lease': '租赁', 'listed': '已挂牌',
      'private': '私密', 'validated': '已验证', 'none': '无', 'never': '从未',
      'expired': '已过期', 'open': '打开', 'passcode': '通行码', 'spent': '已花费',
      'avg': '平均', 'cr/min': 'ACR/分', 'cr': 'ACR', 'ACR/min': 'ACR/分', 'ACR': 'ACR', 'tunnel offline': '隧道离线',
      'Type': '类型', 'Item': '项目', 'Details': '详情', 'Charged': '费用',
      'Listed': '挂牌', 'Earned': '收益', 'Rate': '费率', 'Actions': '操作',
      'List': '挂牌', 'List?': '挂牌？', 'Remove listing': '移除挂牌',
      'Cannot remove while a lease is active': '租赁活跃时无法移除',
      'Disconnect this tunnel': '断开此隧道',
      'Pause public access without disconnecting': '暂停公共访问但不断开',
      'Resume public access': '恢复公共访问',
      'This tunnel has an active marketplace listing — remove the listing first':
        '此隧道有活跃挂牌 — 请先移除挂牌',
      'Lease': '租赁', 'This connection is offline': '此连接已离线',
      // ---- Landing page ----
      'A people-powered cloud, built from the': '由人民驱动的云,构建于',
      'devices you already own': '你已经拥有的设备',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb 把闲置的笔记本、旧手机和空转的家庭服务器变成小型公共端点。几秒钟演示一个应用,从任何地方访问你的家庭电脑,或按分钟租赁一个微型服务器 —— 同时在你的设备帮忙分担负载时赚取积分。',
      'get your key →': '获取你的密钥 →',
      'or restore from existing key': '或从已有密钥恢复',
      'pay only for traffic': '只为流量付费',
      'no install · just ssh': '无需安装 · 只用 ssh',
      'open source · greener by default': '开源 · 默认更环保',
      'What you can do today': '你今天能做什么',
      'Make spare devices useful': '让闲置设备发挥作用',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        '抽屉里那台旧 MacBook 或货架上的 Raspberry Pi 能默默地服务真实流量。插上电源,运行一条',
      'command, and it joins the network as a working node.': '命令,它就作为工作节点加入网络。',
      'Demo your app in 30 seconds': '30 秒内演示你的应用',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        '启动一个本地服务器,打开一个隧道,把公共 URL 粘贴到会议聊天中。无需部署、无需 Dockerfile、无需 CI —— 只要你已经在运行的代码',
      'Reach your home computer anywhere': '随时随地访问你的家用电脑',
      'Claim a permanent': '为你的家用机申领一个永久的',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        '。文件、仪表盘、游戏服务器、SSH 到桌面 —— 从世界另一端的手机上都能访问。',
      'Lease a micro-server by the minute': '按分钟租赁一个微型服务器',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        '需要一个公共端点做 webhook 测试、工作坊或周末项目?用你托管自己的隧道赚到的积分,租别人的隧道几分钟。没有月度账单。',
      'Quick start': '快速开始',
      'Grab your key from the': '从',
      'and run one command — your local port is public.': '获取密钥并运行一条命令 — 你的本地端口即刻公开。',
      'Change': '将',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': '改为你的应用监听的端口。如需纯 TCP（数据库、SSH、游戏服务器），请使用',
      'You only need the': '你只需要',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        '命令(macOS、Linux 和现代 Windows 内置)。无需客户端,无需填写账户表单。',
      'Get your key': '获取你的密钥',
      'Open the': '打开',
      'dashboard': '仪表盘',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        ' —— 它在你的浏览器中生成 Ed25519 SSH 密钥,派生你的短账户 ID (',
      '), and downloads the private key file': '),并下载私钥文件',
      '. Welcome bonus:': '。欢迎奖励:',
      'credits.': '积分。',
      'Start something locally': '在本地启动一些东西',
      'Open a tunnel': '打开一个隧道',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        '你的 SSH 用户名成为你的公共子域名。在仪表盘中申领一个永久句柄,别人就拿不走了。',
      'Share the URL': '分享 URL',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        '把链接发给同事、客户或你的手机。只要 SSH 会话还开着,隧道就一直在 —— 你也一直在赚积分。',
      'Raw TCP works too': '原始 TCP 也可以',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        '数据库、SSH、游戏服务器、MQTT —— 任何非 HTTP 的东西。服务器分配一个公共端口并返回。',
      'Pay only for the traffic you use': '只为你使用的流量付费',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        '无订阅。无"免费层"陡降。打开隧道免费 —— 只按实际通过的字节用积分计费,断开未使用的部分会即时退还积分。',
      'Metered by the byte': '按字节计费',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        '空闲隧道不花钱。少量页面加载的快速演示花几个积分。重负载按实际消耗的带宽成比例付费。',
      'Earn while you host': '托管即赚取',
      'Every minute your own device serves traffic, you earn': '你的设备每提供一分钟流量,你就赚',
      'in uptime rewards, plus': '的在线奖励,加上',
      'when someone leases your tunnel from the marketplace.': ',当有人从市场租用你的隧道时。',
      'Earn, learn, and build with the community': '与社区一起赚取、学习和构建',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb 围绕一个简单循环:插入闲置设备,共享其在线时间,赚取积分,用它换你需要的东西。一路上你掌握真实的网络、SSH 和分布式系统技能 —— 与做同样事情的人一起。',
      'Open marketplace': '开放市场',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        '上架你的闲置设备隧道,设置每分钟价格,看着租约滚滚而来。浏览他人的供应,租到合适的地区或硬件。',
      'Learn by hosting': '在托管中学习',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        '真实的反向 SSH、真实的 TCP、真实的计费。仓库开源 —— 读它、fork 它,用 AirWeb 自学学校很少涵盖的基础设施。',
      'The long view: a micro-server socio-economy': '长远视角:微服务器社会经济',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        '世界上充满了状况良好却闲置的硬件 —— 十亿部手机、一亿台笔记本、一柜柜"过时"服务器。它们有今天被浪费的 CPU、内存和带宽。AirWeb 是让这一切静静变得有用的第一步,归早已为之付费的人所有,以透明的点对点方式交易。',
      'Open-source cloud provider': '开源云服务商',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        '超大规模级能力不必躲在三个 logo 和一张信用卡表单背后。我们的长期目标是一个开放、联邦化的云,其中"数据中心"是家庭、办公室和社区空间的联盟。',
      'A micro-server economy': '微服务器经济',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        '贡献算力赚到的积分用于购买他人的算力。随着时间推移,这个循环成为真正的经济 —— 在那里小运营者、学生和爱好者是一等参与者,而非仅仅客户。',
      'Greener by default': '默认更环保',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        '最可持续的服务器是已经存在的那台。通过给原本闲置 —— 或更糟,被填埋 —— 的设备第二次生命,AirWeb 减少了仅为每分钟几个请求而启动新批 always-on 硬件的需要。更小的机群、更少的碳足迹、更少的电子垃圾、更少的电网负担。',
      'Reuses hardware you already own instead of provisioning new servers.':
        '重用你已经拥有的硬件,而不是配备新服务器。',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        '空闲隧道几乎不消耗资源 —— 只是占着一个 SSH 套接字。',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        '没有 always-on 的冗余机群:设备插上时容量出现,不插上时就消失。',
      'FAQ': '常见问题',
      'What kind of "spare device" actually works?': '什么样的"闲置设备"可以用?',
      'Anything that can run an': '任何能运行',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        '客户端并保持在线的设备:旧笔记本、你几乎不用的台式机、Raspberry Pi、NAS、迷你 PC,甚至一些路由器。只要能保持 SSH 会话,它就可以成为 AirWeb 节点。',
      'Do I need to install anything?': '我需要安装什么吗?',
      'No. Any standard': '不需要。任何标准的',
      'client works once you\'ve downloaded': '客户端只要你下载了',
      '. There is an optional Node CLI (': '就能用。有一个可选的 Node CLI (',
      ') that wraps': '),它封装了',
      'with friendlier flags if you want one.': ',提供更友好的参数,如果你愿意用的话。',
      'How exactly am I charged?': '到底是怎么收费的?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        '你按实际通过你出租隧道的公共流量字节计费。空闲端点不花钱。仪表盘以积分和估算的美元值实时显示收入和费用。',
      'How do I sign in from another device?': '我如何从另一台设备登录?',
      'Open': '打开',
      'and paste your private key. We never store private keys server-side — your':
        '并粘贴你的私钥。我们从不在服务端存储私钥 —— 你的',
      'account id is derived deterministically from the public key.':
        '账户 ID 是从公钥确定性派生的。',
      'Is the traffic encrypted?': '流量加密吗?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        '你的设备到 AirWeb 这一段由 SSH 加密。公共那一段使用前门支持的协议(裸端口上是 HTTP,TLS 反向代理后是 HTTPS)。要端到端 TLS,请在本地应用内终止 TLS 并使用原始 TCP 隧道。',
      'Can I pick my own subdomain?': '我可以选择自己的子域名吗?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        '可以 —— 你连接时使用的 SSH 用户名就是你的子域名 (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        ')。在仪表盘花积分申领一个永久句柄,别人就拿不走。',
      'How do I stop a tunnel?': '我怎么停止一个隧道?',
      'Press': '按',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        '在 SSH 会话中,或关闭终端。隧道会立即从活跃列表中消失,你也不再产生费用。',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · 自托管反向 ssh 隧道 ·',
      'source': '源码'
    },
    ja: {
      'AirWeb': 'AirWeb',
      'Dashboard': 'ダッシュボード',
      'Marketplace': 'マーケット',
      'My account': 'マイアカウント',
      'Account': 'アカウント',
      'Theme': 'テーマ',
      'Dark': 'ダーク',
      'Light': 'ライト',
      'System': 'システム',
      'Language': '言語',
      'Sign in': 'サインイン',
      'Sign out': 'サインアウト',
      'Sign in with key': 'キーでサインイン',
      'Copy': 'コピー',
      'Copy account ID': 'アカウントIDをコピー',
      'Toggle overview': '概要の表示切替',
      'Get started in 10 seconds': '10秒で始める',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        'ブラウザでEd25519 SSHキーを生成し、秘密鍵ファイルを一度だけお渡しし、そこから短いアカウントIDを導出します。あなたは',
      'credit signup bonus.': 'クレジットのサインアップボーナスを受け取ります。',
      'Create account': 'アカウント作成',
      'Overview': '概要',
      'Transactions': '取引',
      'Admin': '管理',
      'Tunnels': 'トンネル',
      'Leases': 'リース',
      'Reward / min': '報酬 / 分',
      'Charge / min': '料金 / 分',
      'Earning / min': '収益 / 分',
      'est.': '推定',
      'Number of your SSH tunnels currently online and reachable.':
        '現在オンラインで到達可能なあなたのSSHトンネル数。',
      "Active marketplace leases you have purchased on others' tunnels.":
        '他者のトンネルで購入した有効なマーケットリース。',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        '過去24時間のトンネル稼働で1分あたりに獲得した平均クレジット。履歴がない場合は設定レート×オンライントンネル数を使用。',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        '過去24時間に有効なリースが消費した帯域に対し1分あたりに課金された平均クレジット。',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        '1分あたりの純クレジットフロー：報酬から料金を引いたもの。正は収益、負は消費が収益を上回る。',
      'My Connections': 'マイ接続',
      '+ Connection': '+ 接続',
      'Search connections…': '接続を検索…',
      'All': 'すべて',
      'Listings': '出品',
      'Filter nodes': 'ノードを絞り込み',
      'Protocol': 'プロトコル',
      'Any': '任意',
      'Search title/desc': 'タイトル/説明を検索',
      'keyword': 'キーワード',
      'Country': '国',
      'Min cores': '最小コア数',
      'Min RAM (GB)': '最小RAM (GB)',
      'Max price (cr/min)': '最大価格 (ACR/分)',
      'OS contains': 'OSに含む',
      'linux, debian…': 'linux, debian…',
      'Apply': '適用',
      'Clear': 'クリア',
      'Reset': 'リセット',
      'Search title or description…': 'タイトルまたは説明を検索…',
      'All listings': 'すべての出品',
      'Recent credit activity': '最近のクレジット活動',
      'Clear filters': 'フィルタをクリア',
      'Reason': '理由',
      'Ref': '参照',
      'Delta': '増減',
      'When': '日時',
      'filter…': 'フィルタ…',
      'all': 'すべて',
      '+ only': '+ のみ',
      '− only': '− のみ',
      'Load 20 more': 'さらに20件読み込む',
      'role': 'ロール',
      'Refresh': '更新',
      'All live tunnels': 'すべての稼働中トンネル',
      'All accounts': 'すべてのアカウント',
      'Resume': '再開',
      'Pause': '一時停止',
      'Disconnect': '切断',
      'Demote': '降格',
      'Promote': '昇格',
      '⚠ Read this before you continue': '⚠ 続行前にお読みください',
      'You are about to:': 'あなたは以下を行います：',
      'Generate': '生成',
      'a brand-new Ed25519 SSH keypair on the server.': 'サーバー上で新しいEd25519 SSH鍵ペアを。',
      'Download': 'ダウンロード',
      'the private key file (': '秘密鍵ファイル (',
      ') to this device —': ') をこのデバイスへ —',
      'immediately and automatically': '即座かつ自動的に',
      'to the account derived from that key.': 'その鍵から派生したアカウントへ。',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        '秘密鍵はアカウントにアクセスする唯一の手段です。当社は保存しません。ブラウザがダウンロードをブロックしたりファイルを紛失すると、アカウントとクレジットは永久に失われ、復旧できません。',
      'only': '唯一の',
      'not': 'いいえ',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        '続行前に、ブラウザがこのサイトからのダウンロードを許可していることを確認してください。3つの手順は1クリックで実行され、取り消しや分割はできません。',
      'I understand: if I lose this download, I lose my account.':
        '理解しました：このダウンロードを失うとアカウントを失います。',
      'Cancel': 'キャンセル',
      'Generate, download & sign in': '生成・ダウンロード・サインイン',
      "✅ You're signed in — your key has been downloaded":
        '✅ サインイン済み — キーをダウンロードしました',
      'Downloads': 'ダウンロード',
      "Keep it safe — it's the only way back into this account.":
        '大切に保管してください — このアカウントへ戻る唯一の手段です。',
      'Account ID:': 'アカウントID：',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        'ダウンロードが開始しなかった場合（ブラウザのブロックなど）、今すぐ下のボタンを使用してください：',
      'Re-download key file': 'キーファイルを再ダウンロード',
      'Linux/macOS:': 'Linux/macOS：',
      'after downloading, run': 'ダウンロード後、実行：',
      'Then connect:': '次に接続：',
      'Continue to dashboard': 'ダッシュボードへ進む',
      'List this tunnel on the marketplace': 'このトンネルをマーケットに出品',
      'Tunnel:': 'トンネル：',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        'サーバーは提供されたsudo認証情報でこのエンドポイントにSSH接続します。出品公開前に接続成功が必要です。パスワードは保存されません。',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        'Webリースは非公開です：各借主は固有のパスコードを受け取り、サイトアクセス時に入力が必要です。パスコードはリース終了時に自動的に失効します。',
      'Title *': 'タイトル *',
      'Beefy home server': 'パワフルなホームサーバー',
      'Price (credits / min) *': '価格（クレジット/分）*',
      'Lease term (minutes) *': 'リース期間（分）*',
      'Description': '説明',
      'Optional': '任意',
      'Bandwidth (Mbps)': '帯域 (Mbps)',
      'optional': '任意',
      'Sudo username *': 'Sudoユーザー名 *',
      'Sudo password *': 'Sudoパスワード *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        '認証成功後、CPU・RAM・ディスク・OSはSSH経由で自動検出されます — 入力不要です。',
      'Validate & list': '検証して出品',
      'Connect a tunnel': 'トンネルを接続',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        '公開したいものを選択。ソースマシンで生成コマンドを実行し、SSHウィンドウを開いたままに — 閉じるとトンネルは終了します。',
      'Public endpoint': '公開エンドポイント',
      'Subdomain': 'サブドメイン',
      'Local port': 'ローカルポート',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        '新しいトンネルは一時停止状態で開始 — 「マイ接続」で「再開」をクリックしてトラフィック提供を開始します。',
      'Run this command': 'このコマンドを実行',
      'Got it': '了解',
      'This tunnel is not listable': 'このトンネルは出品できません',
      "Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn't enough.":
        'SSH（ポート22）を公開するTCPトンネルのみ出品可能 — 購入者はマシンにログインする必要があり、HTTP転送では不十分です。',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        '下のコマンドで再接続してください。空いているmysub名（またはあなたのハンドル）を選択：',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        '接続後、新しいトンネルは「マイアクティビティ」に種別tcpで表示されます。「再開」をクリックし、次に「リース出品」。',
      'Sign in with your AirWeb key': 'AirWebキーでサインイン',
      'Paste your': 'あなたの',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        'ファイル（登録時にダウンロードしたOpenSSH秘密鍵）を貼り付けてください。サーバー上でアカウントIDを再導出してセッションを開始 — キーは保存されません。',
      'Private key (OpenSSH format)': '秘密鍵（OpenSSH形式）',
      '…or upload it': '…またはアップロード',
      'Passphrase (if your key has one)': 'パスフレーズ（鍵に設定されている場合）',
      "Don't have a key?": 'キーをお持ちでない？',
      'Register here': 'こちらで登録',
      'Paste or upload your private key.': '秘密鍵を貼り付けまたはアップロードしてください。',
      'Signing in…': 'サインイン中…',
      'Sign in failed:': 'サインインに失敗：',
      'Sign in failed.': 'サインインに失敗しました。',
      'That doesn\u2019t look like a valid OpenSSH private key.':
        '有効なOpenSSH秘密鍵ではないようです。',
      'online': 'オンライン', 'offline': 'オフライン', 'paused': '一時停止',
      'no credits': 'クレジットなし', 'lease': 'リース', 'listed': '出品中',
      'private': '非公開', 'validated': '検証済み', 'none': 'なし', 'never': 'なし',
      'expired': '期限切れ', 'open': '開く', 'passcode': 'パスコード', 'spent': '使用',
      'avg': '平均', 'cr/min': 'ACR/分', 'cr': 'ACR', 'ACR/min': 'ACR/分', 'ACR': 'ACR', 'tunnel offline': 'トンネルオフライン',
      'Type': '種別', 'Item': '項目', 'Details': '詳細', 'Charged': '課金',
      'Listed': '出品', 'Earned': '獲得', 'Rate': 'レート', 'Actions': '操作',
      'List': '出品', 'List?': '出品？', 'Remove listing': '出品を削除',
      'Cannot remove while a lease is active': 'リースが有効な間は削除できません',
      'Disconnect this tunnel': 'このトンネルを切断',
      'Pause public access without disconnecting': '切断せずに公開アクセスを一時停止',
      'Resume public access': '公開アクセスを再開',
      'This tunnel has an active marketplace listing — remove the listing first':
        'このトンネルには有効な出品があります — 先に出品を削除してください',
      'Lease': 'リース', 'This connection is offline': 'この接続はオフラインです',
      // ---- Landing page ----
      'A people-powered cloud, built from the': '人が動かすクラウド、',
      'devices you already own': 'あなたが既に持っているデバイス',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb は余ったノートPC、古いスマホ、遊んでいるホームサーバを小さな公開エンドポイントに変えます。数秒でアプリをデモし、どこからでも自宅PCにアクセスし、分単位でマイクロサーバを借りる ——その間、自分のデバイスが負荷を分担してクレジットを稼ぎます。',
      'get your key →': 'キーを取得 →',
      'or restore from existing key': 'または既存のキーから復元',
      'pay only for traffic': 'トラフィック分だけ支払い',
      'no install · just ssh': 'インストール不要 · ssh だけ',
      'open source · greener by default': 'オープンソース · デフォルトでより環境に優しい',
      'What you can do today': '今日できること',
      'Make spare devices useful': '余ったデバイスを役立てる',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        '引き出しの古い MacBook や棚の Raspberry Pi が、静かに本物のトラフィックを捌けます。電源を入れて',
      'command, and it joins the network as a working node.': 'コマンドを 1 つ実行すれば、ネットワークに稼働ノードとして加わります。',
      'Demo your app in 30 seconds': '30 秒でアプリをデモ',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        'ローカルサーバを立てて、トンネルを開き、公開 URL を会議チャットに貼り付け。デプロイも Dockerfile も CI も不要 —— 既に動いているコードを',
      'Reach your home computer anywhere': 'どこからでも自宅 PC にアクセス',
      'Claim a permanent': '自宅マシン用に永続的な',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        'を取得しましょう。ファイル、ダッシュボード、ゲームサーバ、デスクトップへの SSH —— 地球の反対側のスマホからでも到達できます。',
      'Lease a micro-server by the minute': '分単位でマイクロサーバを借りる',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        'Webhook テスト、ワークショップ、週末プロジェクトのために公開エンドポイントが必要?自分でホストして稼いだクレジットで、他人のトンネルを数分間借りられます。月額請求なし。',
      'Quick start': 'クイックスタート',
      'Grab your key from the': '鍵は',
      'and run one command — your local port is public.': 'から取得し、コマンドを 1 つ実行するだけ — ローカルポートが公開されます。',
      'Change': '変更:',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': 'をアプリがリッスンするポートに変更してください。生の TCP（データベース、SSH、ゲームサーバー）の場合は、',
      'You only need the': '必要なのは',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        'コマンドだけ(macOS、Linux、最新の Windows に同梱)。クライアントもアカウント登録フォームも不要。',
      'Get your key': 'キーを取得',
      'Open the': '',
      'dashboard': 'ダッシュボード',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        'を開きましょう ——ブラウザ内で Ed25519 SSH キーを生成し、短いアカウント ID (',
      '), and downloads the private key file': ') を導出し、秘密鍵ファイル',
      '. Welcome bonus:': 'をダウンロードします。ようこそボーナス:',
      'credits.': 'クレジット。',
      'Start something locally': 'ローカルで何かを起動',
      'Open a tunnel': 'トンネルを開く',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        'SSH のユーザー名がそのまま公開サブドメインになります。ダッシュボードで永続ハンドルを取得し、誰にも奪われないようにしましょう。',
      'Share the URL': 'URL を共有',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        '同僚、顧客、自分のスマホにリンクを送りましょう。SSH セッションが開いている限りトンネルは生き続け ——その間ずっとクレジットを稼ぎます。',
      'Raw TCP works too': 'Raw TCP も使えます',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        'データベース、SSH、ゲームサーバ、MQTT —— HTTP 以外なんでも。サーバが公開ポートを割り当てて返します。',
      'Pay only for the traffic you use': '使った分のトラフィックだけ支払い',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        'サブスクなし。「無料枠」の崖もなし。トンネルを開くのは無料 ——実際に流れたバイトだけクレジットで請求され、使わなかったものを切断した瞬間にクレジットは返金されます。',
      'Metered by the byte': 'バイト単位で計測',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        'アイドルなトンネルは無料。数ページの軽いデモは数クレジット。重いワークロードは実消費帯域に比例して支払います。',
      'Earn while you host': 'ホストして稼ぐ',
      'Every minute your own device serves traffic, you earn': '自分のデバイスがトラフィックを捌くたびに、毎分',
      'in uptime rewards, plus': 'のアップタイム報酬、さらに',
      'when someone leases your tunnel from the marketplace.': '、マーケットで誰かがあなたのトンネルを借りた時。',
      'Earn, learn, and build with the community': 'コミュニティで稼ぎ、学び、作る',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb はシンプルなループに基づいています:余ったデバイスを差し、そのアップタイムを共有し、クレジットを稼ぎ、必要なものに使う。途中で本物のネットワーキング、SSH、分散システムのスキルが身につく ——同じことをする他の人たちと一緒に。',
      'Open marketplace': 'オープンなマーケット',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        '余ったデバイスのトンネルを出品して分単価を設定すれば、リースが入ってきます。他人の提供を見て、必要な地域やハードウェアを借りましょう。',
      'Learn by hosting': 'ホストして学ぶ',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        '本物のリバース SSH、本物の TCP、本物の計量。リポジトリはオープンソース ——読んで、フォークして、学校ではあまり扱われないインフラの知識を AirWeb で自分に教えましょう。',
      'The long view: a micro-server socio-economy': '長期的視点:マイクロサーバの社会経済',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        '世界には完全に使える状態で遊んでいるハードウェアが溢れています ——10 億台のスマホ、1 億台のノート PC、「旧式」サーバのラック。それらは今日無駄になっている CPU、メモリ、帯域を持っています。AirWeb はそのすべてを静かに有用化する最初の一歩 —— 既にそれを買った人々の手に残り、透明な P2P で取引されます。',
      'Open-source cloud provider': 'オープンソースのクラウドプロバイダ',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        'ハイパースケーラ級の機能を、3 つのロゴとクレジットカード入力フォームの向こうに置く必要はありません。私たちの長期目標は、「データセンター」が家庭・オフィス・コミュニティ空間の連合になる、オープンでフェデレートされたクラウドです。',
      'A micro-server economy': 'マイクロサーバ経済',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        '容量を提供して得たクレジットで、他人の容量を買えます。時を経て、そのループは本物の経済になります ——小さな運営者、学生、愛好家がただの顧客ではなく、一級の参加者である経済に。',
      'Greener by default': 'デフォルトでより環境に優しい',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        '最も持続可能なサーバは既に存在するものです。本来なら遊んでいる ——あるいは埋立地行きの ——デバイスに第二の命を与えることで、毎分数リクエスト程度のために新しい常時稼働ハードウェアの群れを立ち上げる必要が減ります。群れが小さくなり、含有炭素が減り、電子ゴミが減り、電力網の負担も減ります。',
      'Reuses hardware you already own instead of provisioning new servers.':
        '新しいサーバを用意するのではなく、既に持っているハードウェアを再利用します。',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        'アイドルなトンネルは実質ゼロ消費 ——SSH ソケットを 1 つ占有するだけです。',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        '常時稼働の余剰ファームなし:容量はデバイスが差し込まれた時に現れ、外れれば消えます。',
      'FAQ': 'FAQ',
      'What kind of "spare device" actually works?': 'どんな「余ったデバイス」が実際に使えますか?',
      'Anything that can run an': '',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        'クライアントを実行してオンラインを保てるものなら何でも:古いノート PC、ほとんど使っていないデスクトップ、Raspberry Pi、NAS、ミニ PC、一部のルータも。SSH セッションを開いておけるなら、AirWeb ノードになれます。',
      'Do I need to install anything?': '何かインストールが必要ですか?',
      'No. Any standard': 'いいえ。標準的な',
      'client works once you\'ve downloaded': 'クライアントなら、',
      '. There is an optional Node CLI (': ' をダウンロードすれば動きます。オプションで Node CLI (',
      ') that wraps': ') があり、',
      'with friendlier flags if you want one.': ' をより親切なフラグで包んでくれます。',
      'How exactly am I charged?': '具体的にどう課金されますか?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        'リースされたトンネルを実際に流れた公開トラフィックのバイト数で計測されます。アイドルなエンドポイントは無料。ダッシュボードはクレジットと推定 USD 値の両方で収益と料金をリアルタイム表示します。',
      'How do I sign in from another device?': '別のデバイスからどうやってサインインしますか?',
      'Open': '',
      'and paste your private key. We never store private keys server-side — your':
        'を開いて秘密鍵を貼り付けてください。私たちは秘密鍵をサーバに保存しません ——あなたの',
      'account id is derived deterministically from the public key.':
        'アカウント ID は公開鍵から決定論的に導出されます。',
      'Is the traffic encrypted?': 'トラフィックは暗号化されますか?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        'デバイスと AirWeb の間は SSH で暗号化されます。公開側は入口の話す言語次第(素ポートでは HTTP、TLS リバースプロキシ越しでは HTTPS)。エンドツーエンド TLS が必要ならローカルアプリ内で終端し、Raw TCP トンネルを使ってください。',
      'Can I pick my own subdomain?': '自分のサブドメインを選べますか?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        'はい ——接続時に使った SSH ユーザー名がサブドメインになります (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        ')。ダッシュボードでクレジットを使って、誰にも奪われない永続ハンドルを取得しましょう。',
      'How do I stop a tunnel?': 'トンネルを止めるには?',
      'Press': 'SSH セッションで',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        'を押すか、ターミナルを閉じてください。トンネルはアクティブリストから即座に消え、それ以上料金はかかりません。',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · セルフホスト型リバース ssh トンネル ·',
      'source': 'ソース'
    },
    ko: {
      'AirWeb': 'AirWeb',
      'Dashboard': '대시보드',
      'Marketplace': '마켓플레이스',
      'My account': '내 계정',
      'Account': '계정',
      'Theme': '테마',
      'Dark': '다크',
      'Light': '라이트',
      'System': '시스템',
      'Language': '언어',
      'Currency': '통화',
      'Sign in': '로그인',
      'Sign out': '로그아웃',
      'Sign in with key': '키로 로그인',
      'Copy': '복사',
      'Copy account ID': '계정 ID 복사',
      'Toggle overview': '개요 표시 전환',
      'Get started in 10 seconds': '10초 안에 시작하기',
      "We'll generate an Ed25519 SSH key in your browser, hand you the private key file once, and derive your short account ID from it. You'll receive a":
        '브라우저에서 Ed25519 SSH 키를 생성하고, 개인 키 파일을 한 번만 다운로드해 드리며, 그로부터 짧은 계정 ID를 도출합니다. 당신은',
      'credit signup bonus.': '크레딧의 가입 보너스를 받을 수 있습니다.',
      'Create account': '계정 만들기',
      'Overview': '개요',
      'Transactions': '거래',
      'Admin': '관리',
      'Tunnels': '터널',
      'Leases': '리스',
      'Reward / min': '보상 / 분',
      'Charge / min': '요금 / 분',
      'Earning / min': '수익 / 분',
      'est.': '예상',
      'Number of your SSH tunnels currently online and reachable.':
        '현재 온라인이며 접근 가능한 당신의 SSH 터널 수.',
      "Active marketplace leases you have purchased on others' tunnels.":
        '다른 사용자의 터널에서 구매한 활성 마켓플레이스 리스.',
      'Average credits earned per minute from tunnel uptime over the last 24 hours. Falls back to the configured rate × online tunnels when no history exists yet.':
        '최근 24시간 동안 터널 가동으로 분당 획득한 평균 크레딧. 이력이 없으면 설정된 레이트 × 온라인 터널 수를 사용.',
      'Average credits charged per minute for bandwidth consumed by your active leases over the last 24 hours.':
        '최근 24시간 동안 활성 리스가 소비한 대역폭에 대해 분당 청구된 평균 크레딧.',
      'Net credit flow per minute: Reward minus Charge. Positive means you are earning, negative means you are consuming more than you earn.':
        '분당 순 크레딧 흐름: 보상에서 요금을 차감. 양수는 수익, 음수는 수익보다 소비가 더 많음을 의미합니다.',
      'My Connections': '내 연결',
      '+ Connection': '+ 연결',
      'Search connections…': '연결 검색…',
      'All': '전체',
      'Listings': '리스팅',
      'Filter nodes': '노드 필터',
      'Protocol': '프로토콜',
      'Any': '모두',
      'Search title/desc': '제목/설명 검색',
      'keyword': '키워드',
      'Country': '국가',
      'Min cores': '최소 코어 수',
      'Min RAM (GB)': '최소 RAM (GB)',
      'Max price (cr/min)': '최대 가격 (ACR/분)',
      'OS contains': 'OS 포함',
      'linux, debian…': 'linux, debian…',
      'Apply': '적용',
      'Clear': '지우기',
      'Reset': '초기화',
      'Search title or description…': '제목 또는 설명 검색…',
      'All listings': '모든 리스팅',
      'Recent credit activity': '최근 크레딧 활동',
      'Clear filters': '필터 지우기',
      'Reason': '사유',
      'Ref': '참조',
      'Delta': '증감',
      'When': '시간',
      'filter…': '필터…',
      'all': '전체',
      '+ only': '+ 만',
      '− only': '− 만',
      'Load 20 more': '20개 더 보기',
      'role': '역할',
      'Refresh': '새로고침',
      'All live tunnels': '모든 실시간 터널',
      'All accounts': '모든 계정',
      'Resume': '재개',
      'Pause': '일시정지',
      'Disconnect': '연결 끊기',
      'Demote': '강등',
      'Promote': '승격',
      '⚠ Read this before you continue': '⚠ 계속하기 전에 읽어주세요',
      'You are about to:': '다음 작업을 수행합니다:',
      'Generate': '생성',
      'a brand-new Ed25519 SSH keypair on the server.': '서버에서 새 Ed25519 SSH 키 쌍.',
      'Download': '다운로드',
      'the private key file (': '개인 키 파일 (',
      ') to this device —': ') 을 이 장치로 —',
      'immediately and automatically': '즉시 자동으로',
      'to the account derived from that key.': '그 키에서 파생된 계정으로.',
      'The private key is the only way to access your account. We do not store it. If your browser blocks the download, or you lose the file, your account and credits are gone forever — there is no recovery.':
        '개인 키는 계정에 접근하는 유일한 수단입니다. 당사는 저장하지 않습니다. 브라우저가 다운로드를 차단하거나 파일을 잃으면 계정과 크레딧이 영원히 사라지며 복구할 수 없습니다.',
      'only': '유일한',
      'not': '아니오',
      'Make sure your browser is allowed to download files from this site before continuing. All three steps happen in a single click and cannot be undone or separated.':
        '계속하기 전에 브라우저가 이 사이트에서 파일을 다운로드할 수 있는지 확인하세요. 세 단계는 한 번의 클릭으로 실행되며 취소하거나 분리할 수 없습니다.',
      'I understand: if I lose this download, I lose my account.':
        '이해합니다: 이 다운로드를 잃으면 계정을 잃습니다.',
      'Cancel': '취소',
      'Generate, download & sign in': '생성·다운로드·로그인',
      "✅ You're signed in — your key has been downloaded":
        '✅ 로그인됨 — 키가 다운로드되었습니다',
      'Downloads': '다운로드',
      "Keep it safe — it's the only way back into this account.":
        '안전하게 보관하세요 — 이 계정으로 돌아올 유일한 방법입니다.',
      'Account ID:': '계정 ID:',
      "If the download didn't start (browser blocked it, etc.), use the buttons below right now:":
        '다운로드가 시작되지 않았다면(브라우저 차단 등) 아래 버튼을 지금 사용하세요:',
      'Re-download key file': '키 파일 다시 다운로드',
      'Linux/macOS:': 'Linux/macOS:',
      'after downloading, run': '다운로드 후 실행:',
      'Then connect:': '그 다음 연결:',
      'Continue to dashboard': '대시보드로 계속',
      'List this tunnel on the marketplace': '이 터널을 마켓플레이스에 등록',
      'Tunnel:': '터널:',
      'The server will SSH into this endpoint with the sudo credentials you provide. The connection must succeed before the listing is published. Your password is not stored.':
        '서버는 제공된 sudo 자격 증명으로 이 엔드포인트에 SSH 접속합니다. 등록 전에 연결이 성공해야 합니다. 비밀번호는 저장되지 않습니다.',
      'Web leases are private: each renter receives a unique passcode that must be entered to access the site. The passcode expires automatically at the end of the lease term.':
        '웹 리스는 비공개입니다: 각 임차인은 사이트 접근을 위해 입력해야 하는 고유한 패스코드를 받습니다. 패스코드는 리스 만료 시 자동으로 만료됩니다.',
      'Title *': '제목 *',
      'Beefy home server': '고성능 홈 서버',
      'Price (credits / min) *': '가격 (크레딧 / 분) *',
      'Lease term (minutes) *': '리스 기간 (분) *',
      'Description': '설명',
      'Optional': '선택 사항',
      'Bandwidth (Mbps)': '대역폭 (Mbps)',
      'optional': '선택 사항',
      'Sudo username *': 'Sudo 사용자명 *',
      'Sudo password *': 'Sudo 비밀번호 *',
      "CPU, RAM, disk and OS are auto-detected over SSH after your credentials validate — you don't need to enter them.":
        '자격 증명 검증 후 CPU, RAM, 디스크, OS는 SSH를 통해 자동으로 감지됩니다 — 입력할 필요가 없습니다.',
      'Validate & list': '검증 후 등록',
      'Connect a tunnel': '터널 연결',
      'Pick what you want to expose. Run the generated command on the source machine and keep the SSH window open — closing it ends the tunnel.':
        '노출할 항목을 선택하세요. 원본 머신에서 생성된 명령을 실행하고 SSH 창을 열어 둡니다 — 닫으면 터널이 종료됩니다.',
      'Public endpoint': '공개 엔드포인트',
      'Subdomain': '서브도메인',
      'Local port': '로컬 포트',
      'New tunnels start paused — click Resume in My Connections to start serving traffic.':
        '새 터널은 일시정지 상태로 시작됩니다 — 「내 연결」에서 「재개」를 클릭하여 트래픽 제공을 시작합니다.',
      'Run this command': '이 명령 실행',
      'Got it': '알겠습니다',
      'This tunnel is not listable': '이 터널은 등록할 수 없습니다',
      "Only TCP tunnels exposing SSH (port 22) can be listed on the marketplace — buyers need to log into the box, so an HTTP forward isn't enough.":
        'SSH(포트 22)를 노출하는 TCP 터널만 마켓플레이스에 등록할 수 있습니다 — 구매자가 마신에 로그인해야 하므로 HTTP 포워드만으로는 충분하지 않습니다.',
      'Reconnect using the command below. Pick any free mysub name (or use one of your handles):':
        '아래 명령으로 재연결하세요. 사용 가능한 mysub 이름(또는 본인의 핸들)을 선택하세요:',
      'After it connects, the new tunnel will show up in My activity with kind tcp. Click Resume on it, then List for lease.':
        '연결 후 새 터널이 「내 활동」에 tcp 종류로 표시됩니다. 「재개」를 클릭한 다음 「리스 등록」을 클릭하세요.',
      'Sign in with your AirWeb key': 'AirWeb 키로 로그인',
      'Paste your': '당신의',
      'file (the OpenSSH private key you downloaded at registration). We re-derive your account ID from it locally on the server and start a session — the key is not stored.':
        '파일(등록 시 다운로드한 OpenSSH 개인 키)을 붙여넣으세요. 서버에서 로컬로 계정 ID를 다시 도출하고 세션을 시작합니다 — 키는 저장되지 않습니다.',
      'Private key (OpenSSH format)': '개인 키 (OpenSSH 형식)',
      '…or upload it': '…또는 업로드',
      'Passphrase (if your key has one)': '암호문구 (키에 설정된 경우)',
      "Don't have a key?": '키가 없으신가요?',
      'Register here': '여기서 등록',
      'Paste or upload your private key.': '개인 키를 붙여넣거나 업로드하세요.',
      'Signing in…': '로그인 중…',
      'Sign in failed:': '로그인 실패:',
      'Sign in failed.': '로그인에 실패했습니다.',
      'That doesn’t look like a valid OpenSSH private key.':
        '유효한 OpenSSH 개인 키가 아닌 것 같습니다.',
      'online': '온라인', 'offline': '오프라인', 'paused': '일시정지',
      'no credits': '크레딧 없음', 'lease': '리스', 'listed': '등록됨',
      'private': '비공개', 'validated': '검증됨', 'none': '없음', 'never': '없음',
      'expired': '만료됨', 'open': '열기', 'passcode': '패스코드', 'spent': '사용',
      'avg': '평균', 'cr/min': 'ACR/분', 'cr': 'ACR', 'ACR/min': 'ACR/분', 'ACR': 'ACR', 'tunnel offline': '터널 오프라인',
      'Type': '종류', 'Item': '항목', 'Details': '세부', 'Charged': '청구',
      'Listed': '등록', 'Earned': '획득', 'Rate': '레이트', 'Actions': '작업',
      'List': '등록', 'List?': '등록?', 'Remove listing': '등록 제거',
      'Cannot remove while a lease is active': '리스가 활성인 동안에는 제거할 수 없습니다',
      'Disconnect this tunnel': '이 터널 끊기',
      'Pause public access without disconnecting': '연결을 끊지 않고 공개 접근 일시정지',
      'Resume public access': '공개 접근 재개',
      'This tunnel has an active marketplace listing — remove the listing first':
        '이 터널에는 활성 마켓플레이스 등록이 있습니다 — 먼저 등록을 제거하세요',
      'Lease': '리스', 'This connection is offline': '이 연결은 오프라인입니다',
      // ---- Landing page ----
      'A people-powered cloud, built from the': '사람이 만드는 클라우드,',
      'devices you already own': '이미 가진 디바이스로',
      'AirWeb turns spare laptops, old phones, and idle home servers into tiny public endpoints. Demo an app in seconds, reach your home computer from anywhere, or lease a micro-server by the minute — and earn credits while your own devices help carry the load.':
        'AirWeb는 안 쓰는 노트북, 오래된 휴대폰, 놀고 있는 홈 서버를 작은 공개 엔드포인트로 바꿉니다. 몇 초 만에 앱을 시연하고, 어디서든 집 컴퓨터에 접속하고, 분 단위로 마이크로 서버를 임대하세요 —— 당신의 기기가 부하를 분담하는 동안 크레딧을 얻습니다.',
      'get your key →': '키 받기 →',
      'or restore from existing key': '또는 기존 키로 복원',
      'pay only for traffic': '트래픽만큼만 결제',
      'no install · just ssh': '설치 불필요 · ssh만 있으면 됨',
      'open source · greener by default': '오픈 소스 · 기본적으로 더 친환경적',
      'What you can do today': '오늘 할 수 있는 일',
      'Make spare devices useful': '안 쓰는 기기를 유용하게',
      'That old MacBook in a drawer or the Raspberry Pi on your shelf can quietly serve real traffic. Plug it in, run one':
        '서랍 속 오래된 MacBook이나 선반 위 Raspberry Pi가 조용히 실제 트래픽을 처리할 수 있습니다. 전원을 켜고',
      'command, and it joins the network as a working node.': '명령어 하나만 실행하면 동작 중인 노드로 네트워크에 합류합니다.',
      'Demo your app in 30 seconds': '30초 만에 앱 시연',
      'Spin up a local server, open a tunnel, paste the public URL into a meeting chat. No deploys, no Dockerfiles, no CI — just the code you already have running on':
        '로컬 서버를 띄우고, 터널을 열고, 공개 URL을 회의 채팅에 붙여넣으세요. 배포도, Dockerfile도, CI도 필요 없습니다 —— 이미 돌아가고 있는 코드,',
      'Reach your home computer anywhere': '어디서든 집 컴퓨터에 접속',
      'Claim a permanent': '집 컴퓨터용 영구',
      'for your home box. Files, dashboards, game servers, SSH-into-your-desktop — all reachable from a phone on the other side of the world.':
        '를 받으세요. 파일, 대시보드, 게임 서버, 데스크톱 SSH —— 지구 반대편의 휴대폰에서도 모두 접근 가능합니다.',
      'Lease a micro-server by the minute': '분 단위로 마이크로 서버 임대',
      'Need a public endpoint for a webhook test, a workshop, or a weekend project? Rent someone else\'s tunnel for a few minutes with the credits you earned hosting yours. No monthly bills.':
        '웹훅 테스트, 워크숍, 주말 프로젝트를 위한 공개 엔드포인트가 필요한가요? 직접 호스팅해 얻은 크레딧으로 다른 사람의 터널을 몇 분간 빌리세요. 월정액 청구서 없음.',
      'Quick start': '빠른 시작',
      'Grab your key from the': '키는',
      'and run one command — your local port is public.': '에서 받고 명령 한 줄만 실행하면 — 로컬 포트가 공개됩니다.',
      'Change': '변경:',
      'to whatever port your app listens on. For raw TCP (databases, SSH, game servers), use': '을 앱이 수신하는 포트로 변경하세요. 순수 TCP(데이터베이스, SSH, 게임 서버)의 경우 다음을 사용하세요:',
      'You only need the': '필요한 건',
      'command (built into macOS, Linux, and modern Windows). No client, no account form to fill in.':
        '명령어뿐(macOS, Linux, 최신 Windows에 기본 내장). 클라이언트도, 계정 가입 양식도 없습니다.',
      'Get your key': '키 받기',
      'Open the': '',
      'dashboard': '대시보드',
      '— it generates an Ed25519 SSH key in your browser, derives your short account id (':
        '를 여세요 —— 브라우저 안에서 Ed25519 SSH 키를 생성하고, 짧은 계정 ID(',
      '), and downloads the private key file': ')를 도출하고, 개인 키 파일',
      '. Welcome bonus:': '을 다운로드합니다. 가입 보너스:',
      'credits.': '크레딧.',
      'Start something locally': '로컬에서 무엇이든 실행',
      'Open a tunnel': '터널 열기',
      'Your SSH username becomes your public subdomain. Claim a permanent handle in the dashboard so nobody else can take it.':
        'SSH 사용자명이 그대로 공개 서브도메인이 됩니다. 대시보드에서 영구 핸들을 등록해 다른 사람이 가져가지 못하게 하세요.',
      'Share the URL': 'URL 공유',
      'Send the link to a teammate, a client, or your phone. The tunnel stays up as long as the SSH session is open — and you earn credits the whole time.':
        '동료, 고객, 또는 자신의 휴대폰에 링크를 보내세요. SSH 세션이 열려 있는 동안 터널은 유지되고 —— 그 동안 계속 크레딧을 얻습니다.',
      'Raw TCP works too': 'Raw TCP도 지원',
      'Databases, SSH, game servers, MQTT — anything that isn\'t HTTP. The server allocates a public port and prints it back.':
        '데이터베이스, SSH, 게임 서버, MQTT —— HTTP가 아닌 것이라면 무엇이든. 서버가 공개 포트를 할당해 돌려줍니다.',
      'Pay only for the traffic you use': '사용한 트래픽만큼만 결제',
      'No subscriptions. No "free tier" cliffs. Opening a tunnel is free — you\'re billed in credits only for the bytes that actually flow through it, and credits are refunded the moment you disconnect anything you didn\'t use.':
        '구독 없음. "무료 티어" 절벽 없음. 터널 열기는 무료 —— 실제로 흐른 바이트에 대해서만 크레딧으로 청구되며, 사용하지 않은 것은 끊는 즉시 크레딧이 환불됩니다.',
      'Metered by the byte': '바이트 단위 계량',
      'Idle tunnels cost nothing. A quick demo with a few page loads costs a few credits. A heavy workload pays in proportion to the bandwidth it actually consumes.':
        '유휴 터널은 무료. 페이지 몇 번 로드하는 빠른 시연은 몇 크레딧. 무거운 워크로드는 실제 소비된 대역폭에 비례해 청구됩니다.',
      'Earn while you host': '호스팅하며 수익',
      'Every minute your own device serves traffic, you earn': '본인 기기가 트래픽을 처리할 때마다 분당',
      'in uptime rewards, plus': '의 가동 시간 보상, 그리고',
      'when someone leases your tunnel from the marketplace.': ', 누군가 마켓플레이스에서 당신의 터널을 임대할 때.',
      'Earn, learn, and build with the community': '커뮤니티와 함께 벌고, 배우고, 만들기',
      'AirWeb is built around a simple loop: plug in a spare device, share its uptime, earn credits, spend them on things you need. Along the way you pick up real networking, SSH, and distributed-systems skills — and you do it next to other people doing the same.':
        'AirWeb는 단순한 순환을 기반으로 합니다: 안 쓰는 기기를 연결하고, 가동 시간을 공유하고, 크레딧을 벌어, 필요한 것에 쓰세요. 그 과정에서 실제 네트워킹, SSH, 분산 시스템 기술을 익히게 됩니다 —— 같은 일을 하는 다른 사람들과 함께.',
      'Open marketplace': '오픈 마켓플레이스',
      'List your spare-device tunnel, set a price per minute, and watch the leases come in. Browse what others are offering and rent the right region or hardware for the job.':
        '안 쓰는 기기의 터널을 등록하고, 분당 가격을 설정한 뒤 임대가 들어오는 걸 지켜보세요. 다른 사람이 제공하는 것을 둘러보고 작업에 맞는 지역이나 하드웨어를 빌리세요.',
      'Learn by hosting': '호스팅하며 배우기',
      'Real reverse SSH, real TCP, real metering. The repo is open source — read it, fork it, and use AirWeb to teach yourself the bits of infrastructure that schools rarely cover.':
        '진짜 리버스 SSH, 진짜 TCP, 진짜 과금. 저장소는 오픈 소스 —— 읽고, 포크하고, 학교에서 거의 다루지 않는 인프라 지식을 AirWeb로 스스로 익히세요.',
      'The long view: a micro-server socio-economy': '장기적 시각: 마이크로 서버 사회경제',
      'The world is full of perfectly good hardware sitting idle — a billion phones, a hundred million laptops, racks of "obsolete" servers. They have CPU, memory, and bandwidth that today goes to waste. AirWeb is the first step toward letting all of that quietly become useful, owned by the people who already paid for it, traded in a transparent, peer-to-peer way.':
        '세상은 멀쩡한데도 놀고 있는 하드웨어로 가득합니다 —— 10억 대의 휴대폰, 1억 대의 노트북, "구식"이라 불리는 서버 랙들. 오늘 낭비되고 있는 CPU, 메모리, 대역폭을 가지고 있죠. AirWeb는 그 모두가 조용히 유용해지도록 만드는 첫걸음입니다 —— 이미 그것을 산 사람들의 손에 남고, 투명한 P2P 방식으로 거래됩니다.',
      'Open-source cloud provider': '오픈소스 클라우드 제공자',
      'Hyperscaler-class capabilities don\'t have to live behind three logos and a credit-card form. Our long-term goal is an open, federated cloud where the "data center" is a coalition of homes, offices, and community spaces.':
        '하이퍼스케일러급 기능이 꼭 세 개의 로고와 신용카드 양식 뒤에 있을 필요는 없습니다. 우리의 장기 목표는 "데이터센터"가 가정, 사무실, 커뮤니티 공간의 연합인 개방적이고 페더레이트된 클라우드입니다.',
      'A micro-server economy': '마이크로 서버 경제',
      'Credits earned by contributing capacity buy capacity from others. Over time, that loop becomes a real economy — one where small operators, students, and hobbyists are first-class participants, not just customers.':
        '용량을 기여해 얻은 크레딧으로 다른 사람의 용량을 살 수 있습니다. 시간이 지나면 그 순환은 진짜 경제가 됩니다 —— 작은 운영자, 학생, 취미인들이 단순한 고객이 아닌 1등 참가자인 경제로.',
      'Greener by default': '기본적으로 더 친환경적',
      'The most sustainable server is one that already exists. By giving a second life to devices that would otherwise be sitting idle — or worse, in a landfill — AirWeb reduces the need to spin up new fleets of always-on hardware just to serve a few requests per minute. Smaller fleet, less embodied carbon, less e-waste, less drain on the grid.':
        '가장 지속 가능한 서버는 이미 존재하는 서버입니다. 그렇지 않으면 놀고 있을 —— 또는 더 나쁘게는 매립지로 갈 —— 기기에 두 번째 생명을 줌으로써, AirWeb는 분당 몇 개 요청을 처리하려고 새 상시 가동 하드웨어를 띄울 필요를 줄입니다. 더 작은 함대, 더 적은 내재 탄소, 더 적은 전자 폐기물, 더 적은 전력망 부담.',
      'Reuses hardware you already own instead of provisioning new servers.':
        '새 서버를 마련하는 대신 이미 가지고 있는 하드웨어를 재사용합니다.',
      'Idle tunnels consume effectively nothing — they just sit on an SSH socket.':
        '유휴 터널은 사실상 아무것도 소비하지 않습니다 —— 그저 SSH 소켓 하나만 점유합니다.',
      'No always-on overhead farms: capacity appears when devices are plugged in and disappears when they\'re not.':
        '상시 가동 잉여 농장 없음: 용량은 기기가 연결될 때 나타나고 빠지면 사라집니다.',
      'FAQ': '자주 묻는 질문',
      'What kind of "spare device" actually works?': '어떤 종류의 "안 쓰는 기기"가 실제로 동작하나요?',
      'Anything that can run an': '',
      'client and stay online: an old laptop, a desktop you barely use, a Raspberry Pi, a NAS, a mini-PC, even some routers. If it can hold an SSH session open, it can be an AirWeb node.':
        '클라이언트를 실행하고 온라인을 유지할 수 있는 것이라면 무엇이든: 오래된 노트북, 거의 쓰지 않는 데스크톱, Raspberry Pi, NAS, 미니 PC, 일부 라우터까지. SSH 세션을 열어둘 수 있다면 AirWeb 노드가 될 수 있습니다.',
      'Do I need to install anything?': '무엇이든 설치해야 하나요?',
      'No. Any standard': '아니요. 표준',
      'client works once you\'ve downloaded': '클라이언트면 충분합니다 ——',
      '. There is an optional Node CLI (': '을 다운로드한 후. 선택적으로 Node CLI (',
      ') that wraps': ')도 있어,',
      'with friendlier flags if you want one.': '을 더 친절한 플래그로 감싸줍니다.',
      'How exactly am I charged?': '정확히 어떻게 과금되나요?',
      'You\'re metered by the bytes of public traffic that actually flow through your leased tunnels. Idle endpoints cost nothing. The dashboard shows live earnings and charges in both credits and an estimated USD value.':
        '임대된 터널을 실제로 통과한 공개 트래픽의 바이트 수로 계량됩니다. 유휴 엔드포인트는 무료. 대시보드는 크레딧과 추정 USD 값으로 수익과 요금을 실시간 표시합니다.',
      'How do I sign in from another device?': '다른 기기에서 어떻게 로그인하나요?',
      'Open': '',
      'and paste your private key. We never store private keys server-side — your':
        '를 열고 개인 키를 붙여넣으세요. 우리는 절대 개인 키를 서버에 저장하지 않습니다 —— 당신의',
      'account id is derived deterministically from the public key.':
        '계정 ID는 공개 키에서 결정적으로 도출됩니다.',
      'Is the traffic encrypted?': '트래픽은 암호화되나요?',
      'The leg between your device and AirWeb is encrypted by SSH. The public leg uses whatever the front door speaks (HTTP on the bare port, HTTPS behind a TLS reverse proxy). For end-to-end TLS, terminate inside your local app and use a raw TCP tunnel.':
        '기기와 AirWeb 사이 구간은 SSH로 암호화됩니다. 공개 구간은 입구가 말하는 프로토콜을 사용합니다(맨 포트에서는 HTTP, TLS 리버스 프록시 뒤에서는 HTTPS). 종단 간 TLS가 필요하면 로컬 앱 내부에서 종료하고 raw TCP 터널을 사용하세요.',
      'Can I pick my own subdomain?': '내 서브도메인을 직접 고를 수 있나요?',
      'Yes — the SSH username you connect with becomes your subdomain (':
        '네 —— 접속할 때 사용한 SSH 사용자명이 그대로 서브도메인이 됩니다 (',
      '). Spend credits in the dashboard to claim a permanent handle nobody else can take.':
        '). 대시보드에서 크레딧을 써서 다른 사람이 가져가지 못할 영구 핸들을 확보하세요.',
      'How do I stop a tunnel?': '터널을 어떻게 중지하나요?',
      'Press': 'SSH 세션에서',
      'in the SSH session or close the terminal. The tunnel disappears from the active list immediately and you stop accruing any charges.':
        '를 누르거나 터미널을 닫으세요. 터널은 즉시 활성 목록에서 사라지고 더 이상 요금이 발생하지 않습니다.',
      'airweb · self-hosted reverse ssh tunneling ·': 'airweb · 셀프 호스트 리버스 ssh 터널링 ·',
      'source': '소스'
    }
  };

  // ---------------------------------------------------------------
  // Pattern-based interpolation for short dynamic phrases.
  // Each entry has a regex, a list of capture-group keys, and per-locale
  // formats where {0},{1}… are substituted from the captures.
  // ---------------------------------------------------------------
  const PATTERNS = [
    { rx: /^in (\d+)m$/, fmt: { es: 'en {0} m', fr: 'dans {0} min', de: 'in {0} min', zh: '{0} 分钟内', ja: '{0}分後', ko: '{0}분 후' } },
    { rx: /^in (\d+)h$/, fmt: { es: 'en {0} h', fr: 'dans {0} h', de: 'in {0} h', zh: '{0} 小时内', ja: '{0}時間後', ko: '{0}시간 후' } },
    { rx: /^in (\d+)h (\d+)m$/, fmt: { es: 'en {0} h {1} m', fr: 'dans {0} h {1} min', de: 'in {0} h {1} min', zh: '{0} 小时 {1} 分钟内', ja: '{0}時間{1}分後', ko: '{0}시간 {1}분 후' } },
    { rx: /^in (\d+)d$/, fmt: { es: 'en {0} d', fr: 'dans {0} j', de: 'in {0} T', zh: '{0} 天内', ja: '{0}日後', ko: '{0}일 후' } },
    { rx: /^(\d+)m ago$/, fmt: { es: 'hace {0} m', fr: 'il y a {0} min', de: 'vor {0} min', zh: '{0} 分钟前', ja: '{0}分前', ko: '{0}분 전' } },
    { rx: /^(\d+)h ago$/, fmt: { es: 'hace {0} h', fr: 'il y a {0} h', de: 'vor {0} h', zh: '{0} 小时前', ja: '{0}時間前', ko: '{0}시간 전' } },
    { rx: /^(\d+)d ago$/, fmt: { es: 'hace {0} d', fr: 'il y a {0} j', de: 'vor {0} T', zh: '{0} 天前', ja: '{0}日前', ko: '{0}일 전' } },
    { rx: /^just now$/, fmt: { es: 'ahora mismo', fr: 'à l\'instant', de: 'gerade eben', zh: '刚刚', ja: 'たった今', ko: '방금' } },
    { rx: /^expires (.+)$/, fmt: { es: 'expira {0}', fr: 'expire {0}', de: 'läuft ab {0}', zh: '到期 {0}', ja: '失効 {0}', ko: '만료 {0}' } },
    { rx: /^spent (.+) ACR$/, fmt: { es: 'gastado {0} ACR', fr: 'dépensé {0} ACR', de: 'ausgegeben {0} ACR', zh: '已花费 {0} ACR', ja: '使用 {0} ACR', ko: '사용 {0} ACR' } },
    { rx: /^avg (.+)$/, fmt: { es: 'prom. {0}', fr: 'moy. {0}', de: 'Ø {0}', zh: '平均 {0}', ja: '平均 {0}', ko: '평균 {0}' } },
    { rx: /^(\d+) active$/, fmt: { es: '{0} activo(s)', fr: '{0} actif(s)', de: '{0} aktiv', zh: '{0} 个活动中', ja: 'アクティブ {0}件', ko: '활성 {0}개' } },
    // ---- Landing-page dynamic phrases ----
    { rx: /^(\d+) active tunnel right now$/, fmt: {
      es: '{0} túnel activo ahora mismo', fr: '{0} tunnel actif en ce moment', de: '{0} aktiver Tunnel gerade jetzt',
      zh: '当前活跃 {0} 个隧道', ja: '現在 {0} 件のアクティブなトンネル', ko: '지금 활성 터널 {0}개'
    } },
    { rx: /^(\d+) active tunnels right now$/, fmt: {
      es: '{0} túneles activos ahora mismo', fr: '{0} tunnels actifs en ce moment', de: '{0} aktive Tunnel gerade jetzt',
      zh: '当前活跃 {0} 个隧道', ja: '現在 {0} 件のアクティブなトンネル', ko: '지금 활성 터널 {0}개'
    } },
    { rx: /^(\d+) credit \/ min$/, fmt: {
      es: '{0} crédito / min', fr: '{0} crédit / min', de: '{0} Credit / Min',
      zh: '{0} 积分 / 分钟', ja: '{0} クレジット / 分', ko: '{0} 크레딧 / 분'
    } },
    { rx: /^(\d+)\+ credits \/ min$/, fmt: {
      es: '{0}+ créditos / min', fr: '{0}+ crédits / min', de: '{0}+ Credits / Min',
      zh: '{0}+ 积分 / 分钟', ja: '{0}+ クレジット / 分', ko: '{0}+ 크레딧 / 분'
    } },
    { rx: /^\. Welcome bonus: (\d+) credits\.$/, fmt: {
      es: '. Bono de bienvenida: {0} créditos.', fr: '. Bonus de bienvenue : {0} crédits.', de: '. Willkommensbonus: {0} Credits.',
      zh: '。欢迎奖励: {0} 积分。', ja: 'をダウンロードします。ようこそボーナス: {0} クレジット。', ko: '을 다운로드합니다. 가입 보너스: {0} 크레딧.'
    } },
    { rx: /^(\d+) HTTP tunnel currently active on this host — running on devices people already owned\.$/, fmt: {
      es: '{0} túnel HTTP activo ahora mismo en este host — corriendo en dispositivos que la gente ya tenía.',
      fr: '{0} tunnel HTTP actif actuellement sur cet hôte — fonctionnant sur des appareils que les gens possédaient déjà.',
      de: '{0} HTTP-Tunnel derzeit aktiv auf diesem Host — laufend auf Geräten, die die Leute schon hatten.',
      zh: '此主机上当前活跃 {0} 个 HTTP 隧道 —— 运行在人们早已拥有的设备上。',
      ja: 'このホストで現在 {0} 件の HTTP トンネルがアクティブ ——人々が既に持っていたデバイス上で稼働中。',
      ko: '이 호스트에서 현재 활성 HTTP 터널 {0}개 —— 사람들이 이미 소유한 기기에서 실행 중.'
    } },
    { rx: /^(\d+) HTTP tunnels currently active on this host — running on devices people already owned\.$/, fmt: {
      es: '{0} túneles HTTP activos ahora mismo en este host — corriendo en dispositivos que la gente ya tenía.',
      fr: '{0} tunnels HTTP actifs actuellement sur cet hôte — fonctionnant sur des appareils que les gens possédaient déjà.',
      de: '{0} HTTP-Tunnel derzeit aktiv auf diesem Host — laufend auf Geräten, die die Leute schon hatten.',
      zh: '此主机上当前活跃 {0} 个 HTTP 隧道 —— 运行在人们早已拥有的设备上。',
      ja: 'このホストで現在 {0} 件の HTTP トンネルがアクティブ ——人々が既に持っていたデバイス上で稼働中。',
      ko: '이 호스트에서 현재 활성 HTTP 터널 {0}개 —— 사람들이 이미 소유한 기기에서 실행 중.'
    } }
  ];

  // ---------------------------------------------------------------
  // Core helpers
  // ---------------------------------------------------------------
  let locale = DEFAULT;

  function normalize(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  function lookup(text) {
    if (!text) return null;
    const norm = normalize(text);
    if (!norm) return null;
    const table = M[locale];
    if (!table) return null;
    if (Object.prototype.hasOwnProperty.call(table, norm)) {
      const tr = table[norm];
      // preserve leading/trailing whitespace from original
      const lead = text.match(/^\s*/)[0];
      const tail = text.match(/\s*$/)[0];
      return lead + tr + tail;
    }
    // try pattern matches
    for (const p of PATTERNS) {
      const m = norm.match(p.rx);
      if (m && p.fmt[locale]) {
        let out = p.fmt[locale];
        for (let i = 1; i < m.length; i++) out = out.replace('{' + (i - 1) + '}', m[i]);
        const lead = text.match(/^\s*/)[0];
        const tail = text.match(/\s*$/)[0];
        return lead + out + tail;
      }
    }
    return null;
  }

  function t(text) {
    if (locale === 'en') return text;
    return lookup(text) || text;
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.classList && el.classList.contains('mono')) return true;
    if (el.classList && el.classList.contains('keep-en')) return true;
    if (el.hasAttribute && el.hasAttribute('data-no-i18n')) return true;
    return false;
  }

  function translateTextNode(node) {
    const orig = node.nodeValue;
    if (!orig || !orig.trim()) return;
    // remember original to allow re-translation when locale changes
    if (!node.__i18nOrig) node.__i18nOrig = orig;
    const src = node.__i18nOrig;
    if (locale === 'en') { node.nodeValue = src; return; }
    const tr = lookup(src);
    if (tr) node.nodeValue = tr;
    else node.nodeValue = src;
  }

  function translateAttr(el, attr) {
    if (!el.hasAttribute(attr)) return;
    const cacheKey = '__i18n_' + attr;
    if (el[cacheKey] == null) el[cacheKey] = el.getAttribute(attr);
    const src = el[cacheKey];
    if (locale === 'en') { el.setAttribute(attr, src); return; }
    const tr = lookup(src);
    el.setAttribute(attr, tr || src);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { // text
      const parent = root.parentNode;
      if (parent && !shouldSkipElement(parent) && !ancestorSkipped(parent)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    // Attributes (placeholder, title, aria-label) translate even on skipped tags
    // so we still get placeholders on <textarea>, titles on <code>, etc.
    if (root.hasAttribute && !root.hasAttribute('data-no-i18n') && !ancestorSkipped(root.parentNode)) {
      ATTRS.forEach(a => translateAttr(root, a));
    }
    if (shouldSkipElement(root)) return;
    // children
    let n = root.firstChild;
    while (n) {
      const next = n.nextSibling;
      walk(n);
      n = next;
    }
  }

  function ancestorSkipped(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return true;
      if (n.classList && (n.classList.contains('mono') || n.classList.contains('keep-en'))) return true;
      if (n.hasAttribute && n.hasAttribute('data-no-i18n')) return true;
      n = n.parentNode;
    }
    return false;
  }

  function applyI18n(root) {
    walk(root || document.body);
    document.documentElement.setAttribute('lang', locale);
  }

  function detectInitial() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LOCALES.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    const base = nav.split('-')[0];
    if (LOCALES.indexOf(base) >= 0) return base;
    // zh-tw / zh-hk → zh
    if (base === 'zh') return 'zh';
    return DEFAULT;
  }

  function setLocale(code) {
    if (LOCALES.indexOf(code) < 0) code = DEFAULT;
    locale = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
    applyI18n();
    updateAllPickers();
  }

  function getLocale() { return locale; }

  // ---------------------------------------------------------------
  // Language picker
  // ---------------------------------------------------------------
  function buildPicker() {
    const wrap = document.createElement('div');
    wrap.className = 'i18n-picker';
    wrap.setAttribute('data-no-i18n', '1');
    wrap.style.cssText = 'position:relative; display:inline-flex;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost i18n-picker-trigger';
    btn.setAttribute('aria-label', 'Language');
    btn.style.cssText = 'padding:.3rem .55rem; font-size:.78rem; line-height:1; min-height:0; max-width:none;';
    btn.innerHTML = '<span class="i18n-globe" aria-hidden="true" style="display:inline-block; margin-right:.3rem">🌐</span><span class="i18n-current"></span>';
    wrap.appendChild(btn);
    const menu = document.createElement('div');
    menu.className = 'i18n-picker-menu';
    menu.style.cssText = 'position:absolute; top:100%; right:0; margin-top:4px; padding:4px; min-width:140px; background:var(--panel); border:1px solid var(--line2); border-radius:var(--radius,8px); box-shadow:var(--shadow-card, 0 4px 14px rgba(0,0,0,.25)); z-index:1000; display:none;';
    LOCALES.forEach(code => {
      const opt = document.createElement('div');
      opt.setAttribute('role', 'option');
      opt.dataset.code = code;
      opt.style.cssText = 'padding:.35rem .55rem; border-radius:6px; cursor:pointer; font-size:.82rem; color:var(--fg);';
      opt.textContent = LOCALE_LABELS[code];
      opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--hover, rgba(255,255,255,.05))'; });
      opt.addEventListener('mouseleave', () => { opt.style.background = ''; });
      opt.addEventListener('click', () => {
        setLocale(code);
        updateTrigger();
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
      btn.querySelector('.i18n-current').textContent = LOCALE_LABELS[locale];
      Array.from(menu.children).forEach(c => {
        c.style.fontWeight = c.dataset.code === locale ? '600' : '400';
      });
    }
    updateTrigger();
    wrap.__update = updateTrigger;
    return wrap;
  }

  // Pickers built so far (kept in sync when locale changes from any one).
  const pickers = [];
  function updateAllPickers() {
    pickers.forEach(p => { try { p.__update(); } catch (e) {} });
  }

  function mountPicker() {
    // Mount into every recognised slot:
    //  - #i18nPickerSlot     (default — header / landing / login)
    //  - #i18nPickerSlotMenu (dashboard user-menu context)
    // Falls back to header nav / .inner / body if no slot is present.
    const slots = [
      document.getElementById('i18nPickerSlot'),
      document.getElementById('i18nPickerSlotMenu'),
    ].filter(Boolean);
    const targets = slots.length ? slots : [
      document.querySelector('header.site nav')
        || document.querySelector('header .inner')
        || document.body,
    ].filter(Boolean);
    targets.forEach(target => {
      if (target.querySelector(':scope > .i18n-picker')) return;
      const picker = buildPicker();
      target.appendChild(picker);
      pickers.push(picker);
    });
  }

  // ---------------------------------------------------------------
  // MutationObserver: translate added/changed content on the fly.
  // ---------------------------------------------------------------
  let pending = null;
  let pendingRoots = new Set();
  function schedule(root) {
    if (root) pendingRoots.add(root);
    if (pending) return;
    pending = (window.requestAnimationFrame || window.setTimeout)(() => {
      pending = null;
      const roots = Array.from(pendingRoots);
      pendingRoots.clear();
      roots.forEach(r => walk(r));
      document.documentElement.setAttribute('lang', locale);
    }, 0);
  }

  function startObserver() {
    if (!window.MutationObserver) return;
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          schedule(m.target);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach(n => schedule(n));
        } else if (m.type === 'attributes') {
          schedule(m.target);
        }
      }
    });
    mo.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  // ---------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------
  locale = detectInitial();

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else fn();
  }

  ready(function () {
    applyI18n();
    mountPicker();
    startObserver();
  });

  // expose
  window.i18n = { t: t, setLocale: setLocale, getLocale: getLocale, apply: applyI18n, LOCALES: LOCALES, LABELS: LOCALE_LABELS };
})();
