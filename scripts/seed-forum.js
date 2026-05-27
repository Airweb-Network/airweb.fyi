// Seed the forum with two years of growth: ~1000 posts and ~1000 comments
// spread over 730 days, starting tiny (a few brave early users) and ramping
// up as the community grows. Mixes serious Q&A with running jokes, memes,
// and the sort of low-effort shitposting that makes a community feel alive.
//
//   node scripts/seed-forum.js          # additive (skips if any posts exist)
//   node scripts/seed-forum.js --force  # wipe forum_* tables and reseed
//
// Idempotency: by default the script refuses to run if forum_questions has
// rows. Use --force to start over.

const crypto = require('crypto');
const db = require('../server/db');

const FORCE = process.argv.includes('--force');

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const SPAN_DAYS = 730; // 2 years
const START = NOW - SPAN_DAYS * DAY;

const TARGET_POSTS = 1000;
const TARGET_COMMENTS = 1000;

// ---------------------------------------------------------------------------
// Tiny seedable RNG so repeated runs produce the same plausible-looking data.
// ---------------------------------------------------------------------------
let _seed = 0xC0FFEE;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 0x100000000;
}
function ri(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function chance(p) { return rand() < p; }
function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

// ---------------------------------------------------------------------------
// Address generation (mirrors server/accounts.js: 'aw_' + 16 base32 chars)
// ---------------------------------------------------------------------------
const B32 = 'abcdefghijkmnpqrstuvwxyz23456789';
function fakeAddress() {
  let s = 'aw_';
  for (let i = 0; i < 16; i++) s += B32[Math.floor(rand() * 32)];
  return s;
}

// ---------------------------------------------------------------------------
// Personas: archetypes the community fills with. Each "joins" at a point in
// the 2-year window and starts posting / commenting from then on.
// ---------------------------------------------------------------------------
const PERSONAS = [
  // Founding circle (early adopters)
  { handle: 'kestrel',   tone: 'founder',   join: 0.00 },
  { handle: 'mira',      tone: 'founder',   join: 0.00 },
  { handle: 'noctis',    tone: 'sysadmin',  join: 0.01 },
  { handle: 'rumi',      tone: 'tinkerer',  join: 0.02 },
  { handle: 'glitch',    tone: 'shitposter',join: 0.03 },
  { handle: 'velvet',    tone: 'designer',  join: 0.04 },
  { handle: 'opal',      tone: 'newbie',    join: 0.05 },
  // Wave 2
  { handle: 'beep_boop', tone: 'shitposter',join: 0.08 },
  { handle: 'dr_segfault',tone:'sysadmin',  join: 0.09 },
  { handle: 'asuka',     tone: 'tinkerer',  join: 0.10 },
  { handle: 'pico',      tone: 'newbie',    join: 0.11 },
  { handle: 'lorelei',   tone: 'designer',  join: 0.12 },
  { handle: 'mango',     tone: 'shitposter',join: 0.13 },
  { handle: 'kero',      tone: 'tinkerer',  join: 0.14 },
  { handle: 'silas',     tone: 'sysadmin',  join: 0.15 },
  { handle: 'mox',       tone: 'shitposter',join: 0.17 },
  { handle: 'jin',       tone: 'tinkerer',  join: 0.18 },
  { handle: 'wren',      tone: 'newbie',    join: 0.20 },
  { handle: 'orchid',    tone: 'designer',  join: 0.21 },
  { handle: 'tachyon',   tone: 'sysadmin',  join: 0.22 },
  // Influx
  { handle: 'pyro',      tone: 'shitposter',join: 0.25 },
  { handle: 'sable',     tone: 'tinkerer',  join: 0.26 },
  { handle: 'echo',      tone: 'newbie',    join: 0.27 },
  { handle: 'cinder',    tone: 'sysadmin',  join: 0.28 },
  { handle: 'umbra',     tone: 'designer',  join: 0.29 },
  { handle: 'birb',      tone: 'shitposter',join: 0.30 },
  { handle: 'kuro',      tone: 'tinkerer',  join: 0.31 },
  { handle: 'aiko',      tone: 'newbie',    join: 0.32 },
  { handle: 'wisp',      tone: 'designer',  join: 0.33 },
  { handle: 'rune',      tone: 'sysadmin',  join: 0.34 },
  { handle: 'plover',    tone: 'shitposter',join: 0.35 },
  { handle: 'vela',      tone: 'tinkerer',  join: 0.36 },
  { handle: 'nori',      tone: 'newbie',    join: 0.38 },
  { handle: 'foxglove',  tone: 'designer',  join: 0.39 },
  { handle: 'helix',     tone: 'sysadmin',  join: 0.40 },
  { handle: 'pog',       tone: 'shitposter',join: 0.41 },
  { handle: 'bee',       tone: 'tinkerer',  join: 0.42 },
  { handle: 'tofu',      tone: 'newbie',    join: 0.43 },
  { handle: 'ivory',     tone: 'designer',  join: 0.44 },
  { handle: 'quill',     tone: 'sysadmin',  join: 0.45 },
  { handle: 'frog.exe',  tone: 'shitposter',join: 0.46 },
  { handle: 'maple',     tone: 'tinkerer',  join: 0.47 },
  { handle: 'lyra',      tone: 'newbie',    join: 0.48 },
  { handle: 'salem',     tone: 'designer',  join: 0.49 },
  { handle: 'kairos',    tone: 'sysadmin',  join: 0.50 },
  // Year 2
  { handle: 'doom',      tone: 'shitposter',join: 0.55 },
  { handle: 'koi',       tone: 'tinkerer',  join: 0.56 },
  { handle: 'mochi',     tone: 'newbie',    join: 0.57 },
  { handle: 'briar',     tone: 'designer',  join: 0.58 },
  { handle: 'vortex',    tone: 'sysadmin',  join: 0.59 },
  { handle: 'yapper',    tone: 'shitposter',join: 0.60 },
  { handle: 'finch',     tone: 'tinkerer',  join: 0.61 },
  { handle: 'penny',     tone: 'newbie',    join: 0.62 },
  { handle: 'azura',     tone: 'designer',  join: 0.63 },
  { handle: 'nyx',       tone: 'sysadmin',  join: 0.64 },
  { handle: 'gigabyte',  tone: 'shitposter',join: 0.65 },
  { handle: 'orin',      tone: 'tinkerer',  join: 0.66 },
  { handle: 'pebble',    tone: 'newbie',    join: 0.67 },
  { handle: 'aster',     tone: 'designer',  join: 0.68 },
  { handle: 'cobalt',    tone: 'sysadmin',  join: 0.69 },
  { handle: 'sus',       tone: 'shitposter',join: 0.70 },
  { handle: 'twig',      tone: 'tinkerer',  join: 0.71 },
  { handle: 'gem',       tone: 'newbie',    join: 0.72 },
  { handle: 'plum',      tone: 'designer',  join: 0.73 },
  { handle: 'circuit',   tone: 'sysadmin',  join: 0.74 },
  { handle: 'soup',      tone: 'shitposter',join: 0.75 },
  { handle: 'haze',      tone: 'tinkerer',  join: 0.76 },
  { handle: 'tea',       tone: 'newbie',    join: 0.77 },
  { handle: 'olive',     tone: 'designer',  join: 0.78 },
  { handle: 'kernel',    tone: 'sysadmin',  join: 0.80 },
  { handle: 'mood',      tone: 'shitposter',join: 0.82 },
  { handle: 'thorn',     tone: 'tinkerer',  join: 0.83 },
  { handle: 'nimbus',    tone: 'newbie',    join: 0.84 },
  { handle: 'fern',      tone: 'designer',  join: 0.85 },
  { handle: 'argon',     tone: 'sysadmin',  join: 0.86 },
  { handle: 'goof',      tone: 'shitposter',join: 0.87 },
  { handle: 'tide',      tone: 'tinkerer',  join: 0.88 },
  { handle: 'rin',       tone: 'newbie',    join: 0.89 },
  { handle: 'lumen',     tone: 'designer',  join: 0.90 },
  { handle: 'forge',     tone: 'sysadmin',  join: 0.91 },
  { handle: 'sketch',    tone: 'designer',  join: 0.93 },
  { handle: 'noodle',    tone: 'shitposter',join: 0.94 },
  { handle: 'lark',      tone: 'newbie',    join: 0.95 },
  { handle: 'pixel',     tone: 'tinkerer',  join: 0.96 },
];

// Assign each persona a stable fake address.
for (const p of PERSONAS) p.address = fakeAddress();

function activeUsersAt(t) {
  const f = (t - START) / (NOW - START);
  return PERSONAS.filter(p => p.join <= f);
}

// ---------------------------------------------------------------------------
// Content. Posts have a (tags, title, body) shape; some include callbacks to
// running jokes. Memes / shitposts get the [meme] tone.
// ---------------------------------------------------------------------------

// Real-ish technical posts grouped by primary tag. Body uses {{user}} for a
// random other persona reference and {{port}} for a random port number.
const TECH_POSTS = [
  // setup
  { tags: ['setup'], title: 'First reverse tunnel just worked, what now?',
    body: "Set up airweb on my home box this morning and the first SSH -R worked first try. I genuinely expected to spend the afternoon debugging. What's the next thing I should try? Pointing a real subdomain at it?" },
  { tags: ['setup','linux'], title: 'systemd unit for keeping the tunnel up',
    body: "Sharing the unit I'm using on Debian 12 — Restart=always, RestartSec=10, and a small wrapper that logs reconnects. Happy to paste if anyone wants it. Curious what others do for backoff." },
  { tags: ['setup','windows'], title: 'Windows ssh client closes after a few hours',
    body: "Powershell + built-in OpenSSH client. Tunnel stays up for ~3-4 hours then dies silently. ServerAliveInterval helps a bit but not fully. Is anyone running this reliably on Windows without WSL?" },
  { tags: ['setup','macos'], title: 'launchd plist for airweb tunnel',
    body: "Wrote a tiny launchd plist so my Mac mini auto-tunnels on boot. KeepAlive on, with ProcessType=Background. Sleep is the enemy though — caffeinate -i is required or the tunnel dies during display sleep." },

  // ssh
  { tags: ['ssh','troubleshooting'], title: 'Permission denied (publickey) after key rotation',
    body: "Generated a new ed25519, replaced authorized_keys, but airweb keeps refusing. Old key still works. Do I need to do something on the server side to register the new fingerprint?" },
  { tags: ['ssh'], title: 'ed25519 vs RSA — does it matter here?',
    body: "I've been on RSA-4096 forever. About to switch everything to ed25519 because every modern tutorial assumes it. Any reason not to for airweb specifically?" },
  { tags: ['ssh','security'], title: 'Restricting the tunnel key to forwarding only',
    body: "I want a key that can open the reverse tunnel but cannot get a shell. Tried `command=\"/bin/false\"` + permitopen but it kills the tunnel too. What's the canonical way?" },

  // http
  { tags: ['http','showcase'], title: 'Exposing a Next.js dev server through airweb',
    body: "Pointed a handle at port 3000 and webhook testing from Stripe just works. The host header is preserved which was the main thing I was worried about. Anyone else using this for dev?" },
  { tags: ['http'], title: 'Websocket reconnect storms during deploy',
    body: "When I restart the upstream the clients all reconnect at once and a few of them get stuck for ~30s. Is there a graceful drain hook or do I just need backoff on the client?" },
  { tags: ['http','troubleshooting'], title: 'Getting 502 only on POST, GETs are fine',
    body: "Static GETs go through, POSTs over a few KB return 502 about half the time. Body size limit somewhere? My upstream isn't the bottleneck, it accepts these fine when I curl it locally." },

  // tcp
  { tags: ['tcp','showcase'], title: 'Running a Minecraft server through a TCP handle',
    body: "Ran a small SMP for friends using a tcp handle on port {{port}}. Latency from East Coast US is ~70ms which is honestly fine. Anyone running anything cooler over raw tcp?" },
  { tags: ['tcp'], title: 'Postgres over a TCP tunnel — bad idea?',
    body: "Need to give a contractor temporary access to a staging DB. Considering a short-lived tcp tunnel with IP allowlist. Or should I just suck it up and use a bastion?" },

  // handles
  { tags: ['handles'], title: 'Wishlist: case-insensitive handle lookups',
    body: "Someone DM'd me asking why \"FooBar\" wasn't resolving. Apparently they typed it with caps. I know dns is case-insensitive on the wire but the handle table seems to be strict. Possible to normalize?" },
  { tags: ['handles','feature-request'], title: 'Wildcard handles for staging environments',
    body: "Would love to claim `*.myapp` so I can spin up `pr-123.myapp` per PR. Right now I'm renting one handle per PR which is silly." },

  // billing
  { tags: ['billing'], title: 'How are credits actually metered?',
    body: "I see my balance tick down but not exactly per-minute. Is it per byte? Per connection? Per minute of established tunnel? Just trying to figure out how to model the cost." },
  { tags: ['billing','feature-request'], title: 'Auto top-up at threshold?',
    body: "I keep forgetting to top up and my tunnel dies overnight. Would pay for a feature that auto-adds credits when I drop below N. Anyone else?" },

  // marketplace
  { tags: ['marketplace','showcase'], title: 'I rented out my Pi 5 cluster as a listing',
    body: "Had three Pi 5s collecting dust. Listed them as a tcp lease at a fair price and they've been rented continuously for two weeks. Honestly mind-blowing that this works." },
  { tags: ['marketplace'], title: 'How do I price a 1Gbps box fairly?',
    body: "Sitting on a beefy box in a colo with real 1Gbps symmetric. What's the going rate? I don't want to undercut everyone but also don't want it to sit idle." },
  { tags: ['marketplace','buy-sell'], title: 'WTB: short lease for game day load test',
    body: "Need ~8 hours of beefy CPU on Saturday for a load test. Anyone have spare capacity? DM me." },

  // jobs / hiring
  { tags: ['jobs'], title: 'Available: infra contractor (Linux, K8s, mostly tunnels)',
    body: "Wrapping up a long contract end of next month. 10+ years infra, happy to do short projects. Mention airweb in your DM so I know you read this." },
  { tags: ['hiring','project'], title: 'Looking for a Rust dev for a small CLI tool',
    body: "Need someone to build a small CLI that wraps airweb for our team's workflow. Estimated 2-3 weeks of part time. Paid in $ or credits, your choice." },

  // event / launch
  { tags: ['event'], title: 'Casual community call this Thursday 8pm UTC',
    body: "Doing a small voice call to chat about what people are building. No agenda, no slides. Bring a link if you have something to show. DM for the join URL." },
  { tags: ['launch','showcase'], title: 'Launched my side project on top of airweb',
    body: "Spent 3 weekends building a webhook inspector that runs on my old NUC and is exposed via an airweb handle. Free for now while I figure out if anyone cares." },

  // security
  { tags: ['security'], title: 'Basic auth in front of a dev tunnel?',
    body: "I want to expose a staging dashboard but require basic auth before the request even reaches my upstream. Is there a way to enforce it at the airweb layer?" },
  { tags: ['security','feature-request'], title: 'Per-handle IP allowlist',
    body: "Would love to restrict who can hit a handle. Office IP + my home IP only. Right now I'm doing it in nginx behind the tunnel which feels redundant." },

  // docker / linux / db
  { tags: ['docker','setup'], title: 'Running the client in a docker sidecar',
    body: "Built a tiny image that just runs the ssh client with my key mounted in. Works great as a sidecar next to my app container. Sharing the Dockerfile if anyone wants." },
  { tags: ['linux'], title: 'TIL: net.ipv4.tcp_keepalive_time was my problem',
    body: "Tunnel was dying after exactly 7200s. Of course. Bumped tcp_keepalive_time to 600 and it's been rock solid for a week." },
  { tags: ['database','tcp'], title: 'Redis through a tcp tunnel feels too easy',
    body: "Local redis exposed via tcp handle, app on another continent connects to it. Should I be nervous about the latency? Pipelining seems to hide most of it." },

  // troubleshooting
  { tags: ['troubleshooting','ssh'], title: 'Tunnel disconnects every ~57 minutes exactly',
    body: "Not 60. Not 55. Exactly ~57 every time. Driving me insane. Anyone seen this? Almost certainly something between my router and the server but I'd love a smoking gun." },
  { tags: ['troubleshooting','http'], title: 'Cloudflare in front of airweb handle — worth it?',
    body: "Considering putting CF in front for caching and DDoS protection. Anyone doing this? Does it just work or are there gotchas with the host header?" },

  // bug-report
  { tags: ['bug-report'], title: 'Forum bumps a thread when *I* answer my own question',
    body: "Probably not the intended behavior. If I post a question and then later post an answer to it myself, the bumped_at jumps to now and my own post shows up at the top of the feed. Minor but a little embarrassing." },
  { tags: ['bug-report','marketplace'], title: 'Listing description loses newlines on edit',
    body: "Whatever editor flow the listing form uses is collapsing my paragraph breaks into single spaces. The original post is fine, editing eats them." },

  // feature-request
  { tags: ['feature-request'], title: 'Markdown preview in forum composer',
    body: "Tiny QoL — split-pane preview while composing. I keep posting then editing because the rendered version surprises me." },
  { tags: ['feature-request','jobs'], title: 'Filter the feed by tag *and* hide answered',
    body: "When I'm in helper-mode I want to see only open questions in tags I care about. Currently I can do one or the other, not both. Would be lovely." },

  // services
  { tags: ['services'], title: 'Offering: 1-hour setup help for airweb + your stack',
    body: "Done about 30 airweb setups across different stacks. Happy to do a paid 1-on-1 if you're stuck. First 15 min free if you mention this post." },
];

// Pure shitposts / memes. Often short, low-effort, with a punchline.
const MEMES = [
  { tags: ['showcase'], title: 'POV: your reverse tunnel works on first try',
    body: "(•_•)\n( •_•)>⌐■-■\n(⌐■_■)\n\nNever happens. Today it did. Closing the laptop before I touch anything." },
  { tags: ['showcase'], title: 'me explaining airweb to my mom',
    body: "mom: so where does the website live\nme: my closet\nmom: ...where does the URL live\nme: also my closet\nmom: " },
  { tags: ['showcase'], title: 'unboxing my new datacenter (it is a raspberry pi)',
    body: "1U, 5W, 0 racks, 1 owner, infinite vibes." },
  { tags: ['ssh'], title: 'ssh -R is the only command i actually remember',
    body: "kubectl? I google it.\ngit rebase? I google it.\nssh -R 1337:localhost:1337 user@host? muscle memory baby" },
  { tags: ['bug-report'], title: 'is it a bug or is it a feature (my tunnel)',
    body: "It only fails when I am on the toilet and my coworker DMs me a screenshot of 502. Cannot reproduce from desk. Filing as P0." },
  { tags: ['security'], title: 'security advice: don\'t name your prod key `prod_key_FINAL_v2_USE_THIS`',
    body: "speaking from experience" },
  { tags: ['handles'], title: 'someone please take `coolguy` away from me',
    body: "I claimed it in a moment of weakness during onboarding and now my deploy URLs make me look insufferable. Free to a good home." },
  { tags: ['billing'], title: 'I have spent more time optimizing credits than earning money',
    body: "spreadsheet enjoyer in his natural habitat" },
  { tags: ['marketplace'], title: 'my old gaming pc is now a landlord',
    body: "Built it in 2018 to play warzone. Now it pays for itself listing on airweb. The arc of the universe bends toward making weird side income." },
  { tags: ['linux'], title: 'tutorial: how to fix any linux problem in 4 steps',
    body: "1. paste error in DDG\n2. find a 2014 forum post with no replies\n3. find a 2017 post with one reply saying \"nvm fixed it\"\n4. apt upgrade && reboot && pray" },
  { tags: ['windows'], title: 'i ran airweb on windows for 3 days. AMA',
    body: "yes the powershell prompt is purple now. no I don't know why. it just is." },
  { tags: ['macos'], title: 'my mac mini is in the closet next to a coat',
    body: "the coat has 99.9% uptime. the mini has 98.4%. learning a lot from the coat." },
  { tags: ['showcase'], title: 'i made airweb tell me when my cat eats',
    body: "Pressure mat under the bowl -> esp32 -> tiny http server -> airweb handle -> webhook into my phone. Yes I could have used a feeder. No I will not." },
  { tags: ['showcase'], title: 'tunneled my smart fridge so I can yell at it from work',
    body: "Don't ask me what I yell. Productivity has gone up 14%." },
  { tags: ['ssh'], title: 'when the ssh banner is longer than the actual response',
    body: "ASCII art dragon, 18 lines of legal text, a haiku, and then the actual login. love it. don't change." },
  { tags: ['http'], title: 'I would die for the airweb 502 page',
    body: "the little spinning thing? immaculate. perfect amount of \"yeah we tried\"." },
  { tags: ['feature-request'], title: 'we need a dark mode... wait',
    body: "ok the whole thing is already dark mode. nvm. carry on." },
  { tags: ['troubleshooting'], title: 'turning it off and on again works on tunnels too',
    body: "20 years in IT and this is still the playbook. namaste." },
  { tags: ['event'], title: 'unofficial airweb conference — my living room — BYO snacks',
    body: "Estimated attendance: me, my dog, possibly {{user}} if they reply. Talks limited to 90 seconds. Heckling encouraged." },
  { tags: ['showcase'], title: 'airweb wrapped 2025',
    body: "Top tag: troubleshooting (sorry)\nLongest tunnel: 41 days\nFavorite handle: redacted\nMost frequent collaborator: {{user}}\nThank you for listening" },
  { tags: ['showcase'], title: 'sshposting hours',
    body: "drop your weirdest tunnel. I'll start: my doorbell goes through 3 hops, 2 countries, and a screen reader." },
  { tags: ['feature-request','showcase'], title: 'can we get an emoji reaction for \"it works on my machine\"',
    body: "vital infrastructure. cannot believe it isn't shipped yet." },
  { tags: ['security'], title: 'two-factor auth? more like two-flashlight inspecting my drawer for the yubikey',
    body: "I have four yubikeys. I have four drawers. correlation: zero." },
  { tags: ['bug-report'], title: 'the bug is me. the bug has always been me.',
    body: "filed 4 issues this week. closed 4 issues this week. growth." },
  { tags: ['handles','launch'], title: 'i registered `aaaaaaaaa` because i could',
    body: "no plans for it. it just exists. like art." },
];

// Body templates for short follow-up posts to keep volume up. Each is a
// shorter "I tried X today" / "small win" / "annoying thing" style post.
const SHORT_POSTS = [
  { tags: ['showcase'], title: 'small win: handle pointed at a literal index.html on my desktop',
    body: "Worked. Probably shouldn't, but worked. Static page served from `~/Desktop/site/` to a real URL in under a minute." },
  { tags: ['troubleshooting'], title: 'my coworker thought my staging URL was prod',
    body: "He filed bugs against it. They were real bugs. I am keeping them." },
  { tags: ['showcase'], title: 'today\'s tunnel: a webhook for my plant moisture sensor',
    body: "Watered it. Webhook fired. World did not end." },
  { tags: ['bug-report'], title: 'the bump cooldown is real and it is judging me',
    body: "I bumped, was told to wait, then forgot, and now my thread is page 4 forever. Skill issue." },
  { tags: ['feature-request'], title: 'pls let me sort by least answered',
    body: "Want to help out but the obvious threads have 10 answers already. Show me the lonely ones." },
  { tags: ['ssh'], title: 'put my ssh config in version control. life changing.',
    body: "I should have done this years ago. {{user}} I owe you a beer for finally convincing me." },
  { tags: ['http'], title: 'TIL airweb keeps the X-Forwarded-For',
    body: "Was worried I'd lose client IPs behind the tunnel. They show up in X-Forwarded-For exactly like nginx upstream." },
  { tags: ['marketplace'], title: 'my listing got rented within 4 minutes',
    body: "Posted, made coffee, came back, already taken. Wild." },
  { tags: ['billing'], title: 'forgot to top up before vacation. R.I.P. my demo site.',
    body: "Auto top-up real when?" },
  { tags: ['setup'], title: 'fresh debian -> tunnel up in 6 minutes',
    body: "Including reading the README twice. Smooth." },
  { tags: ['showcase'], title: 'replaced ngrok with airweb across my team',
    body: "Everyone shrugged and moved on. Highest compliment in infra." },
  { tags: ['security'], title: 'rotated all my keys today',
    body: "Painful but quick. {{user}}'s gist was the only one that didn't lie to me." },
  { tags: ['linux'], title: 'arch users will be glad to know it works on arch',
    body: "I am the arch user. It works." },
];

// Comment templates. {{op}} = the original poster's handle, {{user}} = a
// random other persona. Comments are short, varied in tone.
const COMMENTS_GENERIC = [
  "+1 to this, ran into the exact same thing last week.",
  "Have you checked the server-side logs? Mine were way more useful than the client output.",
  "This. Took me embarrassingly long to find.",
  "Tried this on a Pi 4, can confirm it works fine.",
  "What version are you on? Make sure you're not on the old client.",
  "Probably a firewall thing — `nc -vz` from the box you're tunneling from is the fastest sanity check.",
  "I lost a weekend to this. Worth the price of admission.",
  "@{{op}} can you share your config (redacted of course)?",
  "MTU. It's always MTU.",
  "If it's not DNS it's certificates and if it's not certificates it's the keepalive.",
  "Have you tried turning it off and on again 😄",
  "Beautiful. Going to steal this for my own setup.",
  "Anecdote: I solved a very similar issue by switching to ed25519. No idea why it helped.",
  "Tagging {{user}} who I think hit this last month.",
  "Saving this thread, will come back when I'm not on mobile.",
  "Wait, this works?",
  "Genuinely thought I was the only one. Thank you for posting this.",
  "What's the upstream? Sometimes it's the upstream timing out and the tunnel just dutifully proxies the 502.",
  "Sub'd. Need to know if you figure it out.",
  "Hot take: this is a docs problem more than a product problem.",
];

const COMMENTS_MEME = [
  "💀",
  "I am screaming",
  "hello yes I would also like to be hired for vibes",
  "this is the post of all time",
  "no notes. perfect. shipping.",
  "@{{op}} you are doing the lord's work",
  "first",
  "this should be in the readme honestly",
  "reading this at 2am, eating cereal, validated",
  "yelling",
  "based",
  "the coat thing got me",
  "@{{user}} drop the haiku",
  "filed a JIRA against vibes",
  "I needed this today",
  "ok this is going on the office wall",
  "i'm in danger.png",
  "respectfully: lol",
  "the dog and i are clapping",
  "ratio + you fell off (affectionate)",
];

const ANSWER_HELPFUL = [
  "Fix: set `ServerAliveInterval 30` and `ServerAliveCountMax 3` in your ssh client config. Solved this for me.",
  "It's the host header. Pass `--host-header=preserve` (or the equivalent in your config) and upstream stops 502'ing.",
  "Run the client with `-vvv` and look for the line right before the disconnect. Mine said `Connection reset by peer` and it turned out to be a corporate DPI.",
  "On Debian make sure systemd-networkd-wait-online isn't masking the network at boot or the unit starts before there's connectivity.",
  "Use `ssh -o ExitOnForwardFailure=yes` so you actually fail fast if the remote port is taken, instead of silently \"working\".",
  "Check `ulimit -n`. Default 1024 chokes once you have a couple dozen concurrent connections going through the tunnel.",
  "Move your handle to a wildcard CNAME and stop fighting DNS caching while testing.",
  "Concrete answer: it's per-minute of active session, rounded up. So a 10s connection costs you the same as 59s.",
  "Use `command=\"true\",no-pty,no-X11-forwarding,permitopen=\"localhost:8080\"` on the authorized_keys line. The trick is `command=\"true\"`, not `/bin/false`.",
  "Don't put Cloudflare in front for the websocket case unless you flip the WS toggle, took me a day to figure that out.",
];

// ---------------------------------------------------------------------------
// Insertion
// ---------------------------------------------------------------------------

function wipeForumIfForced() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM forum_questions').get();
  if (n > 0 && !FORCE) {
    console.error(`forum_questions already has ${n} rows. Re-run with --force to wipe and reseed.`);
    process.exit(1);
  }
  if (FORCE) {
    db.exec(`
      DELETE FROM forum_saved_posts;
      DELETE FROM forum_answers;
      DELETE FROM forum_questions;
      DELETE FROM forum_user_state;
    `);
    console.log('Wiped forum_* tables.');
  }
}

