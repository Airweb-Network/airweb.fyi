// Japanese (ja) translations for Airweb docs.
module.exports = {
  'getting-started.label': 'はじめに',
  'tunneling.label':       'トンネリング',
  'platform.label':        'プラットフォーム',
  'reference.label':       'リファレンス',

  // ---------- introduction ----------
  'introduction.title': 'Airweb の紹介',
  'introduction.description':
    'Airweb は 1 つの SSH コマンドを公開 HTTPS URL に変えます。' +
    'Airweb とは何か、リバース SSH トンネリングはどう動くのか、' +
    'なぜ localhost のサービスを世界に共有する最速の方法なのかを学びましょう。',
  'introduction.html': `
<h1>Airweb とは?</h1>
<p class="lead">Airweb は、ノート PC や閉じたネットワーク内で動いている
あらゆるサービスを <code>ssh</code> コマンドだけで公開インターネットに
公開できるリバーストンネリングサービスです。インストールするエージェントは
ありません ― OpenSSH があれば（最近の macOS、Linux、Windows にはすべて
標準搭載されています）必要なものはすべて揃っています。</p>

<h2>仕組み</h2>
<p><code>ssh&nbsp;-R</code> を Airweb に対して実行すると、SSH サーバーが
クライアントからの<em>リバースポートフォワード</em>要求を受け入れ、公開
リスナーをバインドします。そのリスナーに届くトラフィックは既存の SSH
接続を通じてあなたのマシンのポートに送り返されます。</p>
<ul>
  <li>HTTP の場合、公開リスナーは <code>{{PUBLIC_DOMAIN}}</code> 上の
      共有 80/443 リバースプロキシで、サブドメインでルーティングされます。</li>
  <li>生の TCP の場合、サーバーが（またはあなたが）専用ポートを選び、
      バイトをそのまま転送します。</li>
</ul>

<h2>人々が Airweb を使う理由</h2>
<ul>
  <li><strong>インストール不要。</strong>クライアントバイナリも、カーネル
      モジュールも、ブラウザ拡張もいりません。OpenSSH と鍵ファイルだけです。</li>
  <li><strong>本物の公開 URL。</strong>
      <code>https://&lt;name&gt;.{{PUBLIC_DOMAIN}}</code> 形式の URL が得られ、
      Webhook、モバイル検証、OAuth コールバック、デモ、IoT に便利です。</li>
  <li><strong>恒久ハンドル。</strong>
      <a href="{{APEX}}/marketplace">マーケットプレイス</a>で名前をリース
      すれば、他の誰も奪えません。</li>
  <li><strong>セルフホスト可能。</strong>このサービスを動かすコードはすべて
      自分でデプロイできる同じリポジトリにあります。</li>
</ul>

<h2>次のステップ</h2>
<p>Airweb の動きを最も早く体感する方法は、いますぐローカルの Web アプリを
公開してみることです。<a href="/quick-start">クイックスタート</a>へどうぞ ―
2 分以内にライブ URL が得られます。</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': 'クイックスタート ― 60 秒で最初のトンネル',
  'quick-start.description':
    '1 つの ssh コマンドでローカル HTTP サービスを公開インターネットに' +
    '公開します。このステップバイステップガイドで、約 1 分で動く https URL を取得できます。',
  'quick-start.html': `
<h1>クイックスタート</h1>
<p class="lead">3 ステップ。ターミナル 1 つ。公開 URL 1 つ。</p>

<h2>1. アカウントを作成して鍵を取得</h2>
<p><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> を開き、
<em>Create account</em> をクリックします。
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code> という名前のファイルが渡されます。
これがあなたの SSH 秘密鍵 ― 安全な場所に保管してください。</p>
<pre><code># macOS / Linux のみ ― Windows は不要
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. localhost で何かを起動</h2>
<p>HTTP を話すものなら何でも動きます。手元にアプリがない場合は:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. トンネルを開く</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>ブラウザで <code>http://myapp.{{PUBLIC_DOMAIN}}</code> を開いてください。
リクエストがローカルサーバーのターミナルに表示されます。URL を閉じるには
<kbd>Ctrl</kbd>+<kbd>C</kbd> を押します。</p>

<h2>各フラグの意味</h2>
<dl>
  <dt><code>-i &lt;file&gt;</code></dt>
  <dd>ダウンロードした秘密鍵です。</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Airweb の SSH サーバーはポート {{SSH_PORT}}（22 ではありません）で動作します。</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>公開 HTTP ポートをローカルの 3000 にリバースフォワードします。</dd>
  <dt><code>myapp@…</code></dt>
  <dd>SSH ユーザー名が公開先サブドメインになります。</dd>
</dl>

<h2>次は</h2>
<ul>
  <li><a href="/http-tunnels">複数のアプリを同時に公開する</a></li>
  <li><a href="/tcp-tunnels">データベースやゲームサーバーを公開する（生 TCP）</a></li>
  <li><a href="/handles">ハンドルリースで恒久的な名前を予約する</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': 'Airweb クライアントのインストール',
  'installation.description':
    'Airweb は macOS、Linux、Windows の標準 OpenSSH で動作します。' +
    'よりフレンドリーなコマンドが欲しい場合は、オプションの ' +
    '`airweb` Node.js ラッパーも利用できます。両方のセットアップ方法を紹介します。',
  'installation.html': `
<h1>インストール</h1>
<p class="lead">Airweb の「クライアント」とは、コンピューターにすでに入っている
<code>ssh</code> バイナリそのものです。コマンドラインを少し見やすくしたい場合は、
オプションの Node.js ラッパーも公開されています。</p>

<h2>ステップ 1 ― OpenSSH を確認</h2>
<ul>
  <li><strong>macOS</strong>: 太古の昔から標準搭載。<code>ssh -V</code> で確認。</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      （Debian/Ubuntu）またはお使いのディストリの相当コマンド。</li>
  <li><strong>Windows 10/11</strong>: OpenSSH は任意機能として提供されています。
      PowerShell から:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>ステップ 2 ― 鍵をダウンロード</h2>
<p><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> にログインしてください。
秘密鍵は一度きりのダウンロードとして提供されます。パスワードと同じように
扱ってください ― そのファイルを持つ人なら誰でもあなたのアカウントで公開できます。</p>

<h2>ステップ 3 ―（オプション）airweb ラッパーをインストール</h2>
<p><code>airweb</code> ラッパーは正しい <code>ssh</code> コマンドを組み立てて
公開 URL を最初に表示してくれます。npm でグローバルにインストール:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>次のように使います:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>インストールのトラブルシュート</h2>
<ul>
  <li><strong>「<code>ssh</code> not found」</strong> ― OpenSSH が
      <code>PATH</code> にあるか確認してください。Windows ではオプション
      機能をインストールしたあとにターミナルを開き直します。</li>
  <li><strong>「Permissions are too open」</strong>（macOS/Linux）― 鍵ファイルに
      <code>chmod 600</code> を実行してください。</li>
  <li><strong>会社プロキシ?</strong> SSH は
      <code>-o&nbsp;ProxyCommand</code> を使って HTTPS 上でトンネリングできます。
      <a href="/troubleshooting#corporate-proxy">トラブルシュート</a>を参照してください。</li>
</ul>
`,

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'HTTP トンネル ― Web アプリの共有',
  'http-tunnels.description':
    'Airweb HTTP トンネルの詳細リファレンス: サブドメイン選択、リクエスト' +
    'フロー、WebSocket、ホストヘッダー、カスタムパス、1 アカウントでの並行トンネル。',
  'http-tunnels.html': `
<h1>HTTP トンネル</h1>
<p class="lead">Airweb に <code>-R 80:localhost:&lt;port&gt;</code> を要求しても、
実際にサーバーのポート 80 がバインドされるわけではありません ― それでは
マシンごとに 1 つのトンネルしか持てないからです。代わりに Airweb の HTTP
ルーターは<em>SSH ユーザー名</em>をサブドメインとして使い、Host ヘッダーで
ルーティングします。</p>

<h2>リクエストフロー</h2>
<ol>
  <li>訪問者が <code>https://myapp.{{PUBLIC_DOMAIN}}</code> を開きます。</li>
  <li>公開 HTTP ルーターがリクエストを受け取り <code>Host</code> ヘッダーを
      確認します。</li>
  <li><code>myapp</code> サブドメインで登録されたトンネルを見つけ、SSH
      接続に新しいチャネルを開くよう要求します。</li>
  <li>あなたの <code>ssh</code> クライアントがそのチャネルを受け取り
      <code>localhost:&lt;port&gt;</code> にバイトを転送します。</li>
  <li>レスポンスは同じ経路で戻ります。</li>
</ol>

<h2>サブドメインの選択</h2>
<p>サブドメインはそのまま SSH ユーザー名です:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>現在リースされていない名前なら誰でも使えます。誰にも奪われない名前が
ほしければ、マーケットプレイスで <a href="/handles">ハンドル</a>をリース
してください。</p>

<h2>WebSocket とストリーミング</h2>
<p>HTTP/1.1 <code>Upgrade</code> ハンドシェイクのあとも接続は維持されるので、
WebSocket と Server-Sent Events のトンネルはそのまま動きます。サービスの前段に
バッファ層はありません ― バイトは届いた瞬間に転送されます。</p>

<h2>同時に複数のトンネル</h2>
<p>好きなだけ SSH セッションを開けます。それぞれが独自のサブドメインを
持ちます。フロントエンド開発者によくあるのはターミナル 2 枚のパターン:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>両方の OAuth コールバックも、サブドメインさえ変わらなければ再起動しても
動き続けます。</p>

<h2>ホストヘッダーとベースパス</h2>
<p>リクエストは元の <code>Host</code> を公開ホスト名に書き換えて転送されます。
多くのフレームワークはこれを受け入れます。あなたのフレームワークがハード
コードされたホストから絶対 URL を生成する場合は、フレームワークの「trusted
host」または「external URL」設定を
<code>myapp.{{PUBLIC_DOMAIN}}</code> にしてください。</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'TCP トンネル ― DB、ゲームサーバーなど',
  'tcp-tunnels.description':
    '任意の TCP トラフィック ― Postgres、Redis、Minecraft、踏み台 SSH ―' +
    'を Airweb リバーストンネルで転送します。',
  'tcp-tunnels.html': `
<h1>TCP トンネル</h1>
<p class="lead">HTTP が一般的なケースですが、Airweb はあらゆる TCP
プロトコルを運べます。<code>-R</code> フラグで 80 以外のポートを要求すると、
サーバーが専用 TCP リスナーをバインドします。</p>

<h2>ポートを指定するか、サーバーに任せる</h2>
<pre><code># 特定のポートを要求
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# 空いているポートを選んでもらう（ポート 0）
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p><code>0</code> を渡した場合は SSH バナーを見てください ― 割り当てられた
ポートが表示され、<a href="{{APEX}}/connections">接続</a>ダッシュボードにも
出ます。</p>

<h2>クライアントから接続</h2>
<p>公開アドレスは <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code> です:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>UDP は?</h2>
<p>SSH は TCP しか扱えません。UDP サービス（DNS、QUIC、ほとんどのリアル
タイムゲーム）は両端で <em>udp-over-tcp</em> のような形で TCP トンネルに
包むか、HTTP トンネル上で小さな WireGuard リレーを動かせます。</p>

<h2>セキュリティ警告</h2>
<p>生の TCP トンネルは下位サービスが提供する認証をそのまま引き継ぎます。
<strong>認証のないデータベースを公開インターネットに絶対に晒さないでください</strong> ―
「ほんの 1 分だけ」でもです。パスワードを設定し、その上にもう一枚ファイア
ウォールを置きましょう。</p>
`,

  // ---------- handles ----------
  'handles.title': 'ハンドル ― 恒久サブドメインのリース',
  'handles.description':
    'ハンドルは、あなたのアカウントだけが公開できる予約済みサブドメインです。' +
    'Airweb マーケットプレイスでハンドルに入札、リース、更新する方法を学びます。',
  'handles.html': `
<h1>ハンドル</h1>
<p class="lead">デフォルトでサブドメインは早い者勝ちです。切断した瞬間に
名前はまた空きます。<strong>ハンドル</strong>はリース ― 少額のクレジットを
払って名前を予約し、あなたのアカウントだけがその名前で公開できるように
します。</p>

<h2>リースの仕組み</h2>
<ol>
  <li><a href="{{APEX}}/marketplace">マーケットプレイス</a>で名前を検索します。</li>
  <li>リースされていなければ、表示の月額でクレームできます。人気のある
      名前ほど高価です。</li>
  <li>リース中は、ほかのアカウントからそのユーザー名で接続を試みる
      すべての SSH セッションが拒否されます。</li>
  <li>有効期限前にワンクリックで更新できます。ハンドルを失効させると、
      短い猶予期間ののちプールに戻ります。</li>
</ol>

<h2>なぜリースする?</h2>
<ul>
  <li><strong>安定した Webhook。</strong>GitHub、Stripe、Slack などの設定は
      一度きりで済みます。</li>
  <li><strong>ブランド。</strong><code>https://yourname.{{PUBLIC_DOMAIN}}</code>
      はランダム文字列より共有しやすい。</li>
  <li><strong>セキュリティ。</strong>あなたが寝ている間に誰かに名前を
      取られることがありません。</li>
</ul>

<h2>クレジットのチャージ</h2>
<p>リース料金はクレジット（AWB）建てです。
<a href="{{APEX}}/dashboard">ダッシュボード</a>から追加購入できます。
現在の価格は <a href="/credits">クレジットガイド</a>を参照してください。</p>
`,

  // ---------- credits ----------
  'credits.title': 'クレジット、請求、AWB エコノミー',
  'credits.description':
    'クレジット（AWB）は Airweb の中での価値単位です ― ハンドルリース、' +
    'プレミアムサブドメイン、クリエイターへのチップに使われます。' +
    '仕組みとチャージ方法を学びましょう。',
  'credits.html': `
<h1>クレジットと請求</h1>
<p class="lead">Airweb の中で価格が付くものはすべて
<strong>Airweb クレジット（AWB）</strong>で表記されます。シンプルな内部の
会計単位で、ブロックチェーンは関係ありません。</p>

<h2>クレジットの獲得方法</h2>
<ul>
  <li><strong>無料スターター残高。</strong>新規アカウントは最初のハンドル
      を無料でリースできる程度の残高で始まります。</li>
  <li><strong>チャージ。</strong>ダッシュボードから追加購入。</li>
  <li><strong>ホストして稼ぐ。</strong>トンネルを維持していると、稼働時間
      カウンターが毎分わずかな手当を残高に振り込みます。</li>
  <li><strong>マーケットプレイス。</strong>不要になったハンドルを販売。</li>
</ul>

<h2>クレジットの使い道</h2>
<ul>
  <li>ハンドルのリース（定期）。</li>
  <li>予約 TCP ポート範囲などのプレミアムオプション。</li>
  <li>他アカウントへの直接チップ。</li>
</ul>

<h2>USD 換算</h2>
<p>サイト全体のヘッダーには残高の横に USD 換算が表示されます。レートは
デプロイ単位で設定され <code>GET&nbsp;{{APEX}}/api/config</code> で公開
されます。これは<em>目安</em>であって為替レートではありません ― クレジット
を現金に戻す方法はありません。</p>

<h2>元帳</h2>
<p>すべてのクレジット移動は追記型の元帳に記録されていて、いつでも
確認できます:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>ダッシュボードでは同じデータをわかりやすいラベルで表示します。</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': 'ダッシュボード ― Airweb のホームベース',
  'dashboard.description':
    'Airweb ダッシュボードでトンネル、ハンドル、クレジット、アカウント' +
    '設定を管理します。すべてのパネルを巡り、ショートカットを覚えましょう。',
  'dashboard.html': `
<h1>ダッシュボード</h1>
<p class="lead"><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> に
サインインすると、アカウントで起きていることをすべて見渡せる 1 ページに
たどり着きます。</p>

<h2>ライブトンネル</h2>
<p>上部のパネルは、現在アカウントにバインドされているすべてのトンネル ―
サブドメインや TCP ポート、接続時間、転送バイト ― を一覧表示します。
行をクリックすると公開 URL がコピーされます。</p>

<h2>ハンドル</h2>
<p>所有しているリースが有効期限とともに表示されます。更新はワンクリック。</p>

<h2>クレジット</h2>
<p>残高、今日の獲得レート、最近のアクティビティのスパークライン。
<a href="/credits">クレジットの詳細はこちら。</a></p>

<h2>ヘッダークローム</h2>
<p>上部のヘッダーはあらゆる Airweb ページ（ダッシュボード、マーケット
プレイス、接続、ドキュメント、各内部サーバー）で共通です。歯車アイコンで
テーマ、言語、通貨の設定が開けます ― 設定は
<code>.{{PUBLIC_DOMAIN_BASE}}</code> にスコープされた Cookie に保存され、
すべてのサブドメインで引き継がれます。</p>
`,

  // ---------- connections ----------
  'connections.title': '接続ページ ― リアルタイムのトンネルテレメトリ',
  'connections.description':
    'Airweb クラスタへのすべてのライブ SSH トンネル ― あなたのものも' +
    '公開のものも ― をリアルタイムの送受信バイトと送信元情報とともに見られます。',
  'connections.html': `
<h1>接続</h1>
<p class="lead"><a href="{{APEX}}/connections">/connections</a> ページは
アクティブなトンネルをリアルタイムでストリーミングします。</p>

<h2>カラム</h2>
<dl>
  <dt>サブドメイン / ポート</dt><dd>外から見える名前。</dd>
  <dt>送信元</dt><dd>SSH セッションが接続してきた IP アドレス（一般ユーザーには
      マスクされます）。</dd>
  <dt>稼働時間</dt><dd>セッションが有効になってからの時間。</dd>
  <dt>受信 / 送信バイト</dt><dd>トンネルの生存期間における累積トラフィック。</dd>
</dl>

<h2>公開 vs. 非公開の行</h2>
<p><code>foo.{{PUBLIC_DOMAIN}}</code> にトンネルが<em>存在する</em>ことは
誰でも見られます ― 共有ドメインで運用する以上それが趣旨です ― が、送信元
IP やユーザー名などのメタデータは所有者と管理者しか見られません。</p>

<h2>Server-Sent Events</h2>
<p>このページは <code>{{APEX}}/api/connections/events</code> の SSE ストリーム
で動いています。独自のダッシュボードやアラート規則を作りたい場合は
自分で購読してください。</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': 'マーケットプレイス ― ハンドルの売買',
  'marketplace.description':
    'Airweb のハンドルを閲覧・入札。売り手は不要になった名前を出品し、' +
    '買い手は理想のサブドメインを手に入れます。',
  'marketplace.html': `
<h1>マーケットプレイス</h1>
<p class="lead"><a href="{{APEX}}/marketplace">マーケットプレイス</a>は
ハンドルが持ち主を変える場所です。あえて小さく作っています ― 検索、クリック、
購入で、あなたのもの。</p>

<h2>ハンドルを出品する</h2>
<ol>
  <li>ダッシュボードでリース中のハンドルを 1 つ開きます。</li>
  <li><em>List for sale</em> をクリックし AWB で価格を設定します。</li>
  <li>出品はすぐにマーケットプレイスに表示されます。</li>
  <li>誰かが購入するとクレジットがあなたのアカウントに移り、残りのリース
      期間が買い手へ引き継がれます。</li>
</ol>

<h2>出品ルール</h2>
<ul>
  <li>所有しているハンドルのみ出品可能。</li>
  <li>基盤のリースが切れると出品も消えます。</li>
  <li>マーケットプレイスは手数料を取りません ― 表示価格 = 売値です。</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (認証必須)</code></pre>
<p>完全なスキーマは <a href="/api">API リファレンス</a>を参照してください。</p>
`,

  // ---------- cli ----------
  'cli.title': 'airweb CLI リファレンス',
  'cli.description':
    'airweb コマンドラインラッパーが受け付けるすべてのフラグと、' +
    'HTTP/TCP トンネルの例。',
  'cli.html': `
<h1>CLI リファレンス</h1>
<p class="lead">オプションの <code>airweb</code> ラッパーを使えば SSH の
フラグを覚える必要がありません。
<code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code> でインストールします。</p>

<h2>使い方</h2>
<pre><code>airweb http &lt;localPort&gt; [--sub &lt;name&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;

airweb tcp &lt;localPort&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;</code></pre>

<h2>フラグ</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(必須)</em></dt>
  <dd>Airweb の SSH エンドポイント。例:
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>。</dd>

  <dt><code>--key &lt;path&gt;</code> <em>(必須)</em></dt>
  <dd>ダウンロードした鍵ファイルへのパス。</dd>

  <dt><code>--sub &lt;name&gt;</code></dt>
  <dd>HTTP モード専用。公開先のサブドメイン。指定しないとランダム名になります。</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>TCP モード専用。特定の公開ポートをサーバーに要求します。省略すると
      サーバーが選びます。</dd>

  <dt><code>--user &lt;name&gt;</code></dt>
  <dd>SSH ユーザー名を上書き。サブドメインと異なる必要があるときに便利。</dd>

  <dt><code>--help</code></dt>
  <dd>使い方を表示します。</dd>
</dl>

<h2>例</h2>
<pre><code># お気に入りサブドメインで React 開発サーバー
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# 指定の公開ポートで Postgres
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'HTTP API リファレンス',
  'api.description':
    'Airweb が公開しているすべての JSON エンドポイント ― 認証、残高と元帳、' +
    'ハンドルマーケットプレイス、管理者テレメトリ。',
  'api.html': `
<h1>HTTP API</h1>
<p class="lead">すべてのエンドポイントは <code>application/json</code> で、
<code>{{APEX}}/api</code> 配下にあります。認証は Cookie ベース ―
<code>POST&nbsp;/api/login</code> または <code>POST&nbsp;/api/register</code>
でログインすると、サーバーが <code>.{{PUBLIC_DOMAIN_BASE}}</code> にスコープ
されたセッション Cookie を設定します。</p>

<h2>認証</h2>
<table class="api">
  <thead><tr><th>メソッド</th><th>パス</th><th>備考</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>アカウント作成、セッション Cookie 設定、鍵ダウンロード URL を返却。</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>ユーザー名と鍵署名でログイン。</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>セッション Cookie をクリア。</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>サインインユーザーのプロフィール、残高、リース概要。</td></tr>
  </tbody>
</table>

<h2>公開コンフィグ</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>クレジット</h2>
<pre><code>GET /api/ledger        # 認証必須
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>マーケットプレイス</h2>
<table class="api">
  <thead><tr><th>メソッド</th><th>パス</th><th>備考</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>オープンな出品をすべて閲覧。</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>出品者で絞り込み。</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>所有ハンドルを出品。</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>空き名のリースまたは保有ハンドルの更新。</td></tr>
  </tbody>
</table>

<h2>エラー</h2>
<p>すべてのエンドポイントは失敗時に <code>error</code> フィールドを持つ
JSON と適切な HTTP ステータスを返します。バリデーションエラーは 400、
認証必須は 401、課金必須は 402、リソース不在は 404、レート制限は 429 です。</p>
`,

  // ---------- security ----------
  'security.title': 'セキュリティモデルとベストプラクティス',
  'security.description':
    'Airweb がクライアントをどう認証し、トンネルをどう隔離し、' +
    'ユーザーデータをどう保護するか ― 加えて公開するサービスを' +
    '堅牢にするベストプラクティス。',
  'security.html': `
<h1>セキュリティモデル</h1>
<p class="lead">短く正直な脅威モデル: Airweb が何をするか、何をしないか、
そしてどう安全に使うか。</p>

<h2>認証</h2>
<p>SSH 鍵ペア認証のみ ― パスワードはサーバー側で無効化されています。
鍵は登録時にサーバーで生成され、一度だけダウンロードされます。失くすと
アカウントへのアクセスを失います。再発行はできません（こちらでは保存して
いないため）。</p>

<h2>アカウントごとの隔離</h2>
<p>サブドメインと TCP ポートは登録したアカウントが所有します。リースされた
名前を別クライアントがバインドしようとすると、<code>tcpip-forward</code>
ハンドシェイクで拒否されます。</p>

<h2>Airweb から見えるもの</h2>
<ul>
  <li>トンネルを流れるバイトは公開ルーターを通ります。ルーターはリクエスト
      ボディは記録せず、カウンタのみ記録します。</li>
  <li>自分側で TLS 終端しない HTTP をトンネルする場合、ルーターはルーティング
      中に平文リクエストをメモリ上で見ます。</li>
  <li>エンドツーエンド TLS が必要な場合は、サービス内で TLS を終端し、
      暗号化済みバイトを TCP トンネルで流してください。</li>
</ul>

<h2>公開するサービスのベストプラクティス</h2>
<ul>
  <li><strong>インターネットは敵だと思え。</strong>「社内用」プロトタイプにも
      認証を付けましょう。</li>
  <li>影響の大きいエンドポイントには<strong>レート制限</strong>を。</li>
  <li>侵害が疑われたら<strong>鍵をローテーション</strong> ― ダッシュボード
      から古いアカウントを削除して新規作成します。</li>
  <li>特定のデモやトークに紐づくものは自動的に失効するよう
      <strong>短命なハンドル</strong>を使いましょう。</li>
</ul>

<h2>脆弱性の報告</h2>
<p>脆弱性を見つけたら
<code>security@{{PUBLIC_DOMAIN_BASE}}</code> までメールを。
責任ある開示を行い、報告者を公に謝辞します。</p>
`,

  // ---------- faq ----------
  'faq.title': 'よくある質問',
  'faq.description':
    'Airweb のよくある質問への手短な回答: ngrok との比較、セルフホストの' +
    '可否、独自ドメイン、無料枠など。',
  'faq.html': `
<h1>よくある質問</h1>

<h3>ngrok や Cloudflare Tunnel と比べてどう?</h3>
<p>Airweb のトランスポートはただの OpenSSH ― 独自プロトコルもクライアント
バイナリもカーネルモジュールもありません。代わりに ngrok 風のインスペクト
UI や Cloudflare のエッジネットワークは付属しません。「あらゆるファイア
ウォール越しに ssh が通る」で十分なら、Airweb はよりシンプルな答えです。</p>

<h3>自分の Airweb サーバーを動かせる?</h3>
<p>はい ― リポジトリはホスティングサービスを動かしているのと同じコードです。
クローンし、<code>config.default.json</code> を <code>config.json</code> に
コピーして、<code>AIRWEB_PUBLIC_DOMAIN</code> を設定し
<code>npm start</code>。DNS は <code>*.your-domain</code> をホストへ向ける
ワイルドカード A レコードが必要です。</p>

<h3>ホスティングサービスに無料枠は?</h3>
<p>はい ― すべてのアカウントは、短いハンドルを 1 か月リースしつつ、その
あいだ匿名トンネルを好きなだけ動かせる程度のクレジットで始まります。</p>

<h3>独自ドメインは使える?</h3>
<p>ホスティング版ではまだ ― ハンドルはメインの公開ドメイン配下に存在します。
セルフホスト版ではもちろん自分が管理する任意のワイルドカードを構成できます。</p>

<h3>ネットワークが切れたらトンネルはどうなる?</h3>
<p>ラッパーを使っていれば SSH クライアントが <code>ServerAliveInterval</code>
で自動リトライします。素の <code>ssh</code> なら
<code>-o&nbsp;ServerAliveInterval=30</code> を付けるか、コマンドを
<code>autossh</code> でラップして同じ挙動を得られます。</p>

<h3>HTTP/2 や HTTP/3 はサポート?</h3>
<p>公開エッジは HTTP/1.1 と HTTP/2 を話します。HTTP/3（QUIC）は UDP が必要
でロードマップ上です。オリジンは何を話しても構いません ― プロキシは
トンネル区間で HTTP/1.1 に正規化します。</p>

<h3>本番トラフィックに使える?</h3>
<p>使っている人はいますが、何を買っているのか理解しましょう。単一の SSH
セッションは単一障害点です。本格的な本番にはマルチリージョン、ロード
バランサ配下のアクティブ/アクティブセッションのセルフホスト構成を推奨します。</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': 'Airweb のよくあるエラーの対処',
  'troubleshooting.description':
    'よく遭遇するエラーへのレシピ: フォワード失敗、ポート使用中、鍵パーミッション、' +
    '会社プロキシなど。',
  'troubleshooting.html': `
<h1>トラブルシュート</h1>

<h2 id="forwarding-failed">「Remote forwarding failed」</h2>
<p>サーバーが要求したポートのバインドを拒否しました。よくある原因:</p>
<ul>
  <li>他の誰か（または直前の SSH セッション）がそのサブドメインや TCP
      ポートをまだ持っている。少し待って再試行。</li>
  <li>特権ポート（&lt; 1024）を要求したがハンドル所有者ではない。ポート 80
      （特別扱い）または 1024 以上を使ってください。</li>
  <li>ハンドルが他アカウントによってリースされている。別の名前を選ぶか、
      <a href="{{APEX}}/marketplace">マーケットプレイス</a>でリースしてください。</li>
</ul>

<h2 id="permission-denied">「Permission denied (publickey)」</h2>
<ul>
  <li><code>-i</code> のパスがダウンロードしたファイルを指しているか確認。</li>
  <li>macOS/Linux では鍵ファイルに <code>chmod 600</code> を ― SSH は
      誰でも読める秘密鍵を拒否します。</li>
  <li>誤った鍵を最初に出してくる忙しい <code>ssh-agent</code> がある場合は
      <code>-o&nbsp;IdentitiesOnly=yes</code> を追加。</li>
</ul>

<h2 id="corporate-proxy">会社プロキシの背後で</h2>
<p>外向きポート {{SSH_PORT}} が塞がれているなら <code>corkscrew</code> や
<code>ProxyCommand</code> でプロキシ越しに SSH を実行できます:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">Webhook 受信が二重になる</h2>
<p>おそらく 2 つの SSH セッションが同じサブドメインを主張しています。
<a href="{{APEX}}/connections">接続ページ</a>を確認 ― 同名の行が 2 つ
あれば片方を終了してください。</p>

<h2 id="https-redirect">「サイトに HTTPS が無い」</h2>
<p>ホスティング版ではすべてのサブドメインが <code>http</code> と
<code>https</code> の両方で配信されます。サービス自身が <code>http://</code>
へリダイレクトする場合は、「external URL」設定を
<code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code> にしてください。</p>

<h2>デバッグ出力を増やす</h2>
<p><code>ssh</code> コマンドに <code>-vvv</code> を付けると、ハンドシェイクの
詳細ログがすべて見られます。「動かない」の報告のほとんどはこのログを
共有することで解決します。</p>
`,

  // ---------- changelog ----------
  'changelog.title': '変更履歴',
  'changelog.description':
    'Airweb のバージョン横断の主要な変更 ― 機能、互換破壊、セキュリティ修正。',
  'changelog.html': `
<h1>変更履歴</h1>
<p class="lead">後方互換を壊す変更は <strong>BREAKING</strong> と
明示します。日付はホスティングサービスへ反映された時点です。</p>

<h3>2026-05 ― 統一ヘッダーと共有設定</h3>
<ul>
  <li>ランディング、ダッシュボード、マーケットプレイス、接続、ドキュメント
      にわたって 1 つのヘッダーデザイン。</li>
  <li>テーマ、言語、通貨が <code>.{{PUBLIC_DOMAIN_BASE}}</code> にスコープ
      された Cookie で永続化され、すべてのサブドメインに引き継がれます。</li>
</ul>

<h3>2026-03 ― リアリスティックな報酬経済</h3>
<ul>
  <li>スターターインベントリを「実際に有用なアイテム」中心に再調整。</li>
  <li>レベル証明書の修正: タイトル変更時だけでなく、毎レベル昇格時に
      付与されるように。</li>
</ul>

<h3>2025-12 ― 内部サーバー CORS</h3>
<ul>
  <li>このドキュメントサイトのような内部サービスから、別サブドメインの
      apex API を呼べるようになりました。
      <strong>BREAKING</strong>: 同一オリジン前提で
      <code>/api/me</code> を叩いていたスクリプトは
      <code>credentials:&nbsp;'include'</code> を送る必要があります。</li>
</ul>

<h3>2025-09 ― ハンドルマーケットプレイス</h3>
<ul>
  <li>マーケットプレイス公開。ハンドルのリース、出品、譲渡。</li>
</ul>
`,
};
