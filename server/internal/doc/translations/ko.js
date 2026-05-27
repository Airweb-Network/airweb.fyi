// Korean (ko) translations for Airweb docs.
module.exports = {
  // ---------- Section labels ----------
  'getting-started.label': '시작하기',
  'tunneling.label':       '터널링',
  'platform.label':        '플랫폼',
  'reference.label':       '참조',

  // ==================================================================
  // Getting started
  // ==================================================================

  // ---------- introduction ----------
  'introduction.title': 'Airweb 소개',
  'introduction.description':
    'Airweb는 SSH 명령 하나로 공개 HTTPS URL을 만들어 줍니다. ' +
    'Airweb가 무엇인지, 리버스 SSH 터널링이 어떻게 작동하는지, ' +
    '그리고 왜 로컬호스트 서비스를 세상에 공유하는 가장 빠른 방법인지 알아보세요.',
  'introduction.html': `
<h1>Airweb란 무엇인가요?</h1>
<p class="lead">Airweb는 노트북이나 사설망에서 실행 중인 어떤 서비스든
<code>ssh</code> 명령 하나만으로 공개 인터넷에 노출시켜 주는
리버스 터널링 서비스입니다. 설치할 에이전트는 없습니다 — OpenSSH가 있다면
(요즘의 모든 macOS, Linux, Windows에 기본 탑재되어 있습니다) 이미 필요한 모든 것이
준비되어 있습니다.</p>

<h2>작동 원리</h2>
<p><code>ssh&nbsp;-R</code>로 Airweb에 접속하면, SSH 서버가 클라이언트로부터
<em>리버스 포트 포워딩</em> 요청을 받아들이고 공개 리스너를 바인딩합니다.
해당 리스너로 들어오는 트래픽은 기존 SSH 연결을 통해 사용자의 기기 포트로
전달됩니다.</p>
<ul>
  <li>HTTP의 경우, 공개 리스너는 <code>{{PUBLIC_DOMAIN}}</code>에서 공유되는
      80/443 리버스 프록시이며, 서브도메인 기준으로 라우팅됩니다.</li>
  <li>순수 TCP의 경우, 서버가 전용 포트를 선택(또는 사용자가 지정)하고
      바이트를 그대로 전달합니다.</li>
</ul>

<h2>사람들이 Airweb를 사용하는 이유</h2>
<ul>
  <li><strong>설치 불필요.</strong> 클라이언트 바이너리, 커널 모듈, 브라우저
      확장 프로그램이 필요 없습니다. OpenSSH와 키 파일만 있으면 됩니다.</li>
  <li><strong>진짜 공개 URL.</strong>
      <code>https://&lt;이름&gt;.{{PUBLIC_DOMAIN}}</code> 형태의 URL을 받습니다 —
      웹훅, 모바일 테스트, OAuth 콜백, 데모, IoT 용도로 유용합니다.</li>
  <li><strong>영구 핸들.</strong>
      <a href="{{APEX}}/marketplace">마켓플레이스</a>에서 이름을 임대해
      다른 사람이 차지할 수 없게 하세요.</li>
  <li><strong>셀프 호스팅 가능.</strong> 이 서비스를 구동하는 모든 코드는
      직접 배포할 수 있는 같은 저장소에 있습니다.</li>
</ul>

<h2>다음 단계</h2>
<p>Airweb가 어떻게 동작하는지 가장 빠르게 체감하는 방법은 지금 바로 로컬
웹 앱을 게시해 보는 것입니다. <a href="/quick-start">빠른 시작</a> 가이드로
이동하세요 — 2분 안에 라이브 URL을 얻을 수 있습니다.</p>
`,

  // ---------- quick-start ----------
  'quick-start.title': '빠른 시작 — 60초 만에 첫 터널 열기',
  'quick-start.description':
    '하나의 ssh 명령으로 로컬 HTTP 서비스를 공개 인터넷에 게시하세요. ' +
    '이 단계별 빠른 시작은 약 1분 안에 작동하는 https URL까지 안내합니다.',
  'quick-start.html': `
<h1>빠른 시작</h1>
<p class="lead">세 단계. 터미널 하나. 공개 URL 하나.</p>

<h2>1. 계정을 만들고 키를 받으세요</h2>
<p><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>에 방문해
<em>계정 만들기</em>를 클릭하세요. <code>{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code>
파일을 다운로드하게 됩니다. 이 파일이 여러분의 SSH 개인 키이니
안전한 곳에 보관하세요.</p>
<pre><code># macOS / Linux 전용 — Windows는 건너뛰어도 됩니다
chmod 600 ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>2. 로컬에서 무언가 실행하세요</h2>
<p>HTTP를 말하는 것이라면 무엇이든 됩니다. 손에 잡히는 앱이 없다면:</p>
<pre><code>python3 -m http.server 3000</code></pre>

<h2>3. 터널을 여세요</h2>
<pre><code>ssh -i ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt \\
    -p {{SSH_PORT}} \\
    -R 80:localhost:3000 \\
    myapp@{{SSH_HOST}}</code></pre>
<p>이제 브라우저에서 <code>http://myapp.{{PUBLIC_DOMAIN}}</code>를 열어 보세요.
로컬 서버의 터미널에 요청이 나타납니다. URL을 내리려면
<kbd>Ctrl</kbd>+<kbd>C</kbd>를 누르세요.</p>

<h2>각 플래그의 의미</h2>
<dl>
  <dt><code>-i &lt;파일&gt;</code></dt>
  <dd>다운로드한 개인 키 파일입니다.</dd>
  <dt><code>-p {{SSH_PORT}}</code></dt>
  <dd>Airweb의 SSH 서버는 {{SSH_PORT}}번 포트에서 실행됩니다(22번이 아닙니다).</dd>
  <dt><code>-R 80:localhost:3000</code></dt>
  <dd>공개 HTTP 포트를 로컬 3000번으로 리버스 포워딩합니다.</dd>
  <dt><code>myapp@…</code></dt>
  <dd>SSH 사용자명이 게시할 서브도메인이 됩니다.</dd>
</dl>

<h2>다음으로</h2>
<ul>
  <li><a href="/http-tunnels">한 번에 여러 앱 게시하기</a></li>
  <li><a href="/tcp-tunnels">데이터베이스나 게임 서버 노출(순수 TCP)</a></li>
  <li><a href="/handles">핸들 임대로 영구 이름 예약</a></li>
</ul>
`,

  // ---------- installation ----------
  'installation.title': 'Airweb 클라이언트 설치',
  'installation.description':
    'Airweb는 macOS, Linux, Windows의 기본 OpenSSH로 동작합니다. ' +
    '더 친근한 명령어가 필요하다면 선택 사양인 `airweb` Node.js 래퍼도 ' +
    '사용할 수 있습니다. 두 가지 설치 방법을 안내합니다.',
  'installation.html': `
<h1>설치</h1>
<p class="lead">Airweb의 "클라이언트"는 컴퓨터에 이미 깔려 있는
<code>ssh</code> 바이너리입니다. 명령줄을 조금 더 깔끔하게 쓰고 싶다면
선택 사양 Node.js 래퍼도 공개되어 있습니다.</p>

<h2>1단계 — OpenSSH 설치 확인</h2>
<ul>
  <li><strong>macOS</strong>: 아주 오래전부터 기본 탑재되어 있습니다.
      <code>ssh -V</code>로 확인하세요.</li>
  <li><strong>Linux</strong>: <code>sudo apt install openssh-client</code>
      (Debian/Ubuntu) 또는 사용 중인 배포판의 동등한 명령을 실행하세요.</li>
  <li><strong>Windows 10/11</strong>: OpenSSH는 선택 사양 기능으로
      제공됩니다. PowerShell에서:
      <pre><code>Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0</code></pre>
  </li>
</ul>

<h2>2단계 — 키 다운로드</h2>
<p><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>에 로그인하세요. 개인 키는
일회성 다운로드로 제공됩니다. 비밀번호처럼 다루세요 — 그 파일을 가진 사람은
누구나 여러분의 계정으로 게시할 수 있습니다.</p>

<h2>3단계 — (선택) airweb 래퍼 설치</h2>
<p><code>airweb</code> 래퍼는 올바른 <code>ssh</code> 명령을 대신 만들어 주고
공개 URL을 앞에 인쇄해 줍니다. npm으로 전역 설치:</p>
<pre><code>npm i -g @airweb/cli</code></pre>
<p>그런 다음 다음과 같이 사용하세요:</p>
<pre><code>airweb http 3000 --sub myapp \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>

<h2>설치 문제 해결</h2>
<ul>
  <li><strong>"<code>ssh</code>를 찾을 수 없음"</strong> — OpenSSH가
      <code>PATH</code>에 있는지 확인하세요. Windows에서는 선택 사양 기능을
      설치한 뒤 터미널을 다시 여세요.</li>
  <li><strong>"권한이 너무 개방됨"</strong>(macOS/Linux) — 키 파일에
      <code>chmod 600</code>을 실행하세요.</li>
  <li><strong>회사 프록시?</strong> SSH는
      <code>-o&nbsp;ProxyCommand</code>로 HTTPS 위에서 터널링할 수 있습니다.
      <a href="/troubleshooting#corporate-proxy">문제 해결</a>을 참고하세요.</li>
</ul>
`,

  // ==================================================================
  // Tunneling
  // ==================================================================

  // ---------- http-tunnels ----------
  'http-tunnels.title': 'HTTP 터널 — 웹 앱 공유',
  'http-tunnels.description':
    'Airweb HTTP 터널의 상세 참조: 서브도메인 선택, 요청 흐름, 웹소켓, ' +
    '호스트 헤더, 커스텀 경로, 한 계정에서의 동시 터널 운용.',
  'http-tunnels.html': `
<h1>HTTP 터널</h1>
<p class="lead">Airweb에 <code>-R 80:localhost:&lt;port&gt;</code>를 요청해도
실제로 서버의 80번 포트가 바인딩되는 것은 아닙니다 — 그러면 한 기기당 터널
하나만 가능할 테니까요. 대신 Airweb의 HTTP 라우터는 <em>SSH 사용자명</em>을
서브도메인으로 사용하고 Host 헤더로 라우팅합니다.</p>

<h2>요청 흐름</h2>
<ol>
  <li>방문자가 <code>https://myapp.{{PUBLIC_DOMAIN}}</code>를 엽니다.</li>
  <li>공개 HTTP 라우터가 요청을 받아 <code>Host</code> 헤더를 확인합니다.</li>
  <li><code>myapp</code> 서브도메인으로 등록된 터널을 찾아 SSH 연결에
      새 채널을 열도록 요청합니다.</li>
  <li>여러분의 <code>ssh</code> 클라이언트가 그 채널을 받아
      <code>localhost:&lt;port&gt;</code>로 바이트를 전달합니다.</li>
  <li>응답은 같은 경로로 되돌아옵니다.</li>
</ol>

<h2>서브도메인 선택</h2>
<p>서브도메인은 곧 SSH 사용자명입니다:</p>
<pre><code>ssh ... -R 80:localhost:3000 <strong>myapp</strong>@{{SSH_HOST}}</code></pre>
<p>현재 임대되지 않은 이름이라면 누구나 사용할 수 있습니다. 다른 누구도
가져갈 수 없는 이름을 원한다면 마켓플레이스에서
<a href="/handles">핸들</a>을 임대하세요.</p>

<h2>웹소켓과 스트리밍</h2>
<p>HTTP/1.1 <code>Upgrade</code> 핸드셰이크 이후에도 연결이 유지되므로,
WebSocket과 Server-Sent Events 터널은 별다른 설정 없이 동작합니다. 서비스
앞단에 버퍼링 계층이 없어 — 바이트는 도착하는 즉시 전달됩니다.</p>

<h2>여러 터널을 동시에</h2>
<p>원하는 만큼 SSH 세션을 열 수 있고, 각각 자신만의 서브도메인을 가집니다.
프론트엔드 개발자에게 흔한 패턴은 두 개의 터미널입니다:</p>
<pre><code># API
ssh ... -R 80:localhost:8000 api@{{SSH_HOST}}

# Frontend
ssh ... -R 80:localhost:3000 web@{{SSH_HOST}}</code></pre>
<p>두 OAuth 콜백 모두 서브도메인만 동일하게 유지하면 재시작에도 계속
작동합니다.</p>

<h2>Host 헤더와 베이스 경로</h2>
<p>요청은 원래의 <code>Host</code>를 공개 호스트 이름과 일치하도록 다시 쓴
상태로 전달됩니다. 대부분의 프레임워크는 이를 받아들입니다. 만약 여러분의
프레임워크가 하드코딩된 호스트로부터 절대 URL을 생성한다면, 프레임워크의
"trusted host" 또는 "external URL" 설정을
<code>myapp.{{PUBLIC_DOMAIN}}</code>로 지정하세요.</p>
`,

  // ---------- tcp-tunnels ----------
  'tcp-tunnels.title': 'TCP 터널 — 데이터베이스, 게임 서버 등',
  'tcp-tunnels.description':
    'Postgres, Redis, Minecraft, 점프박스 SSH 등 임의의 TCP 트래픽을 ' +
    'Airweb 리버스 터널을 통해 전달하세요.',
  'tcp-tunnels.html': `
<h1>TCP 터널</h1>
<p class="lead">HTTP가 가장 흔한 경우이지만, Airweb는 어떤 TCP 프로토콜도
운반할 수 있습니다. <code>-R</code> 플래그에서 80이 아닌 다른 포트를 요청하면
서버가 전용 TCP 리스너를 바인딩해 줍니다.</p>

<h2>포트를 지정하거나 서버에 맡기기</h2>
<pre><code># 특정 포트를 요청
ssh ... -R 5432:localhost:5432 me@{{SSH_HOST}}

# 서버가 비어 있는 포트를 골라 주도록 요청(포트 0)
ssh ... -R 0:localhost:25565 me@{{SSH_HOST}}</code></pre>
<p><code>0</code>을 전달하면 SSH 배너를 확인하세요 — 할당된 포트가
거기에 출력되고 <a href="{{APEX}}/connections">연결</a> 대시보드에도
표시됩니다.</p>

<h2>클라이언트에서 접속</h2>
<p>공개 주소는 <code>{{PUBLIC_DOMAIN_BASE}}:&lt;port&gt;</code> 입니다:</p>
<pre><code>psql "host={{PUBLIC_DOMAIN_BASE}} port=5432 user=postgres ..."

mc-client --server={{PUBLIC_DOMAIN_BASE}}:25565</code></pre>

<h2>UDP는요?</h2>
<p>SSH는 TCP만 이해합니다. UDP 서비스(DNS, QUIC, 대부분의 실시간 게임)는
양쪽에서 <em>udp-over-tcp</em>처럼 TCP 터널로 감싸거나, HTTP 터널 위에
작은 WireGuard 릴레이를 실행할 수 있습니다.</p>

<h2>보안 경고</h2>
<p>순수 TCP 터널은 하위 서비스가 제공하는 인증을 그대로 물려받습니다.
<strong>인증되지 않은 데이터베이스를 절대 공개 인터넷에 노출하지 마세요</strong> —
"잠깐만"이라도요. 비밀번호를 추가하고, 그 위에 방화벽 한 겹을 더 두세요.</p>
`,

  // ---------- handles ----------
  'handles.title': '핸들 — 영구 서브도메인 임대',
  'handles.description':
    '핸들은 여러분의 계정만 게시할 수 있는 예약된 서브도메인입니다. ' +
    'Airweb 마켓플레이스를 통해 핸들에 입찰, 임대, 갱신하는 방법을 알아보세요.',
  'handles.html': `
<h1>핸들</h1>
<p class="lead">기본적으로 서브도메인은 선착순입니다. 연결을 끊는 순간
이름은 다시 비어 버립니다. <strong>핸들</strong>은 임대 계약입니다 —
약간의 크레딧을 지불해 이름을 예약하면 오직 여러분의 계정만 그 이름으로
게시할 수 있습니다.</p>

<h2>임대 방식</h2>
<ol>
  <li><a href="{{APEX}}/marketplace">마켓플레이스</a>에서 이름을 검색하세요.</li>
  <li>임대되지 않은 이름이라면 표시된 월 가격으로 차지할 수 있습니다.
      인기 있는 이름일수록 가격이 높습니다.</li>
  <li>임대가 활성화되어 있는 동안에는 다른 계정에서 그 사용자명으로
      접속하려는 모든 SSH 세션이 거부됩니다.</li>
  <li>만료 전에 클릭 한 번으로 갱신하세요. 핸들을 만료시키면 짧은 유예
      기간 후 다시 풀에 돌아갑니다.</li>
</ol>

<h2>왜 임대해야 하나요?</h2>
<ul>
  <li><strong>안정적인 웹훅.</strong> GitHub, Stripe, Slack 같은 서비스는
      한 번만 설정하면 됩니다.</li>
  <li><strong>브랜드.</strong> <code>https://yourname.{{PUBLIC_DOMAIN}}</code>는
      무작위 문자열보다 공유하기 좋습니다.</li>
  <li><strong>보안.</strong> 잠든 사이 다른 사람이 이름을 차지할 수 없습니다.</li>
</ul>

<h2>크레딧 충전</h2>
<p>임대 가격은 크레딧(AWB)으로 표시됩니다.
<a href="{{APEX}}/dashboard">대시보드</a>에서 추가로 구매할 수 있습니다.
현재 가격은 <a href="/credits">크레딧 가이드</a>를 참고하세요.</p>
`,

  // ==================================================================
  // Platform
  // ==================================================================

  // ---------- credits ----------
  'credits.title': '크레딧, 결제, 그리고 AWB 경제',
  'credits.description':
    '크레딧(AWB)은 Airweb 안에서의 가치 단위입니다 — 핸들 임대, ' +
    '프리미엄 서브도메인, 크리에이터 후원에 쓰입니다. 경제가 어떻게 ' +
    '돌아가는지, 어떻게 충전하는지 알아보세요.',
  'credits.html': `
<h1>크레딧과 결제</h1>
<p class="lead">Airweb 내부에서 가격이 있는 모든 것은
<strong>Airweb 크레딧(AWB)</strong>으로 표시됩니다. 단순한 내부 회계 단위이며 —
블록체인은 관여하지 않습니다.</p>

<h2>크레딧을 얻는 방법</h2>
<ul>
  <li><strong>무료 스타터 잔액.</strong> 모든 신규 계정은 첫 핸들을
      무료로 임대할 수 있을 만큼의 잔액으로 시작합니다.</li>
  <li><strong>충전.</strong> 대시보드에서 더 구매하세요.</li>
  <li><strong>호스팅으로 적립.</strong> 터널을 유지하면, 가동 시간 카운터가
      매분 적은 양의 보조금을 잔액에 적립합니다.</li>
  <li><strong>마켓플레이스.</strong> 더 이상 필요 없는 핸들을 판매하세요.</li>
</ul>

<h2>크레딧을 쓰는 곳</h2>
<ul>
  <li>핸들 임대(반복).</li>
  <li>예약 TCP 포트 범위 같은 프리미엄 옵션.</li>
  <li>다른 계정에 직접 후원.</li>
</ul>

<h2>USD 환산</h2>
<p>사이트 전체의 헤더에는 잔액 옆에 USD 환산값이 표시됩니다. 이 환율은
배포별로 설정되며 <code>GET&nbsp;{{APEX}}/api/config</code>로 노출됩니다.
<em>환산값</em>일 뿐 환율이 아닙니다 — 크레딧을 다시 현금으로 환전할 수는
없습니다.</p>

<h2>원장</h2>
<p>모든 크레딧 이동은 추가만 가능한 원장에 기록되며 언제든 확인할 수
있습니다:</p>
<pre><code>GET {{APEX}}/api/ledger</code></pre>
<p>대시보드는 같은 데이터를 더 친근한 라벨로 렌더링합니다.</p>
`,

  // ---------- dashboard ----------
  'dashboard.title': '대시보드 — Airweb의 홈 베이스',
  'dashboard.description':
    'Airweb 대시보드 안에서 터널, 핸들, 크레딧, 계정 설정을 관리합니다. ' +
    '모든 패널을 둘러보고 모든 단축키를 익혀 보세요.',
  'dashboard.html': `
<h1>대시보드</h1>
<p class="lead"><a href="{{APEX}}/dashboard">{{APEX}}/dashboard</a>에
로그인하면, 계정에서 일어나는 모든 일을 한눈에 볼 수 있는 한 페이지에
도착합니다.</p>

<h2>라이브 터널</h2>
<p>최상단 패널은 현재 계정에 바인딩된 모든 터널을 나열합니다 —
서브도메인 또는 TCP 포트, 연결 시간, 전송 바이트까지. 행을 클릭하면
공개 URL이 복사됩니다.</p>

<h2>핸들</h2>
<p>소유한 임대 항목이 만료일과 함께 표시됩니다. 갱신은 클릭 한 번입니다.</p>

<h2>크레딧</h2>
<p>잔액, 오늘의 적립률, 최근 활동의 스파크라인.
<a href="/credits">크레딧에 대해 더 읽어 보세요.</a></p>

<h2>헤더 크롬</h2>
<p>상단 헤더는 모든 Airweb 페이지(대시보드, 마켓플레이스, 연결, 문서,
모든 내부 서버)에서 동일합니다. 톱니바퀴 아이콘은 테마, 언어, 통화 설정을
열어 줍니다 — 여러분의 환경설정은 <code>.{{PUBLIC_DOMAIN_BASE}}</code>로
범위 지정된 쿠키에 저장되어 모든 서브도메인을 따라다닙니다.</p>
`,

  // ---------- connections ----------
  'connections.title': '연결 페이지 — 실시간 터널 텔레메트리',
  'connections.description':
    'Airweb 클러스터로 들어오는 모든 라이브 SSH 터널을 — 본인 것과 ' +
    '공개된 것 모두 — 실시간 인바운드/아웃바운드 바이트와 원본 정보와 함께 ' +
    '확인하세요.',
  'connections.html': `
<h1>연결</h1>
<p class="lead"><a href="{{APEX}}/connections">/connections</a> 페이지는
활성 상태의 모든 터널을 실시간으로 스트리밍합니다.</p>

<h2>컬럼</h2>
<dl>
  <dt>서브도메인 / 포트</dt><dd>공개적으로 보이는 값입니다.</dd>
  <dt>원본</dt><dd>SSH 세션이 접속해 온 IP 주소(관리자가 아닌 사용자에게는
      마스킹됨).</dd>
  <dt>가동 시간</dt><dd>세션이 활성 상태였던 시간.</dd>
  <dt>인/아웃 바이트</dt><dd>터널 수명 동안의 누적 트래픽.</dd>
</dl>

<h2>공개 vs. 비공개 행</h2>
<p><code>foo.{{PUBLIC_DOMAIN}}</code>에 터널이 <em>존재한다</em>는 사실은
누구나 볼 수 있습니다 — 공유 도메인에서 운영하는 본래 취지죠 — 그러나
원본 IP나 사용자명 같은 메타데이터는 소유자와 관리자만 볼 수 있습니다.</p>

<h2>Server-Sent Events</h2>
<p>이 페이지는 <code>{{APEX}}/api/connections/events</code>의 SSE 스트림으로
구동됩니다. 커스텀 대시보드나 알림 규칙을 만들고 싶다면 직접 구독하세요.</p>
`,

  // ---------- marketplace ----------
  'marketplace.title': '마켓플레이스 — 핸들 매매',
  'marketplace.description':
    'Airweb 핸들을 둘러보고 입찰하세요. 판매자는 더 이상 필요 없는 ' +
    '이름을 올리고, 구매자는 완벽한 서브도메인을 손에 넣습니다.',
  'marketplace.html': `
<h1>마켓플레이스</h1>
<p class="lead"><a href="{{APEX}}/marketplace">마켓플레이스</a>는 핸들의
주인이 바뀌는 곳입니다. 일부러 작게 만들었습니다 — 검색하고, 구매를
클릭하면, 당신의 것입니다.</p>

<h2>핸들 등록하기</h2>
<ol>
  <li>대시보드에서 임대 중인 핸들 하나를 여세요.</li>
  <li><em>판매 등록</em>을 클릭하고 AWB 단위로 가격을 설정하세요.</li>
  <li>등록 즉시 마켓플레이스에 표시됩니다.</li>
  <li>누군가 구매하면 크레딧이 여러분의 계정으로 이동하고, 남은 임대 기간이
      구매자에게 넘어갑니다.</li>
</ol>

<h2>등록 규칙</h2>
<ul>
  <li>현재 소유한 핸들만 등록할 수 있습니다.</li>
  <li>기반 임대가 만료되면 등록도 만료됩니다.</li>
  <li>마켓플레이스는 수수료를 떼지 않습니다 — 등록가가 곧 판매가입니다.</li>
</ul>

<h2>API</h2>
<pre><code>GET  {{APEX}}/api/listings
POST {{APEX}}/api/listings   (인증 필요)</code></pre>
<p>전체 스키마는 <a href="/api">API 참조</a>를 보세요.</p>
`,

  // ==================================================================
  // Reference
  // ==================================================================

  // ---------- cli ----------
  'cli.title': 'airweb CLI 참조',
  'cli.description':
    'airweb 명령줄 래퍼가 받는 모든 플래그와 HTTP 및 TCP 터널 예시.',
  'cli.html': `
<h1>CLI 참조</h1>
<p class="lead">선택 사양인 <code>airweb</code> 래퍼는 SSH 플래그를
외우지 않아도 되게 해 줍니다. <code>npm&nbsp;i&nbsp;-g&nbsp;@airweb/cli</code>로
설치하세요.</p>

<h2>사용법</h2>
<pre><code>airweb http &lt;localPort&gt; [--sub &lt;name&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;

airweb tcp &lt;localPort&gt; [--remote &lt;port&gt;] \\
    --server &lt;host[:port]&gt; --key &lt;path&gt;</code></pre>

<h2>플래그</h2>
<dl>
  <dt><code>--server &lt;host[:port]&gt;</code> <em>(필수)</em></dt>
  <dd>Airweb SSH 엔드포인트. 예:
      <code>{{SSH_HOST}}:{{SSH_PORT}}</code>.</dd>

  <dt><code>--key &lt;path&gt;</code> <em>(필수)</em></dt>
  <dd>다운로드한 키 파일 경로.</dd>

  <dt><code>--sub &lt;name&gt;</code></dt>
  <dd>HTTP 모드 전용. 게시할 서브도메인. 지정하지 않으면 무작위 이름을
      사용합니다.</dd>

  <dt><code>--remote &lt;port&gt;</code></dt>
  <dd>TCP 모드 전용. 서버에 특정 공개 포트를 요청합니다. 생략하면 서버가
      골라 줍니다.</dd>

  <dt><code>--user &lt;name&gt;</code></dt>
  <dd>SSH 사용자명을 재정의합니다. 서브도메인과 사용자명이 달라야 할 때
      유용합니다.</dd>

  <dt><code>--help</code></dt>
  <dd>사용법을 출력합니다.</dd>
</dl>

<h2>예시</h2>
<pre><code># 베니티 서브도메인에서 React 개발 서버
airweb http 3000 --sub demo \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt

# 선택한 공개 포트에서 Postgres 데이터베이스
airweb tcp 5432 --remote 15432 \\
    --server {{SSH_HOST}}:{{SSH_PORT}} \\
    --key ./{{PUBLIC_DOMAIN_BASE}}_&lt;your account id&gt;_key.txt</code></pre>
`,

  // ---------- api ----------
  'api.title': 'HTTP API 참조',
  'api.description':
    'Airweb가 노출하는 모든 JSON 엔드포인트 — 인증, 잔액 및 원장, ' +
    '핸들 마켓플레이스, 관리자 텔레메트리.',
  'api.html': `
<h1>HTTP API</h1>
<p class="lead">모든 엔드포인트는 <code>application/json</code>이며
<code>{{APEX}}/api</code> 아래에 있습니다. 인증은 쿠키 기반입니다 —
<code>POST&nbsp;/api/login</code> 또는 <code>POST&nbsp;/api/register</code>로
로그인하면 서버가 <code>.{{PUBLIC_DOMAIN_BASE}}</code>로 범위 지정된 세션
쿠키를 설정합니다.</p>

<h2>인증</h2>
<table class="api">
  <thead><tr><th>메서드</th><th>경로</th><th>설명</th></tr></thead>
  <tbody>
    <tr><td>POST</td><td>/api/register</td><td>계정 생성, 세션 쿠키 설정, 키 다운로드 URL 반환.</td></tr>
    <tr><td>POST</td><td>/api/login</td><td>사용자명 + 키 서명으로 로그인.</td></tr>
    <tr><td>POST</td><td>/api/logout</td><td>세션 쿠키 삭제.</td></tr>
    <tr><td>GET</td><td>/api/me</td><td>로그인한 사용자의 프로필, 잔액, 임대 요약.</td></tr>
  </tbody>
</table>

<h2>공개 구성</h2>
<pre><code>GET /api/config
{
  "publicDomain": "{{PUBLIC_DOMAIN}}",
  "sshHost": "{{SSH_HOST}}",
  "sshPort": {{SSH_PORT}},
  "usdPerCredit": 0.0008,
  "internalServers": [...]
}</code></pre>

<h2>크레딧</h2>
<pre><code>GET /api/ledger        # 인증 필요
[
  { "ts": 1747...000, "delta": +10, "reason": "uptime-stipend" },
  { "ts": 1747...100, "delta": -50, "reason": "lease:myhandle" }
]</code></pre>

<h2>마켓플레이스</h2>
<table class="api">
  <thead><tr><th>메서드</th><th>경로</th><th>설명</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/listings</td><td>모든 공개 매물 둘러보기.</td></tr>
    <tr><td>GET</td><td>/api/listings?owner=…</td><td>판매자 기준 필터.</td></tr>
    <tr><td>POST</td><td>/api/listings</td><td>소유한 핸들을 판매 등록.</td></tr>
    <tr><td>POST</td><td>/api/handles</td><td>비어 있는 이름 임대 또는 보유 핸들 갱신.</td></tr>
  </tbody>
</table>

<h2>오류</h2>
<p>모든 엔드포인트는 실패 시 <code>error</code> 필드가 포함된 JSON과
적절한 HTTP 상태 코드를 반환합니다. 검증 오류는 400, 인증 필요는 401,
결제 필요는 402, 리소스 없음은 404, 속도 제한은 429입니다.</p>
`,

  // ---------- security ----------
  'security.title': '보안 모델과 모범 사례',
  'security.description':
    'Airweb가 클라이언트를 어떻게 인증하고 터널을 격리하며 사용자 ' +
    '데이터를 보호하는지 — 그리고 노출하는 서비스를 안전하게 하는 ' +
    '모범 사례.',
  'security.html': `
<h1>보안 모델</h1>
<p class="lead">짧고 솔직한 위협 모델: Airweb가 무엇을 하는지, 무엇은
하지 않는지, 그리고 안전하게 사용하는 방법.</p>

<h2>인증</h2>
<p>SSH 키 페어 인증만 지원합니다 — 비밀번호는 서버 차원에서 비활성화되어
있습니다. 키는 등록 시 서버에서 생성되어 한 번 다운로드됩니다. 잃어버리면
계정 접근을 잃습니다. 다시 발급할 수 없습니다(저장한 적이 없으니까요).</p>

<h2>계정별 격리</h2>
<p>서브도메인과 TCP 포트는 등록한 계정이 소유합니다. 임대된 이름을
다른 클라이언트가 바인딩하려 하면 <code>tcpip-forward</code> 핸드셰이크
단계에서 거부됩니다.</p>

<h2>Airweb가 보는 것</h2>
<ul>
  <li>터널을 통해 흐르는 바이트는 공개 라우터를 거칩니다. 라우터는
      요청 본문을 기록하지 않으며 카운터만 기록합니다.</li>
  <li>여러분 쪽에서 TLS를 종료하지 않은 채 HTTP를 터널링하면, 라우터는
      라우팅 중에 평문 요청을 메모리에서 봅니다.</li>
  <li>엔드 투 엔드 TLS가 필요하다면 서비스 내부에서 TLS를 종료하고
      암호화된 바이트를 TCP 터널로 전달하세요.</li>
</ul>

<h2>노출하는 서비스에 대한 모범 사례</h2>
<ul>
  <li><strong>인터넷은 적대적이라고 가정하세요.</strong> "내부용" 프로토타입에도
      인증을 추가하세요.</li>
  <li>영향이 큰 엔드포인트에는 <strong>속도 제한</strong>을 적용하세요.</li>
  <li>침해가 의심되면 <strong>키를 교체</strong>하세요 — 대시보드에서 기존 계정을
      삭제하고 새로 만드세요.</li>
  <li>특정 데모나 발표에 묶인 항목에는 자동으로 만료되도록
      <strong>수명이 짧은 핸들</strong>을 사용하세요.</li>
</ul>

<h2>이슈 신고</h2>
<p>취약점을 발견했나요?
<code>security@{{PUBLIC_DOMAIN_BASE}}</code>로 이메일을 보내 주세요.
책임감 있게 공개하고 신고자에게 공개적으로 크레딧을 드립니다.</p>
`,

  // ---------- faq ----------
  'faq.title': '자주 묻는 질문',
  'faq.description':
    '가장 흔한 Airweb 질문에 대한 빠른 답변: ngrok와의 비교, 셀프 ' +
    '호스팅 가능 여부, 커스텀 도메인, 무료 할당량 등.',
  'faq.html': `
<h1>자주 묻는 질문</h1>

<h3>ngrok나 Cloudflare Tunnel과 어떻게 다른가요?</h3>
<p>Airweb의 전송 계층은 평범한 OpenSSH입니다 — 독자 프로토콜도, 클라이언트
바이너리도, 커널 모듈도 없습니다. 대가로 ngrok 스타일의 검사 UI나
Cloudflare의 엣지 네트워크는 패키지에 포함되지 않습니다. "어떤 방화벽
뒤에서도 ssh가 동작한다"가 충분하다면 Airweb가 더 단순한 답입니다.</p>

<h3>나만의 Airweb 서버를 운영할 수 있나요?</h3>
<p>네 — 저장소는 호스팅 서비스를 구동하는 그 코드입니다. 클론한 뒤
<code>config.default.json</code>을 <code>config.json</code>으로 복사하고,
<code>AIRWEB_PUBLIC_DOMAIN</code>을 설정한 다음 <code>npm start</code>를
실행하세요. DNS는 <code>*.your-domain</code>을 호스트로 가리키는 와일드카드
A 레코드가 필요합니다.</p>

<h3>호스팅 서비스에 무료 티어가 있나요?</h3>
<p>네 — 모든 계정은 짧은 핸들을 한 달 동안 임대하고 그 사이에 익명
터널을 원하는 만큼 운영할 수 있는 크레딧으로 시작합니다.</p>

<h3>내 도메인을 가져올 수 있나요?</h3>
<p>호스팅 서비스에서는 아직 안 됩니다 — 핸들은 메인 공개 도메인 아래에
존재합니다. 셀프 호스팅 인스턴스에서는 물론 통제하는 어떤 와일드카드도
자유롭게 설정할 수 있습니다.</p>

<h3>네트워크가 끊기면 터널은 어떻게 되나요?</h3>
<p>래퍼를 사용했다면 SSH 클라이언트가 <code>ServerAliveInterval</code>로
자동 재시도합니다. 순수 <code>ssh</code>를 쓴다면
<code>-o&nbsp;ServerAliveInterval=30</code>을 추가해 같은 동작을 얻거나,
명령을 <code>autossh</code>로 감쌀 수 있습니다.</p>

<h3>HTTP/2나 HTTP/3을 지원하나요?</h3>
<p>공개 엣지는 HTTP/1.1과 HTTP/2를 말합니다. HTTP/3(QUIC)는 UDP가 필요해
로드맵에 있습니다. 오리진은 원하는 것이라면 무엇이든 말할 수 있습니다 —
프록시는 터널 구간에서 HTTP/1.1로 정규화합니다.</p>

<h3>운영 트래픽에 Airweb를 사용할 수 있나요?</h3>
<p>사용하는 사람들이 있지만, 무엇을 사는 것인지 이해해야 합니다. 단일
SSH 세션은 단일 장애점입니다. 진짜 운영에는 다중 리전과 로드 밸런서
뒤에 액티브/액티브 세션을 둔 셀프 호스팅 경로를 권장합니다.</p>
`,

  // ---------- troubleshooting ----------
  'troubleshooting.title': 'Airweb 공통 오류 문제 해결',
  'troubleshooting.description':
    '사람들이 가장 자주 부딪히는 오류를 해결하는 레시피: 포워딩 실패, ' +
    '이미 바인딩된 포트, 키 권한, 회사 프록시 등.',
  'troubleshooting.html': `
<h1>문제 해결</h1>

<h2 id="forwarding-failed">"Remote forwarding failed"</h2>
<p>요청한 포트를 서버가 바인딩하지 않았습니다. 흔한 원인:</p>
<ul>
  <li>다른 사람(또는 이전 SSH 세션)이 이미 그 서브도메인이나 TCP 포트를
      쥐고 있습니다. 잠시 기다린 뒤 다시 시도하세요.</li>
  <li>특권 포트(&lt; 1024)를 요청했지만 핸들 소유자가 아닙니다. 80번
      (특별 처리됨) 또는 1024 이상의 포트를 사용하세요.</li>
  <li>핸들이 다른 계정이 임대 중입니다. 다른 이름을 고르거나
      <a href="{{APEX}}/marketplace">마켓플레이스</a>에서 임대하세요.</li>
</ul>

<h2 id="permission-denied">"Permission denied (publickey)"</h2>
<ul>
  <li><code>-i</code> 경로가 다운로드한 파일을 가리키는지 다시 확인하세요.</li>
  <li>macOS/Linux에서는 키 파일에 <code>chmod 600</code>을 실행하세요 —
      SSH는 모두 읽기 가능한 개인 키를 거부합니다.</li>
  <li>잘못된 키를 먼저 제시하는 바쁜 <code>ssh-agent</code>가 있다면
      <code>-o&nbsp;IdentitiesOnly=yes</code>를 추가하세요.</li>
</ul>

<h2 id="corporate-proxy">회사 프록시 뒤에서</h2>
<p>아웃바운드 {{SSH_PORT}} 포트가 막혀 있다면 <code>corkscrew</code>나
<code>ProxyCommand</code>로 프록시 너머로 SSH를 실행할 수 있습니다:</p>
<pre><code>ssh -o "ProxyCommand=nc -X connect -x proxy.corp:8080 %h %p" \\
    ... me@{{SSH_HOST}}</code></pre>

<h2 id="webhook-loop">웹훅 수신기가 두 번 응답해요</h2>
<p>두 SSH 세션이 같은 서브도메인을 주장하고 있을 것입니다.
<a href="{{APEX}}/connections">연결 페이지</a>를 보세요 — 두 행이 같은
이름을 공유한다면 하나를 종료하세요.</p>

<h2 id="https-redirect">"사이트에 HTTPS가 없음"</h2>
<p>호스팅 서비스에서는 모든 서브도메인이 <code>http</code>와 <code>https</code>
양쪽으로 제공됩니다. 서비스가 스스로 <code>http://</code>로 리다이렉트를
보낸다면, "external URL" 설정을
<code>https://&lt;sub&gt;.{{PUBLIC_DOMAIN}}</code>로 지정하세요.</p>

<h2>더 많은 디버그 출력</h2>
<p><code>ssh</code> 명령에 <code>-vvv</code>를 추가하면 수다스러운 전체
핸드셰이크 로그를 볼 수 있습니다. "동작 안 함" 보고의 대부분은 이 출력을
공유하면 해결됩니다.</p>
`,

  // ---------- changelog ----------
  'changelog.title': '변경 이력',
  'changelog.description':
    'Airweb 버전 전반의 주요 변경 — 기능, 호환성 깨짐, 보안 수정.',
  'changelog.html': `
<h1>변경 이력</h1>
<p class="lead">하위 호환성을 깨는 변경은 <strong>BREAKING</strong>으로
표시합니다. 날짜는 변경이 호스팅 서비스에 적용된 시점입니다.</p>

<h3>2026-05 — 통합 헤더와 공유 설정</h3>
<ul>
  <li>랜딩 페이지, 대시보드, 마켓플레이스, 연결, 문서 전반에 하나의
      헤더 디자인 적용.</li>
  <li>테마, 언어, 통화 설정이 이제 <code>.{{PUBLIC_DOMAIN_BASE}}</code>로
      범위 지정된 쿠키로 유지되어 모든 서브도메인을 따라다닙니다.</li>
</ul>

<h3>2026-03 — 현실적인 보상 경제</h3>
<ul>
  <li>스타터 인벤토리를 무작위 잡템 대신 실제로 유용한 아이템을
      제공하도록 조정.</li>
  <li>레벨 인증서 수정: 타이틀 변경 시뿐 아니라 매 레벨 상승 시
      지급되도록 변경.</li>
</ul>

<h3>2025-12 — 내부 서버 CORS</h3>
<ul>
  <li>이 문서 사이트 같은 내부 서비스가 다른 서브도메인의 에이펙스
      API를 호출할 수 있게 됨.
      <strong>BREAKING</strong>: 이전에 동일 출처를 가정해
      <code>/api/me</code>에 접근하던 스크립트는 이제
      <code>credentials:&nbsp;'include'</code>를 보내야 합니다.</li>
</ul>

<h3>2025-09 — 핸들 마켓플레이스</h3>
<ul>
  <li>마켓플레이스 출시. 핸들 임대, 등록, 양도.</li>
</ul>
`,
};
