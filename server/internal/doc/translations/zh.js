// Simplified Chinese (zh) translations for Airweb docs.
module.exports = {
  'getting-started.label': '入门',
  'tunneling.label':       '隧道',
  'platform.label':        '平台',
  'reference.label':       '参考',

  // ---------- introduction ----------
  'introduction.title': 'Airweb 简介',
  'introduction.description':
    'Airweb 让一条 SSH 命令变成一个公开的 HTTPS URL。' +
    '了解 Airweb 是什么、反向 SSH 隧道如何工作,' +
    '以及为什么它是将本地服务分享到全世界最快的方式。',
  'introduction.html': `
<h1>什么是 Airweb?</h1>
<p class="lead">Airweb 是一个反向隧道服务,只需 <code>ssh</code> 命令就可以
将笔记本或私有网络中运行的任何服务暴露到公开互联网。无需安装代理 ——
如果你装了 OpenSSH(现代 macOS、Linux 和 Windows 都自带),那你已经具备了
全部所需。</p>

<h2>工作原理</h2>
<p>当你对 Airweb 运行 <code>ssh&nbsp;-R</code> 时,SSH 服务器会接受客户端的
<em>反向端口转发</em>请求,并为你绑定一个公开监听端口。到达该监听器的
流量会通过已有的 SSH 连接送回你机器上的端口。</p>
<ul>
  <li>对于 HTTP,公开监听器是 <code>{{PUBLIC_DOMAIN}}</code> 上共享的
      80/443 反向代理,按子域名路由。</li>
  <li>对于原生 TCP,服务器(或你)选择一个专用端口,字节原样转发。</li>
</ul>

<h2>人们为什么使用 Airweb</h2>
<ul>
  <li><strong>零安装。</strong>不需要客户端二进制、内核模块或浏览器扩展。
      只要 OpenSSH 和一个密钥文件就够了。</li>
  <li><strong>真正的公开 URL。</strong>你会得到
      <code>https://&lt;name&gt;.{{PUBLIC_DOMAIN}}</code> —— 对 webhook、
      移动测试、OAuth 回调、演示和 IoT 都很有用。</li>
  <li><strong>永久句柄。</strong>在
      <a href="{{APEX}}/marketplace">市场</a>上租用一个名字,别人就拿不走。</li>
  <li><strong>可自托管。</strong>运行该服务的每一行代码都在同一个仓库里,
      你可以自己部署。</li>
</ul>

<h2>下一步</h2>
<p>最快体会 Airweb 工作方式的办法是立即发布一个本地 Web 应用。前往
<a href="/quick-start">快速开始</a>指南 —— 你将在两分钟内拥有一个
线上 URL。</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': '快速开始 —— 60 秒打开第一条隧道',
  'quick-start.description':
    '用一条 ssh 命令将本地 HTTP 服务发布到公网。这份分步指南将让你' +
    '在大约一分钟内获得可用的 https URL。',
  'quick-start.html': `
<h1>快速开始</h1>
<p class="lead">三个步骤。一个终端。一个公开 URL。</p>

<h2>1. 创建账户并获取密钥</h2>
<p>访问 <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a> 并点击
<em>Create account</em>。网站会下发一个名为
<code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code> 的文件。这就是你的 SSH 私钥 ——
请妥善保管。</p>
<pre><code># 仅 macOS / Linux —— Windows 可跳过
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. 在本机启动一项服务</h2>
<p>任何说 HTTP 的服务都可以。如果手边没有应用:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. 打开隧道</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>现在用浏览器访问 <code>http://myapp.{{PUBLIC_DOMAIN}}</code>。请求会
出现在本地服务器的终端。按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 即可下线该 URL。</p>

<h2>各参数含义</h2>
<dl>
  <dt><code>-i &lt;file&gt;</code></dt>
  <dd>你下载的私钥文件。</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Airweb 的 SSH 服务监听 {{SSH_PORT}} 端口(不是 22)。</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>将公网 HTTP 端口反向转发到本机 3000。</dd>
  <dt><code>myapp@…</code></dt>
  <dd>SSH 用户名即为你要发布的子域名。</dd>
</dl>

<h2>接下来</h2>
<ul>
  <li><a href="/http-tunnels">同时发布多个应用</a></li>
  <li><a href="/tcp-tunnels">暴露数据库或游戏服务器(原生 TCP)</a></li>
  <li><a href="/handles">通过句柄租约预约一个永久名字</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': '安装 Airweb 客户端',
  'installation.description':
    'Airweb 在 macOS、Linux 和 Windows 上都依赖系统自带的 OpenSSH。' +
    '你也可以使用可选的 `airweb` Node.js 包装器以获得更友好的命令。' +
    '下面介绍两种安装方法。',
  'installation.html': `
<h1>安装</h1>
<p class="lead">Airweb 的"客户端"就是你电脑上已有的 <code>ssh</code> 二进制。
如果你想要稍微更友好的命令行,我们还提供一个可选的 Node.js 包装器。</p>

<h2>第 1 步 —— 确认装有 OpenSSH</h2>
<ul>
  <li><strong>macOS</strong>: 自远古以来就预装。用 <code>ssh -V</code> 验证。</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) 或你所在发行版的等价命令。</li>
  <li><strong>Windows 10/11</strong>: OpenSSH 作为可选功能提供。
      在 PowerShell:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>第 2 步 —— 下载密钥</h2>
<p>登录 <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>。私钥仅提供一次
下载机会。请像对待密码一样对待它 —— 拿到该文件的人都可以以你的账户发布。</p>

<h2>第 3 步 ——(可选)安装 airweb 包装器</h2>
<p><code>airweb</code> 包装器会替你拼出正确的 <code>ssh</code> 命令,并把
公开 URL 直接打印出来。用 npm 全局安装:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>然后这样使用:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>安装问题排查</h2>
<ul>
  <li><strong>"<code>ssh</code> not found"</strong> —— 确认 OpenSSH 在
      <code>PATH</code> 中。Windows 安装可选功能后请重开终端。</li>
  <li>macOS/Linux 上 <strong>"Permissions are too open"</strong> —— 对密钥
      文件执行 <code>chmod 600</code>。</li>
  <li><strong>公司代理?</strong> SSH 可通过
      <code>-o&nbsp;ProxyCommand</code> 在 HTTPS 上做隧道。详见
      <a href="/troubleshooting#corporate-proxy">问题排查</a>。</li>
</ul>
`,

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'HTTP 隧道 —— 分享 Web 应用',
  'http-tunnels.description':
    '关于 Airweb HTTP 隧道的详细参考: 子域名选择、请求流程、WebSocket、' +
    '主机头、自定义路径以及在同一账号下并发多条隧道。',
  'http-tunnels.html': `
<h1>HTTP 隧道</h1>
<p class="lead">向 Airweb 请求 <code>-R 80:localhost:&lt;port&gt;</code> 时,
服务器并不会真的为你绑定 80 端口 —— 那样每台机器只能有一条隧道。Airweb 的
HTTP 路由器会把 <em>SSH 用户名</em>当作子域名,并按 Host 头路由。</p>

<h2>请求流程</h2>
<ol>
  <li>访客打开 <code>https://myapp.{{PUBLIC_DOMAIN}}</code>。</li>
  <li>公共 HTTP 路由器收到请求并检查 <code>Host</code> 头。</li>
  <li>它找到注册在 <code>myapp</code> 子域上的隧道,请求 SSH 连接打开新通道。</li>
  <li>你的 <code>ssh</code> 客户端接收通道并把字节转发到
      <code>localhost:&lt;port&gt;</code>。</li>
  <li>响应沿同一条路返回。</li>
</ol>

<h2>选择子域名</h2>
<p>子域名就是 SSH 用户名:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>任何未被租用的名字都可以使用。如果想要永远不被别人占用的名字,
请在市场上租用 <a href="/handles">句柄</a>。</p>

<h2>WebSocket 与流式</h2>
<p>连接在 HTTP/1.1 <code>Upgrade</code> 握手之后仍然存活,因此 WebSocket
与 Server-Sent Events 隧道开箱即用。服务前没有任何缓冲层 —— 字节到达
后立即转发。</p>

<h2>同时多条隧道</h2>
<p>开多少 SSH 会话都可以,每条都有自己的子域名。前端开发者常见的两终端
模式:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>只要子域名保持不变,两边的 OAuth 回调即使重启也仍然能用。</p>

<h2>Host 头与基础路径</h2>
<p>请求在转发时会把原始 <code>Host</code> 改写成公网主机名。大多数框架
都能接受;若你的框架从硬编码主机生成绝对 URL,请把它的 "trusted host" 或
"external URL" 设为 <code>myapp.{{PUBLIC_DOMAIN}}</code>。</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'TCP 隧道 —— 数据库、游戏服务器等',
  'tcp-tunnels.description':
    '通过 Airweb 反向隧道转发任意 TCP 流量 —— Postgres、Redis、Minecraft、跳板 SSH 等。',
  'tcp-tunnels.html': `
<h1>TCP 隧道</h1>
<p class="lead">HTTP 是常见情况,但 Airweb 可以承载任意 TCP 协议。
在 <code>-R</code> 中请求 80 之外的端口,服务器就会为你绑定一个专用 TCP
监听器。</p>

<h2>指定端口或交给服务器</h2>
<pre><code># 请求特定端口
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# 让服务器挑选空闲端口(端口 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p>若传入 <code>0</code>,请留意 SSH 横幅 —— 分配的端口会打印在那里,
并显示在你的 <a href="{{APEX}}/connections">连接</a>仪表板上。</p>

<h2>客户端连接</h2>
<p>公开地址为 <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code>:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>UDP 呢?</h2>
<p>SSH 只懂 TCP。对于 UDP 服务(DNS、QUIC、绝大多数实时游戏),你可以
两端用类似 <em>udp-over-tcp</em> 的方式包成 TCP 隧道,或在 HTTP 隧道上跑
一个小型 WireGuard 中继。</p>

<h2>安全警告</h2>
<p>原生 TCP 隧道继承了底层服务自身的认证。
<strong>切勿把无认证数据库暴露到公网</strong>,哪怕"只是一会儿"。先加密码,
再在外面套一层防火墙。</p>
`,

  // ---------- handles ----------
  'handles.title': '句柄 —— 租用永久子域名',
  'handles.description':
    '句柄是一种只有你的账户可以发布到的预留子域名。了解如何在 Airweb' +
    '市场上对句柄出价、租用和续约。',
  'handles.html': `
<h1>句柄</h1>
<p class="lead">默认情况下子域名是先到先得。你一断开,名字立刻就空出来。
<strong>句柄</strong>则是租约 —— 你支付少量信用点预订一个名字,只有
你的账户能在它上面发布。</p>

<h2>租用方式</h2>
<ol>
  <li>在 <a href="{{APEX}}/marketplace">市场</a>上搜索某个名字。</li>
  <li>若未被租用,你可以按列出的月度价格抢下。热门名字价格更高。</li>
  <li>租约期间,其他账号尝试以该用户名发起的所有 SSH 会话都会被拒绝。</li>
  <li>到期前一键续约。若让句柄过期,会在短暂宽限期后回到池中。</li>
</ol>

<h2>为何要租?</h2>
<ul>
  <li><strong>稳定的 webhook。</strong>GitHub、Stripe、Slack 等只需配置一次。</li>
  <li><strong>品牌。</strong><code>https://yourname.{{PUBLIC_DOMAIN}}</code>
      比随机字符串更便于分享。</li>
  <li><strong>安全。</strong>你睡觉时别人也无法占走名字。</li>
</ul>

<h2>充值信用点</h2>
<p>租金以信用点(AWB)计价。可在 <a href="{{APEX}}/dashboard">仪表板</a>上
购买更多。当前价格请见 <a href="/credits">信用点指南</a>。</p>
`,

  // ---------- credits ----------
  'credits.title': '信用点、计费与 AWB 经济',
  'credits.description':
    '信用点(AWB)是 Airweb 内部的价值单位 —— 用于句柄租约、高级子域名' +
    '与给创作者打赏。了解经济运行方式及如何充值。',
  'credits.html': `
<h1>信用点与计费</h1>
<p class="lead">Airweb 内部任何带价的东西都以
<strong>Airweb 信用点(AWB)</strong>计价。这只是简单的内部记账单位 ——
不涉及任何区块链。</p>

<h2>如何获得信用点</h2>
<ul>
  <li><strong>免费起始余额。</strong>每个新账户都附带一笔小额余额,足以
      免费租下你的第一个句柄。</li>
  <li><strong>充值。</strong>在仪表板购买更多。</li>
  <li><strong>托管赚取。</strong>只要保持隧道在线,在线计时器每分钟会向
      你的余额滴入一点津贴。</li>
  <li><strong>市场。</strong>卖掉你不再需要的句柄。</li>
</ul>

<h2>如何花费信用点</h2>
<ul>
  <li>租用句柄(周期性)。</li>
  <li>预留 TCP 端口段等高级选项。</li>
  <li>向其他账户直接打赏。</li>
</ul>

<h2>美元估值</h2>
<p>站内所有头部都会在余额旁显示美元估值。汇率按部署设置,经
<code>GET&nbsp;{{APEX}}/api/config</code> 暴露。它是<em>估值</em>而非
官方汇率 —— 不能把信用点换成现金。</p>

<h2>账本</h2>
<p>每一笔信用点变动都记录在仅追加的账本里,可随时查看:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>仪表板用更友好的标签渲染相同数据。</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': '仪表板 —— 你的 Airweb 主基地',
  'dashboard.description':
    '在 Airweb 仪表板内管理隧道、句柄、信用点与账户设置。逐面板巡视、' +
    '掌握每个快捷键。',
  'dashboard.html': `
<h1>仪表板</h1>
<p class="lead">在 <a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>
登录,你会落到一个能纵览账户里所有事的单页面。</p>

<h2>实时隧道</h2>
<p>顶部面板列出当前绑定到你账户的所有隧道 —— 子域名或 TCP 端口、连接
时长、传输字节。点击行可复制公开 URL。</p>

<h2>句柄</h2>
<p>你拥有的租约会带着到期日列出来。续约只需一次点击。</p>

<h2>信用点</h2>
<p>余额、今日赚取速率、近期活动的迷你图。
<a href="/credits">了解更多关于信用点的内容。</a></p>

<h2>顶部样式</h2>
<p>顶部头部在所有 Airweb 页面(仪表板、市场、连接、文档以及任何内部
服务)上保持一致。齿轮图标可打开主题、语言、货币设置 —— 你的偏好保存
在范围为 <code>.{{PUBLIC_DOMAIN_BASE}}</code> 的 Cookie 中,因此会跟随你
横跨所有子域名。</p>
`,

  // ---------- connections ----------
  'connections.title': '连接页 —— 实时隧道遥测',
  'connections.description':
    '查看进入 Airweb 集群的每一条活动 SSH 隧道 —— 你的与公开的 ——' +
    '附带实时入站/出站字节数和来源信息。',
  'connections.html': `
<h1>连接</h1>
<p class="lead"><a href="{{APEX}}/connections">/connections</a> 页面以实时
方式流式展示每一条活动隧道。</p>

<h2>列</h2>
<dl>
  <dt>子域名 / 端口</dt><dd>外部所见的内容。</dd>
  <dt>来源</dt><dd>SSH 会话建立时的 IP 地址(非管理员看到的是脱敏值)。</dd>
  <dt>运行时长</dt><dd>会话已活动的时间。</dd>
  <dt>入/出 字节</dt><dd>隧道生命周期内的累积流量。</dd>
</dl>

<h2>公开 vs. 私有行</h2>
<p>任何人都能看到 <code>foo.{{PUBLIC_DOMAIN}}</code> 上<em>存在</em>一条隧道 ——
共享域名的本意如此 —— 但来源 IP 与用户名等元数据只有所有者与管理员可见。</p>

<h2>Server-Sent Events</h2>
<p>该页面由 <code>{{APEX}}/api/connections/events</code> 的 SSE 流驱动。
若你想构建自定义仪表板或告警规则,可自行订阅。</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': '市场 —— 句柄买卖',
  'marketplace.description':
    '浏览并出价 Airweb 句柄。卖家挂出不再需要的名字;买家拿到完美子域名。',
  'marketplace.html': `
<h1>市场</h1>
<p class="lead"><a href="{{APEX}}/marketplace">市场</a>是句柄易手之处。
我们刻意把它做得很小 —— 搜索、点击购买,它就归你了。</p>

<h2>挂出句柄</h2>
<ol>
  <li>在仪表板里打开你租用的一个句柄。</li>
  <li>点击 <em>List for sale</em> 并以 AWB 设价。</li>
  <li>挂牌会立即出现在市场上。</li>
  <li>有人购买时,信用点划入你的账户,剩余租约转移给对方。</li>
</ol>

<h2>挂牌规则</h2>
<ul>
  <li>只能挂当前持有的句柄。</li>
  <li>底层租约到期时挂牌也随之到期。</li>
  <li>市场不抽佣 —— 挂牌价即成交价。</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (需认证)</code></pre>
<p>完整结构请见 <a href="/api">API 参考</a>。</p>
`,

  // ---------- cli ----------
  'cli.title': 'airweb 命令行参考',
  'cli.description':
    'airweb 命令行包装器接受的所有参数,以及 HTTP 与 TCP 隧道示例。',
  'cli.html': `
<h1>命令行参考</h1>
<p class="lead">可选的 <code>airweb</code> 包装器免去了你记忆 SSH 参数。
用 <code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code> 安装。</p>

<h2>用法</h2>
<pre><code>airweb http &lt;localPort&gt; [--sub &lt;name&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;

airweb tcp &lt;localPort&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;</code></pre>

<h2>参数</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(必填)</em></dt>
  <dd>Airweb 的 SSH 接入点,例如
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>。</dd>

  <dt><code>--key &lt;path&gt;</code> <em>(必填)</em></dt>
  <dd>你下载的密钥文件路径。</dd>

  <dt><code>--sub &lt;name&gt;</code></dt>
  <dd>仅 HTTP 模式。要发布到的子域名。不指定则使用随机名。</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>仅 TCP 模式。向服务器请求特定的公开端口。省略则由服务器分配。</dd>

  <dt><code>--user &lt;name&gt;</code></dt>
  <dd>覆盖 SSH 用户名。当用户名需要与子域名不同的场景很有用。</dd>

  <dt><code>--help</code></dt>
  <dd>打印用法。</dd>
</dl>

<h2>示例</h2>
<pre><code># 在指定子域上跑 React 开发服务器
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# 在选定的公开端口上跑 Postgres
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'HTTP API 参考',
  'api.description':
    'Airweb 暴露的每个 JSON 端点 —— 包括认证、余额与账本、句柄市场及' +
    '管理员遥测。',
  'api.html': `
<h1>HTTP API</h1>
<p class="lead">所有端点均为 <code>application/json</code>,位于
<code>{{APEX}}/api</code> 之下。认证基于 Cookie —— 通过
<code>POST&nbsp;/api/login</code> 或 <code>POST&nbsp;/api/register</code>
登录后,服务器会设置范围为 <code>.{{PUBLIC_DOMAIN_BASE}}</code> 的会话 Cookie。</p>

<h2>认证</h2>
<table class="api">
  <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>创建账户、设置会话 Cookie、返回密钥下载 URL。</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>使用用户名 + 密钥签名登录。</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>清除会话 Cookie。</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>登录用户的资料、余额与租约概况。</td></tr>
  </tbody>
</table>

<h2>公开配置</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>信用点</h2>
<pre><code>GET /api/ledger        # 需认证
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>市场</h2>
<table class="api">
  <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>浏览所有公开挂牌。</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>按卖家过滤。</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>把你持有的句柄挂出售卖。</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>租用空闲名字或续约你已有的句柄。</td></tr>
  </tbody>
</table>

<h2>错误</h2>
<p>所有端点在失败时返回带 <code>error</code> 字段的 JSON 与合适的 HTTP
状态码。校验错误为 400、需认证 401、需付费 402、资源缺失 404、限流 429。</p>
`,

  // ---------- security ----------
  'security.title': '安全模型与最佳实践',
  'security.description':
    'Airweb 如何认证客户端、隔离隧道并保护用户数据 —— 以及加固你所' +
    '暴露服务的最佳实践。',
  'security.html': `
<h1>安全模型</h1>
<p class="lead">一份简短诚实的威胁模型: Airweb 做什么、不做什么,
以及如何安全使用。</p>

<h2>认证</h2>
<p>仅支持 SSH 密钥对认证 —— 密码在服务端被禁用。密钥在注册时由服务端
生成、一次性下载。丢失后将失去账户访问权,无法重新颁发(我们从未存过)。</p>

<h2>账户隔离</h2>
<p>子域名与 TCP 端口归注册账户所有。其他客户端尝试绑定已租用的名字时,
会在 <code>tcpip-forward</code> 握手阶段被拒绝。</p>

<h2>Airweb 能看到什么</h2>
<ul>
  <li>流经隧道的字节会经过公共路由器。路由器从不记录请求体,只记计数器。</li>
  <li>若你在自己端未终止 TLS 而走 HTTP,路由器在路由期间会在内存中看到
      明文请求。</li>
  <li>需要端到端 TLS,请在服务内部终止 TLS,然后通过 TCP 隧道传输已加密
      的字节。</li>
</ul>

<h2>你所暴露服务的最佳实践</h2>
<ul>
  <li><strong>把互联网当作敌对的。</strong>哪怕"内部"原型也要加认证。</li>
  <li>对副作用严重的接口做<strong>速率限制</strong>。</li>
  <li>若怀疑泄漏请<strong>轮换密钥</strong> —— 从仪表板删除旧账户再新建。</li>
  <li>给绑定特定演示或讲座的内容使用<strong>短生命周期的句柄</strong>,
      让它们自动失效。</li>
</ul>

<h2>报告问题</h2>
<p>发现漏洞?请发邮件到
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>。我们负责任地披露,并公开
致谢报告者。</p>
`,

  // ---------- faq ----------
  'faq.title': '常见问题',
  'faq.description':
    '关于 Airweb 最常被问到的快速解答: 与 ngrok 的对比、能否自托管、' +
    '自定义域名、免费额度等等。',
  'faq.html': `
<h1>常见问题</h1>

<h3>Airweb 与 ngrok 或 Cloudflare Tunnel 相比如何?</h3>
<p>Airweb 的传输层就是普通 OpenSSH —— 没有专有协议、没有客户端二进制、
没有内核模块。代价是不提供 ngrok 风格的检查 UI 与 Cloudflare 的边缘
网络。如果"ssh 在所有防火墙后都能跑通"对你来说已经够用,Airweb 就是
更简单的答案。</p>

<h3>能跑自己的 Airweb 服务器吗?</h3>
<p>可以 —— 仓库就是托管服务运行的同一份代码。克隆它,把
<code>config.default.json</code> 复制为 <code>config.json</code>,设置
<code>AIRWEB_PUBLIC_DOMAIN</code>,然后 <code>npm start</code>。DNS 上你
需要把 <code>*.your-domain</code> 通配 A 记录指向主机。</p>

<h3>托管服务有免费额度吗?</h3>
<p>有 —— 每个新账户都附带足够租下一个短句柄一个月、并在此期间随便开
匿名隧道的信用点。</p>

<h3>能用自己的域名吗?</h3>
<p>在托管服务上暂时不行 —— 句柄存在于主公开域名之下。在自托管实例上
当然可以自由配置你掌控的任何通配。</p>

<h3>网络断掉时隧道怎么办?</h3>
<p>如果你用了包装器,SSH 客户端会用 <code>ServerAliveInterval</code> 自动
重试。用裸 <code>ssh</code> 也可以加
<code>-o&nbsp;ServerAliveInterval=30</code> 得到同样行为,或用
<code>autossh</code> 包装命令。</p>

<h3>Airweb 支持 HTTP/2 或 HTTP/3 吗?</h3>
<p>公开边缘讲 HTTP/1.1 与 HTTP/2。HTTP/3 (QUIC) 需要 UDP,在路线图上。
你的源站讲什么协议都可以 —— 代理会在隧道这一跳归一化为 HTTP/1.1。</p>

<h3>能把 Airweb 用于生产流量吗?</h3>
<p>有人这么用,但请理解你在买什么。单一 SSH 会话即是单点。真正的生产
我们建议自托管,多区域、负载均衡后的 active/active 会话。</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': '排查 Airweb 常见错误',
  'troubleshooting.description':
    '修复最常遇到错误的方法: 转发失败、端口已被占、密钥权限、企业代理等。',
  'troubleshooting.html': `
<h1>问题排查</h1>

<h2 id="forwarding-failed">"Remote forwarding failed"</h2>
<p>服务器拒绝绑定你请求的端口。常见原因:</p>
<ul>
  <li>别人(或你上一次的 SSH 会话)还占着该子域名或 TCP 端口。稍等再试。</li>
  <li>你请求了特权端口 (&lt; 1024) 但不是句柄持有者。请使用 80 (特别处理)
      或 1024 以上的端口。</li>
  <li>句柄被其他账户租走了。换个名字,或到
      <a href="{{APEX}}/marketplace">市场</a>租下它。</li>
</ul>

<h2 id="permission-denied">"Permission denied (publickey)"</h2>
<ul>
  <li>再次确认 <code>-i</code> 路径指向你下载的文件。</li>
  <li>macOS/Linux 上对密钥文件执行 <code>chmod 600</code> —— SSH 会拒绝
      可被所有人读取的私钥。</li>
  <li>如果你的 <code>ssh-agent</code> 很忙、总是先报错误的密钥,请加
      <code>-o&nbsp;IdentitiesOnly=yes</code>。</li>
</ul>

<h2 id="corporate-proxy">在公司代理之后</h2>
<p>若出站 {{SSH_PORT}} 端口被封,你可以用 <code>corkscrew</code> 或
<code>ProxyCommand</code> 让 SSH 走代理:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">我的 webhook 接收器响应了两次</h2>
<p>你大概有两个 SSH 会话都在声明同一个子域名。看看
<a href="{{APEX}}/connections">连接页面</a> —— 如果两行同名,杀掉其中
一个。</p>

<h2 id="https-redirect">"网站没有 HTTPS"</h2>
<p>托管服务上的每个子域名都同时通过 <code>http</code> 与 <code>https</code>
提供。若你的服务自己重定向到 <code>http://</code>,请把它的 "external URL"
设为 <code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>。</p>

<h2>获取更多调试输出</h2>
<p>给 <code>ssh</code> 命令加上 <code>-vvv</code> 可以看到完整的握手日志。
大部分"用不了"的反馈分享这段输出就能解决。</p>
`,

  // ---------- changelog ----------
  'changelog.title': '更新日志',
  'changelog.description':
    'Airweb 跨版本的重要变更 —— 新功能、不兼容变更与安全修复。',
  'changelog.html': `
<h1>更新日志</h1>
<p class="lead">破坏性变更以 <strong>BREAKING</strong> 标记。日期为发布到
托管服务的时间。</p>

<h3>2026-05 —— 统一头部与共享设置</h3>
<ul>
  <li>登陆页、仪表板、市场、连接与文档之间使用同一套头部设计。</li>
  <li>主题、语言与货币现在通过范围为 <code>.{{PUBLIC_DOMAIN_BASE}}</code>
      的 Cookie 持久化,会跟随你横跨每个子域名。</li>
</ul>

<h3>2026-03 —— 现实奖励经济</h3>
<ul>
  <li>起始库存调整为提供真正有用的物品,而非随机杂物。</li>
  <li>修复等级证书: 现在每次升级都会发,而不是仅当称号变化时。</li>
</ul>

<h3>2025-12 —— 内部服务的 CORS</h3>
<ul>
  <li>像这个文档站这样的内部服务现在可以从不同子域名调用 apex API。
      <strong>BREAKING</strong>: 此前假定同源去打
      <code>/api/me</code> 的脚本现在必须发送
      <code>credentials:&nbsp;'include'</code>。</li>
</ul>

<h3>2025-09 —— 句柄市场</h3>
<ul>
  <li>市场上线。租用、挂牌与转让句柄。</li>
</ul>
`,
};
