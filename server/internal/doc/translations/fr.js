// French (fr) translations for AirWeb docs.
module.exports = {
  'getting-started.label': 'Pour commencer',
  'tunneling.label':       'Tunnels',
  'platform.label':        'Plateforme',
  'reference.label':       'Référence',

  // ---------- introduction ----------
  'introduction.title': 'Introduction à AirWeb',
  'introduction.description':
    'AirWeb transforme une seule commande SSH en URL HTTPS publique. ' +
    'Découvrez ce qu\'est AirWeb, comment fonctionnent les tunnels SSH ' +
    'inversés et pourquoi c\'est la manière la plus rapide de partager un ' +
    'service localhost avec le monde.',
  'introduction.html': `
<h1>Qu'est-ce qu'AirWeb ?</h1>
<p class="lead">AirWeb est un service de tunneling inverse qui vous permet
d'exposer n'importe quel service tournant sur votre portable ou dans un
réseau privé à l'internet public, en utilisant uniquement la commande
<code>ssh</code>. Aucun agent à installer — si OpenSSH est présent (les
versions modernes de macOS, Linux et Windows l'incluent), vous avez déjà
tout ce qu'il faut.</p>

<h2>Comment ça marche</h2>
<p>Quand vous lancez <code>ssh&nbsp;-R</code> vers AirWeb, notre serveur SSH
accepte la requête de <em>reverse port forwarding</em> du client et ouvre
un listener public pour vous. Le trafic qui arrive sur ce listener est
renvoyé via la connexion SSH existante jusqu'à un port de votre machine.</p>
<ul>
  <li>Pour HTTP, le listener public est notre reverse proxy partagé en
      80/443 sur <code>{{PUBLIC_DOMAIN}}</code>, qui route par sous-domaine.</li>
  <li>Pour le TCP brut, le serveur (ou vous) choisit un port dédié et les
      octets sont relayés tels quels.</li>
</ul>

<h2>Pourquoi on utilise AirWeb</h2>
<ul>
  <li><strong>Aucune installation.</strong> Pas de binaire client, pas de
      module noyau, pas d'extension navigateur. Juste OpenSSH et un fichier
      de clé.</li>
  <li><strong>De vraies URLs publiques.</strong> Vous obtenez
      <code>https://&lt;nom&gt;.{{PUBLIC_DOMAIN}}</code> — pratique pour
      les webhooks, les tests mobiles, les callbacks OAuth, les démos et
      l'IoT.</li>
  <li><strong>Identifiants permanents.</strong> Louez un nom sur le
      <a href="{{APEX}}/marketplace">marketplace</a> et personne ne peut
      vous le piquer.</li>
  <li><strong>Auto-hébergeable.</strong> Tout le code qui fait tourner ce
      service est dans le même dépôt que vous pouvez déployer vous-même.</li>
</ul>

<h2>Et après ?</h2>
<p>Le meilleur moyen de comprendre AirWeb est de publier une appli web
locale <em>tout de suite</em>. Filez vers le
<a href="/quick-start">guide démarrage rapide</a> — vous aurez une URL en
ligne en moins de deux minutes.</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': 'Démarrage rapide — votre premier tunnel en 60 s',
  'quick-start.description':
    'Publiez un service HTTP local sur l\'internet public avec une seule ' +
    'commande ssh. Ce guide pas-à-pas vous donne une URL https en ~1 minute.',
  'quick-start.html': `
<h1>Démarrage rapide</h1>
<p class="lead">Trois étapes. Un terminal. Une URL publique.</p>

<h2>1. Créer un compte et récupérer une clé</h2>
<p>Allez sur <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> et cliquez
sur <em>Create account</em>. Le site vous remet un fichier nommé
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code>. C'est votre clé privée SSH —
gardez-la en lieu sûr.</p>
<pre><code># macOS / Linux uniquement — sautez l'étape sous Windows
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. Lancer quelque chose sur localhost</h2>
<p>N'importe quoi qui parle HTTP convient. Si vous n'avez pas d'appli sous
la main :</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. Ouvrir le tunnel</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>Ouvrez maintenant <code>http://myapp.{{PUBLIC_DOMAIN}}</code> dans votre
navigateur. Vous verrez les requêtes apparaître dans le terminal de votre
serveur local. <kbd>Ctrl</kbd>+<kbd>C</kbd> pour couper l'URL.</p>

<h2>À quoi sert chaque option</h2>
<dl>
  <dt><code>-i &lt;fichier&gt;</code></dt>
  <dd>La clé privée que vous avez téléchargée.</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Notre serveur SSH écoute sur le port {{SSH_PORT}}, pas le 22.</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>Forward inverse du port HTTP public vers le 3000 local.</dd>
  <dt><code>myapp@…</code></dt>
  <dd>Le nom d'utilisateur SSH devient votre sous-domaine public.</dd>
</dl>

<h2>Et ensuite</h2>
<ul>
  <li><a href="/http-tunnels">Publier plusieurs applis à la fois</a></li>
  <li><a href="/tcp-tunnels">Exposer une base de données ou un serveur de jeu (TCP brut)</a></li>
  <li><a href="/handles">Réserver un nom permanent avec un identifiant loué</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': 'Installer le client AirWeb',
  'installation.description':
    'AirWeb fonctionne avec l\'OpenSSH système sous macOS, Linux et ' +
    'Windows. Vous pouvez aussi installer le wrapper Node.js optionnel ' +
    '`airweb` pour une CLI plus conviviale. Instructions pour les deux ci-dessous.',
  'installation.html': `
<h1>Installation</h1>
<p class="lead">Le « client » AirWeb est simplement le binaire
<code>ssh</code> déjà présent sur votre ordinateur. Pour une ligne de
commande un peu plus agréable, nous publions un wrapper Node.js optionnel.</p>

<h2>Étape 1 — Vérifier qu'OpenSSH est là</h2>
<ul>
  <li><strong>macOS</strong> : préinstallé depuis la nuit des temps.
      Vérifiez avec <code>ssh -V</code>.</li>
  <li><strong>Linux</strong> : <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) ou l'équivalent pour votre distro.</li>
  <li><strong>Windows 10/11</strong> : OpenSSH est fourni comme
      fonctionnalité optionnelle. Depuis PowerShell :
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>Étape 2 — Télécharger votre clé</h2>
<p>Connectez-vous à <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>. La
clé privée n'est proposée qu'une seule fois. Traitez-la comme un mot de
passe — quiconque a ce fichier peut publier sous votre compte.</p>

<h2>Étape 3 — (Optionnel) installer le wrapper airweb</h2>
<p>Le wrapper <code>airweb</code> assemble la bonne commande
<code>ssh</code> pour vous et affiche d'abord l'URL publique. Installez-le
globalement via npm :</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>Puis utilisez-le ainsi :</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>Dépannage installation</h2>
<ul>
  <li><strong>« <code>ssh</code> not found »</strong> — vérifiez qu'OpenSSH
      est dans le <code>PATH</code>. Sous Windows, rouvrez un terminal
      après avoir installé la fonctionnalité optionnelle.</li>
  <li><strong>« Permissions are too open »</strong> sous macOS/Linux —
      <code>chmod 600</code> sur le fichier de clé.</li>
  <li><strong>Proxy d'entreprise ?</strong> SSH peut passer en tunnel
      au-dessus de HTTPS via <code>-o&nbsp;ProxyCommand</code> ; voir
      <a href="/troubleshooting#corporate-proxy">dépannage</a>.</li>
</ul>
`,

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'Tunnels HTTP — partager une appli web',
  'http-tunnels.description':
    'Référence détaillée des tunnels HTTP AirWeb : choix du sous-domaine, ' +
    'flux de requête, WebSockets, en-têtes Host, chemins personnalisés et ' +
    'tunnels concurrents sur un même compte.',
  'http-tunnels.html': `
<h1>Tunnels HTTP</h1>
<p class="lead">Quand vous demandez <code>-R 80:localhost:&lt;port&gt;</code>
à AirWeb, on ne bind pas réellement le port 80 du serveur pour vous — ça
limiterait à un tunnel par machine. À la place, le routeur HTTP d'AirWeb
traite votre <em>nom d'utilisateur SSH</em> comme un sous-domaine et route
selon l'en-tête Host.</p>

<h2>Le cheminement d'une requête</h2>
<ol>
  <li>Un visiteur ouvre <code>https://myapp.{{PUBLIC_DOMAIN}}</code>.</li>
  <li>Le routeur HTTP public reçoit la requête et regarde l'en-tête
      <code>Host</code>.</li>
  <li>Il trouve le tunnel enregistré pour le sous-domaine
      <code>myapp</code> et demande à votre connexion SSH d'ouvrir un
      nouveau canal.</li>
  <li>Votre client <code>ssh</code> reçoit le canal et forwarde les octets
      vers <code>localhost:&lt;port&gt;</code>.</li>
  <li>La réponse revient par le même chemin.</li>
</ol>

<h2>Choisir un sous-domaine</h2>
<p>Le sous-domaine est juste le nom d'utilisateur SSH :</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>Tout nom qui n'est pas actuellement loué est libre. Si vous voulez un
nom intouchable, louez un <a href="/handles">identifiant</a> sur le
marketplace.</p>

<h2>WebSockets et streaming</h2>
<p>La connexion reste vivante après le handshake HTTP/1.1
<code>Upgrade</code>, donc les tunnels pour WebSockets et Server-Sent
Events marchent tels quels. Il n'y a aucune couche de buffering devant
votre service — les octets sont relayés dès qu'ils arrivent.</p>

<h2>Plusieurs tunnels en même temps</h2>
<p>Ouvrez autant de sessions SSH que vous voulez, chacune avec son
sous-domaine. Pattern classique à deux terminaux pour le front :</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>Les callbacks OAuth des deux côtés tiendront après un redémarrage, tant
que les sous-domaines ne changent pas.</p>

<h2>En-tête Host et chemin de base</h2>
<p>Les requêtes sont forwardées avec l'en-tête <code>Host</code> original
réécrit vers votre nom d'hôte public. La plupart des frameworks acceptent
ça ; si le vôtre génère des URLs absolues à partir d'un host codé en dur,
réglez son « trusted host » ou « external URL » sur
<code>myapp.{{PUBLIC_DOMAIN}}</code>.</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'Tunnels TCP — BDD, serveurs de jeu et plus',
  'tcp-tunnels.description':
    'Forwardez du trafic TCP arbitraire — Postgres, Redis, Minecraft, SSH ' +
    'bastion — à travers un tunnel inverse AirWeb.',
  'tcp-tunnels.html': `
<h1>Tunnels TCP</h1>
<p class="lead">HTTP est le cas courant, mais AirWeb sait porter n'importe
quel protocole TCP. Demandez un port autre que 80 dans le <code>-R</code>
et le serveur ouvrira un listener TCP dédié pour vous.</p>

<h2>Choisir un port ou laisser le serveur faire</h2>
<pre><code># Demande un port précis
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# Laisse le serveur choisir un port libre (port 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p>Si vous passez <code>0</code>, surveillez le bandeau SSH — le port
attribué y sera imprimé et apparaîtra aussi dans votre tableau de bord
<a href="{{APEX}}/connections">connexions</a>.</p>

<h2>Se connecter depuis un client</h2>
<p>L'adresse publique est <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code> :</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>Et UDP ?</h2>
<p>SSH ne parle que TCP. Pour les services UDP (DNS, QUIC, la plupart des
jeux temps réel), enveloppez-les dans un tunnel TCP façon
<em>udp-over-tcp</em> aux deux bouts, ou lancez un petit relais WireGuard
au-dessus d'un tunnel HTTP.</p>

<h2>Avertissement sécurité</h2>
<p>Les tunnels TCP bruts héritent de toute l'authentification que fournit
le service sous-jacent. <strong>N'exposez jamais une base de données sans
authentification à l'internet public</strong>, même « juste une minute ».
Mettez un mot de passe et ajoutez un firewall par-dessus.</p>
`,

  // ---------- handles ----------
  'handles.title': 'Identifiants — louer des sous-domaines permanents',
  'handles.description':
    'Les identifiants sont des sous-domaines réservés auxquels seul votre ' +
    'compte peut publier. Apprenez à miser, louer et renouveler des ' +
    'identifiants sur le marketplace AirWeb.',
  'handles.html': `
<h1>Identifiants</h1>
<p class="lead">Par défaut les sous-domaines sont en premier arrivé,
premier servi. Dès que vous vous déconnectez, le nom redevient libre. Un
<strong>identifiant</strong> est une location — vous payez quelques crédits
pour réserver un nom et seul votre compte peut publier dessous.</p>

<h2>Comment fonctionne la location</h2>
<ol>
  <li>Cherchez un nom sur le <a href="{{APEX}}/marketplace">marketplace</a>.</li>
  <li>S'il n'est pas loué, vous pouvez le réserver au tarif mensuel
      affiché. Les noms populaires coûtent plus cher.</li>
  <li>Pendant la durée du bail, toute session SSH venant d'un autre compte
      avec ce nom d'utilisateur est refusée.</li>
  <li>Renouvelez en un clic avant l'expiration. Si vous le laissez expirer,
      il retourne dans le pool après un court délai de grâce.</li>
</ol>

<h2>Pourquoi louer ?</h2>
<ul>
  <li><strong>Webhooks stables.</strong> Configurez GitHub, Stripe, Slack,
      etc., une seule fois.</li>
  <li><strong>Image de marque.</strong>
      <code>https://votrenom.{{PUBLIC_DOMAIN}}</code> se partage mieux
      qu'une chaîne aléatoire.</li>
  <li><strong>Sécurité.</strong> Personne ne peut s'emparer du nom pendant
      que vous dormez.</li>
</ul>

<h2>Recharger les crédits</h2>
<p>Les locations sont facturées en crédits (AWC). Achetez-en depuis le
<a href="{{APEX}}/dashboard">tableau de bord</a>. Voir le
<a href="/credits">guide des crédits</a> pour la tarification du moment.</p>
`,

  // ---------- credits ----------
  'credits.title': 'Crédits, facturation et économie AWC',
  'credits.description':
    'Les crédits (AWC) sont l\'unité de valeur dans AirWeb — ils paient ' +
    'les locations d\'identifiants, les sous-domaines premium et les ' +
    'pourboires aux créateurs. Découvrez comment l\'économie fonctionne ' +
    'et comment recharger.',
  'credits.html': `
<h1>Crédits et facturation</h1>
<p class="lead">Tout ce qui a un prix dans AirWeb est facturé en
<strong>crédits AirWeb (AWC)</strong>. C'est une simple unité comptable
interne — pas de blockchain.</p>

<h2>Comment obtenir des crédits</h2>
<ul>
  <li><strong>Solde de départ gratuit.</strong> Chaque nouveau compte
      démarre avec assez pour louer son premier identifiant
      gratuitement.</li>
  <li><strong>Recharge.</strong> Achetez-en depuis le tableau de bord.</li>
  <li><strong>Gagner en hébergeant.</strong> Tant que vous gardez des
      tunnels en vie, le compteur d'uptime verse une petite indemnité
      chaque minute sur votre solde.</li>
  <li><strong>Marketplace.</strong> Vendez les identifiants dont vous ne
      voulez plus.</li>
</ul>

<h2>Comment dépenser des crédits</h2>
<ul>
  <li>Locations d'identifiants (récurrent).</li>
  <li>Options premium comme les plages de ports TCP réservées.</li>
  <li>Pourboires directs vers d'autres comptes.</li>
</ul>

<h2>Estimation en USD</h2>
<p>Le site entier affiche une estimation USD à côté de votre solde. Le
taux est configuré par déploiement et exposé via
<code>GET&nbsp;{{APEX}}/api/config</code>. C'est une <em>estimation</em>,
pas un taux de change — il n'existe aucun moyen de reconvertir les
crédits en cash.</p>

<h2>Le ledger</h2>
<p>Chaque mouvement de crédits est consigné dans un ledger en append-only
que vous pouvez inspecter :</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>Le tableau de bord affiche les mêmes données avec des libellés
plus parlants.</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': 'Le tableau de bord — votre base AirWeb',
  'dashboard.description':
    'Gérez tunnels, identifiants, crédits et paramètres de compte dans le ' +
    'tableau de bord AirWeb. Visite guidée de chaque panneau avec les raccourcis.',
  'dashboard.html': `
<h1>Le tableau de bord</h1>
<p class="lead">Connectez-vous à <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>
et vous atterrissez sur une page unique qui résume tout ce qui se passe sur
votre compte.</p>

<h2>Tunnels en direct</h2>
<p>Le panneau du haut liste chaque tunnel actuellement lié à votre compte —
sous-domaine ou port TCP, durée de connexion, octets transférés. Cliquez
sur une ligne pour copier l'URL publique.</p>

<h2>Identifiants</h2>
<p>Les locations que vous détenez s'affichent avec leur date d'expiration.
Renouvellement en un clic.</p>

<h2>Crédits</h2>
<p>Solde, taux de gains du jour et un mini-graphe d'activité récente.
<a href="/credits">Plus sur les crédits ici.</a></p>

<h2>L'en-tête commun</h2>
<p>L'en-tête du haut est le même sur toutes les pages AirWeb (tableau de
bord, marketplace, connexions, documentation et tout service interne).
L'icône engrenage ouvre les paramètres thème, langue et devise — vos
préférences sont stockées dans des cookies avec scope
<code>.{{PUBLIC_DOMAIN_BASE}}</code>, donc elles vous suivent sur tous les
sous-domaines.</p>
`,

  // ---------- connections ----------
  'connections.title': 'Page connexions — télémétrie temps réel des tunnels',
  'connections.description':
    'Voyez chaque tunnel SSH actif vers le cluster AirWeb — les vôtres et ' +
    'les publics — avec les octets entrée/sortie en direct et les infos d\'origine.',
  'connections.html': `
<h1>Connexions</h1>
<p class="lead">La page <a href="{{APEX}}/connections">/connections</a>
diffuse en temps réel tous les tunnels actifs.</p>

<h2>Colonnes</h2>
<dl>
  <dt>Sous-domaine / Port</dt><dd>Ce que le monde extérieur voit.</dd>
  <dt>Source</dt><dd>L'adresse IP depuis laquelle la session SSH s'est
      établie (masquée pour les visiteurs non-admin).</dd>
  <dt>Uptime</dt><dd>Durée d'activité de la session.</dd>
  <dt>Octets In / Out</dt><dd>Trafic cumulé sur la vie du tunnel.</dd>
</dl>

<h2>Lignes publiques vs. privées</h2>
<p>Tout le monde peut voir qu'un tunnel <em>existe</em> sur
<code>foo.{{PUBLIC_DOMAIN}}</code> — c'est l'idée d'un domaine partagé —
mais les métadonnées comme l'IP source et le nom d'utilisateur ne sont
visibles que pour le propriétaire et les administrateurs.</p>

<h2>Server-Sent Events</h2>
<p>La page est alimentée par le flux SSE
<code>{{APEX}}/api/connections/events</code>. Abonnez-vous vous-même si
vous voulez monter des dashboards ou des règles d'alerte custom.</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': 'Marketplace — acheter et vendre des identifiants',
  'marketplace.description':
    'Parcourez et enchérissez sur les identifiants AirWeb. Les vendeurs ' +
    'listent ceux dont ils ne veulent plus ; les acheteurs récupèrent le ' +
    'sous-domaine idéal.',
  'marketplace.html': `
<h1>Le marketplace</h1>
<p class="lead">Le <a href="{{APEX}}/marketplace">marketplace</a> est là
où les identifiants changent de main. On l'a fait petit volontairement —
recherchez, cliquez sur acheter, c'est à vous.</p>

<h2>Mettre en vente un identifiant</h2>
<ol>
  <li>Ouvrez l'un de vos identifiants loués dans le tableau de bord.</li>
  <li>Cliquez <em>List for sale</em> et fixez un prix en AWC.</li>
  <li>L'annonce apparaît immédiatement sur le marketplace.</li>
  <li>À l'achat, les crédits arrivent sur votre compte et le bail
      restant est transféré à l'acheteur.</li>
</ol>

<h2>Règles d'annonce</h2>
<ul>
  <li>Vous ne pouvez lister que des identifiants que vous possédez.</li>
  <li>Les annonces expirent quand le bail sous-jacent expire.</li>
  <li>Le marketplace ne prend pas de commission — le prix affiché est ce
      que vous recevez.</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (auth requise)</code></pre>
<p>Voir la <a href="/api">référence API</a> pour le schéma complet.</p>
`,

  // ---------- cli ----------
  'cli.title': 'Référence du CLI airweb',
  'cli.description':
    'Toutes les options acceptées par le wrapper CLI airweb, avec ' +
    'exemples pour tunnels HTTP et TCP.',
  'cli.html': `
<h1>Référence du CLI</h1>
<p class="lead">Le wrapper optionnel <code>airweb</code> vous évite de
retenir les options SSH. Installez-le avec
<code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code>.</p>

<h2>Usage</h2>
<pre><code>airweb http &lt;portLocal&gt; [--sub &lt;nom&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;chemin&gt;

airweb tcp &lt;portLocal&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;chemin&gt;</code></pre>

<h2>Options</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(requis)</em></dt>
  <dd>Le endpoint SSH d'AirWeb, par ex.
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>.</dd>

  <dt><code>--key &lt;chemin&gt;</code> <em>(requis)</em></dt>
  <dd>Chemin vers le fichier de clé téléchargé.</dd>

  <dt><code>--sub &lt;nom&gt;</code></dt>
  <dd>Mode HTTP uniquement. Le sous-domaine de publication. Aléatoire si
      omis.</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>Mode TCP uniquement. Demande au serveur un port public précis. Si
      omis, le serveur en choisit un.</dd>

  <dt><code>--user &lt;nom&gt;</code></dt>
  <dd>Remplace le nom d'utilisateur SSH. Utile quand vous avez besoin d'un
      utilisateur différent du sous-domaine.</dd>

  <dt><code>--help</code></dt>
  <dd>Affiche l'usage.</dd>
</dl>

<h2>Exemples</h2>
<pre><code># Dev server React sur votre sous-domaine préféré
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# Postgres sur un port public choisi
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'Référence de l\'API HTTP',
  'api.description':
    'Chaque endpoint JSON exposé par AirWeb — auth, solde et ledger, ' +
    'marketplace d\'identifiants, télémétrie admin.',
  'api.html': `
<h1>API HTTP</h1>
<p class="lead">Tous les endpoints sont <code>application/json</code> et
vivent sous <code>{{APEX}}/api</code>. L'auth est basée cookies —
connectez-vous via <code>POST&nbsp;/api/login</code> ou
<code>POST&nbsp;/api/register</code> et le serveur posera un cookie de
session scopé à <code>.{{PUBLIC_DOMAIN_BASE}}</code>.</p>

<h2>Auth</h2>
<table class="api">
  <thead><tr><th>Méthode</th><th>Chemin</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>Crée un compte, pose le cookie, renvoie l'URL de téléchargement de la clé.</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>Se connecte avec nom d'utilisateur + signature de la clé.</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>Efface le cookie de session.</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>Profil, solde et résumé des baux de l'utilisateur connecté.</td></tr>
  </tbody>
</table>

<h2>Configuration publique</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>Crédits</h2>
<pre><code>GET /api/ledger        # auth requise
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>Marketplace</h2>
<table class="api">
  <thead><tr><th>Méthode</th><th>Chemin</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>Parcourt toutes les annonces ouvertes.</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>Filtre par vendeur.</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>Met en vente un identifiant possédé.</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>Loue un nom libre ou renouvelle un identifiant détenu.</td></tr>
  </tbody>
</table>

<h2>Erreurs</h2>
<p>Tous les endpoints renvoient du JSON avec un champ <code>error</code>
et un code HTTP approprié en cas d'échec. Erreurs de validation : 400,
auth requise : 401, paiement requis : 402, ressource absente : 404,
limitation : 429.</p>
`,

  // ---------- security ----------
  'security.title': 'Modèle de sécurité et bonnes pratiques',
  'security.description':
    'Comment AirWeb authentifie les clients, isole les tunnels et protège ' +
    'les données utilisateurs — plus des bonnes pratiques pour durcir les ' +
    'services que vous exposez.',
  'security.html': `
<h1>Modèle de sécurité</h1>
<p class="lead">Un modèle de menaces court et honnête : ce que fait
AirWeb, ce qu'il ne fait pas, et comment l'utiliser en toute sécurité.</p>

<h2>Authentification</h2>
<p>Authentification par paire de clés SSH uniquement — les mots de passe
sont désactivés côté serveur. La clé est générée côté serveur à
l'inscription et téléchargée une seule fois. Si vous la perdez, vous
perdez l'accès au compte — nous ne pouvons pas la réémettre (nous ne la
stockons jamais).</p>

<h2>Isolation par compte</h2>
<p>Les sous-domaines et ports TCP appartiennent au compte qui les a
enregistrés. Tout autre client qui tente de se lier à un nom loué est
rejeté pendant le handshake <code>tcpip-forward</code>.</p>

<h2>Ce qu'AirWeb peut voir</h2>
<ul>
  <li>Les octets qui transitent dans les tunnels passent par notre routeur
      public. Le routeur ne journalise jamais les corps de requête, juste
      des compteurs.</li>
  <li>Si vous tunnelez du HTTP sans terminer le TLS de votre côté, notre
      routeur voit les requêtes en clair en mémoire pendant le routage.</li>
  <li>Pour du TLS bout en bout, terminez le TLS dans votre service et
      envoyez les octets déjà chiffrés via un tunnel TCP.</li>
</ul>

<h2>Bonnes pratiques pour les services exposés</h2>
<ul>
  <li><strong>Considérez internet comme hostile.</strong> Mettez de
      l'authentification même sur les prototypes « internes ».</li>
  <li>Appliquez du <strong>rate limiting</strong> aux endpoints à effet
      de bord lourd.</li>
  <li><strong>Faites tourner votre clé</strong> si vous suspectez une
      compromission — supprimez l'ancien compte depuis le tableau de bord
      et créez-en un nouveau.</li>
  <li>Utilisez des <strong>identifiants éphémères</strong> pour ce qui
      est lié à une démo ou une conférence précise, pour qu'ils expirent
      tout seuls.</li>
</ul>

<h2>Signaler une vulnérabilité</h2>
<p>Trouvé un bug ? Écrivez-nous à
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>. Nous pratiquons la
divulgation responsable et créditons publiquement les rapporteurs.</p>
`,

  // ---------- faq ----------
  'faq.title': 'Questions fréquentes',
  'faq.description':
    'Réponses brèves aux questions les plus posées sur AirWeb : comparaison ' +
    'avec ngrok, auto-hébergement, domaines personnalisés, offre gratuite, etc.',
  'faq.html': `
<h1>Questions fréquentes</h1>

<h3>AirWeb se compare comment à ngrok ou Cloudflare Tunnel ?</h3>
<p>Notre transport est de l'OpenSSH tout bête — pas de protocole
propriétaire, pas de binaire client, pas de module noyau. En contrepartie,
vous n'avez pas l'UI d'inspection façon ngrok ni le réseau edge de
Cloudflare. Si « ssh passe à travers tous les firewalls » vous suffit,
AirWeb est la réponse la plus simple.</p>

<h3>Puis-je faire tourner mon propre serveur AirWeb ?</h3>
<p>Oui — le repo est le même code qui fait tourner le service hébergé.
Clonez-le, copiez <code>config.default.json</code> en <code>config.json</code>,
réglez <code>AIRWEB_PUBLIC_DOMAIN</code>, puis <code>npm start</code>.
DNS : il vous faut un enregistrement A wildcard pointant
<code>*.votre-domaine</code> vers l'hôte.</p>

<h3>Y a-t-il un palier gratuit sur le service hébergé ?</h3>
<p>Oui — chaque compte démarre avec assez de crédits pour louer un
identifiant court pendant un mois et lancer autant de tunnels anonymes
que vous voulez en attendant.</p>

<h3>Je peux utiliser mon propre domaine ?</h3>
<p>Pas encore sur le service hébergé — les identifiants vivent sous le
domaine public principal. Sur une instance auto-hébergée, bien sûr :
configurez le wildcard que vous contrôlez.</p>

<h3>Que deviennent mes tunnels si le réseau tombe ?</h3>
<p>Si vous utilisez le wrapper, le client SSH réessaie automatiquement
avec <code>ServerAliveInterval</code>. En <code>ssh</code> brut, ajoutez
<code>-o&nbsp;ServerAliveInterval=30</code> ou enveloppez la commande
dans <code>autossh</code> pour le même comportement.</p>

<h3>AirWeb supporte HTTP/2 ou HTTP/3 ?</h3>
<p>Le edge public parle HTTP/1.1 et HTTP/2. HTTP/3 (QUIC) nécessite UDP
et est sur la feuille de route. Votre origine peut parler ce qu'elle
veut — le proxy normalise en HTTP/1.1 pour le saut tunnel.</p>

<h3>Je peux utiliser AirWeb pour du trafic de production ?</h3>
<p>Certains le font, mais comprenez ce que vous achetez. Une session SSH
unique est un point de défaillance unique. Pour du vrai prod, on
recommande l'auto-hébergement multi-région avec des sessions active/active
derrière un load balancer.</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': 'Résoudre les erreurs courantes d\'AirWeb',
  'troubleshooting.description':
    'Recettes pour les erreurs les plus rencontrées : forward refusé, ' +
    'port occupé, droits de clé, proxies d\'entreprise, et plus.',
  'troubleshooting.html': `
<h1>Dépannage</h1>

<h2 id="forwarding-failed">« Remote forwarding failed »</h2>
<p>Le serveur a refusé de binder le port demandé. Causes courantes :</p>
<ul>
  <li>Quelqu'un d'autre (ou votre précédente session SSH) tient encore ce
      sous-domaine ou ce port TCP. Attendez un instant et réessayez.</li>
  <li>Vous avez demandé un port privilégié (&lt; 1024) sans être propriétaire
      de l'identifiant. Utilisez 80 (traité spécialement) ou un port ≥
      1024.</li>
  <li>L'identifiant est loué par un autre compte. Choisissez un autre nom,
      ou louez-le sur le <a href="{{APEX}}/marketplace">marketplace</a>.</li>
</ul>

<h2 id="permission-denied">« Permission denied (publickey) »</h2>
<ul>
  <li>Vérifiez que le chemin de <code>-i</code> pointe sur le fichier que
      vous avez téléchargé.</li>
  <li>Sous macOS/Linux, <code>chmod 600</code> sur la clé — SSH refuse les
      clés privées lisibles par tout le monde.</li>
  <li>Si votre <code>ssh-agent</code> est bavard et propose la mauvaise clé
      en premier, ajoutez <code>-o&nbsp;IdentitiesOnly=yes</code>.</li>
</ul>

<h2 id="corporate-proxy">Derrière un proxy d'entreprise</h2>
<p>Si le port sortant {{SSH_PORT}} est bloqué, vous pouvez tunneler SSH
via un proxy avec <code>corkscrew</code> ou <code>ProxyCommand</code> :</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">Mon receveur de webhook répond deux fois</h2>
<p>Vous avez sans doute deux sessions SSH qui revendiquent le même
sous-domaine. Regardez la
<a href="{{APEX}}/connections">page connexions</a> — si deux lignes
portent le même nom, tuez-en une.</p>

<h2 id="https-redirect">« Le site n'a pas HTTPS »</h2>
<p>Sur le service hébergé chaque sous-domaine est servi à la fois en
<code>http</code> et <code>https</code>. Si votre service redirige
lui-même vers <code>http://</code>, réglez son « external URL » sur
<code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>.</p>

<h2>Obtenir plus de debug</h2>
<p>Ajoutez <code>-vvv</code> à la commande <code>ssh</code> et vous aurez
les logs complets du handshake. La plupart des « ça marche pas » se
résolvent en partageant cette sortie.</p>
`,

  // ---------- changelog ----------
  'changelog.title': 'Changelog',
  'changelog.description':
    'Les changements notables d\'une version à l\'autre d\'AirWeb — ' +
    'fonctionnalités, ruptures, correctifs de sécurité.',
  'changelog.html': `
<h1>Changelog</h1>
<p class="lead">Les changements qui cassent la compatibilité sont marqués
<strong>BREAKING</strong>. Les dates correspondent à l'arrivée sur le
service hébergé.</p>

<h3>2026-05 — En-tête unifié et paramètres partagés</h3>
<ul>
  <li>Même design d'en-tête sur landing, tableau de bord, marketplace,
      connexions et documentation.</li>
  <li>Thème, langue et devise persistent maintenant dans un cookie scopé
      <code>.{{PUBLIC_DOMAIN_BASE}}</code> et vous suivent sur tous les
      sous-domaines.</li>
</ul>

<h3>2026-03 — Économie de récompenses réaliste</h3>
<ul>
  <li>Inventaire de départ rééquilibré pour livrer des objets réellement
      utiles au lieu de bric-à-brac aléatoire.</li>
  <li>Correctif certificats de niveau : maintenant délivrés à chaque
      montée de niveau, pas seulement quand le titre change.</li>
</ul>

<h3>2025-12 — CORS pour les serveurs internes</h3>
<ul>
  <li>Les services internes comme ce site de doc peuvent désormais
      appeler l'API apex depuis un sous-domaine différent.
      <strong>BREAKING</strong> : les scripts qui supposaient une même
      origine pour <code>/api/me</code> doivent maintenant envoyer
      <code>credentials:&nbsp;'include'</code>.</li>
</ul>

<h3>2025-09 — Marketplace d'identifiants</h3>
<ul>
  <li>Lancement du marketplace. Louez, listez et transférez des
      identifiants.</li>
</ul>
`,
};