function ensureAccountsExist() {
  // Insert each persona as an account if not already present. We use unique
  // fake ssh keys so the (NOT NULL) constraints are satisfied.
  const ins = db.prepare(`
    INSERT OR IGNORE INTO accounts
      (address, ssh_public_key, algo, fingerprint, credits, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const p of PERSONAS) {
      const joinedAt = Math.floor(START + p.join * (NOW - START));
      const fakeKey = `ssh-ed25519 AAAA_seed_${p.handle}_${crypto.randomBytes(6).toString('hex')} ${p.handle}@seed`;
      const fp = crypto.createHash('sha256').update(p.handle).digest('hex').slice(0, 32);
      ins.run(p.address, fakeKey, 'ssh-ed25519', fp, 1000, joinedAt, joinedAt);
    }
  });
  tx();
}

function fillTemplate(text, op, others) {
  return text
    .replace(/\{\{op\}\}/g, op ? op.handle : 'op')
    .replace(/\{\{user\}\}/g, pick(others).handle)
    .replace(/\{\{port\}\}/g, String(ri(2000, 65000)));
}

// Distribute N events over the 2-year window with an increasing rate.
// The rate at fraction f (0..1) of the timeline is proportional to (0.05 + f^2).
// This gives a tiny trickle in month 1 ramping to a busy feed by month 24.
function distributeTimestamps(n) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    // Inverse-CDF style: pick a uniform u, find f such that integral matches.
    // Cheap approximation: sqrt-biased then jittered, gives the same vibe.
    const u = rand();
    const f = Math.pow(u, 0.55); // bias toward 1
    const jitter = (rand() - 0.5) * 0.02;
    const frac = Math.max(0.001, Math.min(0.999, f + jitter));
    samples.push(START + frac * (NOW - START));
  }
  samples.sort((a, b) => a - b);
  return samples;
}

function insertPosts() {
  const insQ = db.prepare(`
    INSERT INTO forum_questions
      (author_address, title, body, tags_json, status,
       created_at, updated_at, bumped_at, bump_count, answer_count)
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, 0)
  `);

  const pool = [...TECH_POSTS, ...SHORT_POSTS];
  const memePool = MEMES;
  const timestamps = distributeTimestamps(TARGET_POSTS);
  const inserted = [];

  const tx = db.transaction(() => {
    for (let i = 0; i < TARGET_POSTS; i++) {
      const ts = Math.floor(timestamps[i]);
      const eligible = activeUsersAt(ts);
      if (eligible.length === 0) continue;
      const author = pick(eligible);
      const f = (ts - START) / (NOW - START);
      const memeRate = 0.08 + 0.22 * f; // 8% early, 30% late
      let template;
      if (author.tone === 'shitposter') {
        template = chance(0.7) ? pick(memePool) : pick(pool);
      } else {
        template = chance(memeRate) ? pick(memePool) : pick(pool);
      }
      const others = eligible.filter(p => p !== author);
      if (others.length === 0) others.push(author);
      const title = fillTemplate(template.title, author, others);
      const body = fillTemplate(template.body, author, others);
      const tags = JSON.stringify(shuffle(template.tags).slice(0, 3));
      const bumpedAt = chance(0.15) ? Math.min(NOW, ts + ri(1, 30) * DAY) : ts;
      const bumpCount = bumpedAt > ts ? ri(1, 3) : 0;
      const info = insQ.run(author.address, title, body, tags, ts, ts, bumpedAt, bumpCount);
      inserted.push({ id: info.lastInsertRowid, authorAddress: author.address, ts });
    }
  });
  tx();
  return inserted;
}

function insertComments(posts) {
  const insA = db.prepare(`
    INSERT INTO forum_answers (question_id, author_address, body, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const touch = db.prepare(`
    UPDATE forum_questions
       SET answer_count = answer_count + 1,
           updated_at = ?,
           bumped_at = MAX(bumped_at, ?),
           last_answered_at = ?,
           last_answered_by = ?,
           status = 'answered'
     WHERE id = ?
  `);

  // Posts get answers with a power-law-ish distribution: many get 0-1,
  // a handful get 8+. We pre-assign a "popularity" weight per post and
  // sample comments by that weight.
  const weights = posts.map(p => 0.2 + Math.pow(rand(), 3) * 5); // 0.2..5.2
  const cum = [];
  let total = 0;
  for (const w of weights) { total += w; cum.push(total); }

  function samplePost() {
    const r = rand() * total;
    // binary search
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    return posts[lo];
  }

  const tx = db.transaction(() => {
    for (let i = 0; i < TARGET_COMMENTS; i++) {
      const post = samplePost();
      // Comment timestamp: between the post and either now or +60d, biased
      // toward shortly-after the post (most engagement is fresh).
      const maxOffset = Math.min(NOW - post.ts, 60 * DAY);
      const offset = Math.floor(Math.pow(rand(), 2) * maxOffset) + ri(60_000, 6 * 60 * 60 * 1000);
      const ts = Math.min(NOW, post.ts + offset);

      const eligible = activeUsersAt(ts).filter(p => p.address !== post.authorAddress);
      if (eligible.length === 0) continue;
      const author = pick(eligible);

      // Pick a comment style based on tone.
      let pool;
      if (author.tone === 'shitposter') pool = chance(0.75) ? COMMENTS_MEME : COMMENTS_GENERIC;
      else if (author.tone === 'sysadmin') pool = chance(0.6) ? ANSWER_HELPFUL : COMMENTS_GENERIC;
      else pool = chance(0.25) ? COMMENTS_MEME : (chance(0.4) ? ANSWER_HELPFUL : COMMENTS_GENERIC);

      const opPersona = PERSONAS.find(p => p.address === post.authorAddress) || author;
      const others = eligible.length ? eligible : PERSONAS;
      const body = fillTemplate(pick(pool), opPersona, others);
      if (!body || body.length < 8) {
        // Some meme replies are too short for the production validator;
        // pad them with a soft second line so they still land.
        const padded = body + '\n(no notes)';
        insA.run(post.id, author.address, padded, ts);
      } else {
        insA.run(post.id, author.address, body, ts);
      }
      touch.run(ts, ts, ts, author.address, post.id);
    }
  });
  tx();
}

function maybeSavePosts(posts) {
  // Sprinkle some "saved" rows so the saved-posts feature has data.
  const ins = db.prepare(`
    INSERT OR IGNORE INTO forum_saved_posts (address, question_id, saved_at)
    VALUES (?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const p of PERSONAS) {
      const n = ri(0, 6);
      for (let i = 0; i < n; i++) {
        const post = posts[Math.floor(rand() * posts.length)];
        if (!post) continue;
        const savedAt = Math.min(NOW, post.ts + ri(0, 120) * DAY);
        ins.run(p.address, post.id, savedAt);
      }
    }
  });
  tx();
}

// ---------------------------------------------------------------------------
// Go.
// ---------------------------------------------------------------------------
function main() {
  wipeForumIfForced();
  console.log(`Seeding forum with ~${TARGET_POSTS} posts and ~${TARGET_COMMENTS} comments over ${SPAN_DAYS} days...`);
  ensureAccountsExist();
  console.log(`  ${PERSONAS.length} personas ready.`);
  const posts = insertPosts();
  console.log(`  ${posts.length} posts inserted.`);
  insertComments(posts);
  const cn = db.prepare('SELECT COUNT(*) AS n FROM forum_answers').get().n;
  console.log(`  ${cn} comments inserted.`);
  maybeSavePosts(posts);
  const sn = db.prepare('SELECT COUNT(*) AS n FROM forum_saved_posts').get().n;
  console.log(`  ${sn} saved-post rows.`);

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM accounts) AS accounts,
      (SELECT COUNT(*) FROM forum_questions) AS questions,
      (SELECT COUNT(*) FROM forum_answers) AS answers,
      (SELECT COUNT(*) FROM forum_questions WHERE status = 'answered') AS answered,
      (SELECT MIN(created_at) FROM forum_questions) AS first_ts,
      (SELECT MAX(created_at) FROM forum_questions) AS last_ts
  `).get();
  console.log('\nDone.');
  console.log(JSON.stringify({
    accounts: stats.accounts,
    questions: stats.questions,
    answers: stats.answers,
    answeredThreads: stats.answered,
    firstPost: new Date(stats.first_ts).toISOString(),
    lastPost: new Date(stats.last_ts).toISOString(),
  }, null, 2));
}

main();
