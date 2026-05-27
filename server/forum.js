const db = require('./db');

const MAX_TAGS = 4;
const BUMP_COOLDOWN_MS = 30 * 60 * 1000;

const PREFILLED_TAGS = [
  { slug: 'setup', label: 'Setup', description: 'first install, config, or boot flow' },
  { slug: 'bug-report', label: 'Bug report', description: 'something broken, regressed, or behaving wrong' },
  { slug: 'feature-request', label: 'Feature request', description: 'ideas, missing capabilities, proposals' },
  { slug: 'ssh', label: 'SSH', description: 'keys, auth, reverse forwarding, shells' },
  { slug: 'http', label: 'HTTP', description: 'web apps, routes, webhooks, browsers' },
  { slug: 'tcp', label: 'TCP', description: 'raw ports, databases, game servers' },
  { slug: 'handles', label: 'Handles', description: 'reserved subdomains and naming' },
  { slug: 'billing', label: 'Billing', description: 'credits, charges, balances, top-ups' },
  { slug: 'marketplace', label: 'Marketplace', description: 'leases, listings, buying and selling' },
  { slug: 'jobs', label: 'Looking for work', description: 'available for a role, contract, or collaboration' },
  { slug: 'hiring', label: 'Hiring', description: 'looking for a contractor, operator, or teammate' },
  { slug: 'project', label: 'Project', description: 'project help, collaboration, or partner search' },
  { slug: 'event', label: 'Event', description: 'meetups, demos, launches, calls, and community gatherings' },
  { slug: 'launch', label: 'Launch', description: 'new tool, program, service, or release announcement' },
  { slug: 'services', label: 'Services', description: 'offer or request consulting, setup, or managed help' },
  { slug: 'buy-sell', label: 'Buy / sell', description: 'digital goods, hardware, accounts, and equipment' },
  { slug: 'showcase', label: 'Showcase', description: 'share what you built or learned on the platform' },
  { slug: 'security', label: 'Security', description: 'auth, exposure risks, hardening' },
  { slug: 'docker', label: 'Docker', description: 'containers and dev environments' },
  { slug: 'linux', label: 'Linux', description: 'Linux-specific behavior' },
  { slug: 'windows', label: 'Windows', description: 'Windows-specific behavior' },
  { slug: 'macos', label: 'macOS', description: 'macOS-specific behavior' },
  { slug: 'database', label: 'Database', description: 'Postgres, MySQL, Redis, SQL' },
  { slug: 'troubleshooting', label: 'Troubleshooting', description: 'errors, debugging, odd behavior' },
];

const TAGS_BY_SLUG = Object.create(null);
for (const tag of PREFILLED_TAGS) TAGS_BY_SLUG[tag.slug] = tag;

const TAG_HINTS = [
  ['setup', ['install', 'setup', 'configure', 'config', 'getting started', 'first run', 'cannot start']],
  ['bug-report', ['bug', 'broken', 'regression', 'issue', 'not working', 'unexpected', 'crash', 'failing']],
  ['feature-request', ['feature request', 'feature', 'proposal', 'idea', 'would like', 'should support', 'can we have']],
  ['ssh', ['ssh', 'public key', 'private key', 'ed25519', 'reverse forward', 'reverse tunnel', 'permission denied']],
  ['http', ['http', 'https', 'webhook', 'browser', 'react', 'nextjs', 'frontend', 'host header', 'websocket', 'sse']],
  ['tcp', ['tcp', 'port', 'socket', 'minecraft', 'rdp', 'vnc', 'raw tunnel']],
  ['handles', ['handle', 'subdomain', 'domain', 'vanity', 'hostname', 'url name']],
  ['billing', ['credit', 'credits', 'billing', 'balance', 'charge', 'charged', 'cost', 'usd', 'top up']],
  ['marketplace', ['marketplace', 'listing', 'lease', 'rent', 'buyer', 'seller', 'sale']],
  ['jobs', ['job', 'freelance', 'contract', 'available', 'for hire', 'looking for work', 'resume']],
  ['hiring', ['hiring', 'looking for', 'need a developer', 'need help', 'contractor', 'recruit']],
  ['project', ['project', 'collaborate', 'partnership', 'cofounder', 'help me build', 'working on']],
  ['event', ['event', 'meetup', 'conference', 'demo day', 'hackathon', 'workshop', 'webinar']],
  ['launch', ['launch', 'released', 'shipping', 'new product', 'new service', 'announcing']],
  ['services', ['service', 'consulting', 'managed', 'setup help', 'support', 'agency']],
  ['buy-sell', ['buy', 'sell', 'selling', 'for sale', 'market', 'hardware', 'digital goods', 'license']],
  ['showcase', ['showcase', 'built', 'shipped', 'made with airweb', 'demo', 'case study']],
  ['security', ['secure', 'security', 'tls', 'ssl', 'auth', 'authentication', 'password', 'expose publicly', 'firewall']],
  ['docker', ['docker', 'container', 'compose', 'image', 'podman']],
  ['linux', ['linux', 'ubuntu', 'debian', 'fedora', 'systemd']],
  ['windows', ['windows', 'powershell', 'cmd.exe', 'wsl']],
  ['macos', ['macos', 'osx', 'sonoma', 'sequoia', 'launchd']],
  ['database', ['postgres', 'postgresql', 'mysql', 'mariadb', 'redis', 'mongodb', 'database', 'sql']],
  ['troubleshooting', ['error', 'failing', 'failed', 'broken', 'stuck', 'timeout', 'debug', 'troubleshoot']],
];

const stmts = {
  createQuestion: db.prepare(`
    INSERT INTO forum_questions (
      author_address, title, body, tags_json, status,
      created_at, updated_at, bumped_at, bump_count, answer_count
    ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, 0, 0)
  `),
  listFeed: db.prepare(`
    SELECT fq.*
    FROM forum_questions fq
    WHERE (? IS NULL OR fq.tags_json LIKE ?)
      AND (? IS NULL OR LOWER(fq.title) LIKE ? OR LOWER(fq.body) LIKE ?)
    ORDER BY fq.bumped_at DESC, fq.created_at DESC
    LIMIT ?
  `),
  getQuestion: db.prepare(`SELECT * FROM forum_questions WHERE id = ?`),
  getAnswers: db.prepare(`
    SELECT fa.*
    FROM forum_answers fa
    WHERE fa.question_id = ?
    ORDER BY fa.created_at ASC
  `),
  createAnswer: db.prepare(`
    INSERT INTO forum_answers (question_id, author_address, body, created_at)
    VALUES (?, ?, ?, ?)
  `),
  touchQuestionOnAnswer: db.prepare(`
    UPDATE forum_questions
    SET answer_count = answer_count + 1,
        updated_at = ?,
        bumped_at = ?,
        last_answered_at = ?,
        last_answered_by = ?,
        status = 'answered'
    WHERE id = ?
  `),
  bumpQuestion: db.prepare(`
    UPDATE forum_questions
    SET bumped_at = ?, updated_at = ?, bump_count = bump_count + 1
    WHERE id = ?
  `),
  questionCounts: db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open
    FROM forum_questions
  `),
  recentTags: db.prepare(`
    SELECT tags_json FROM forum_questions
    ORDER BY bumped_at DESC, created_at DESC
    LIMIT 100
  `),
  countPostsByAuthor: db.prepare(`
    SELECT COUNT(*) AS n FROM forum_questions WHERE author_address = ?
  `),
  countAnswersByAuthor: db.prepare(`
    SELECT COUNT(*) AS n FROM forum_answers WHERE author_address = ?
  `),
  countSavedByAddress: db.prepare(`
    SELECT COUNT(*) AS n FROM forum_saved_posts WHERE address = ?
  `),
  insertSavedPost: db.prepare(`
    INSERT OR IGNORE INTO forum_saved_posts (address, question_id, saved_at)
    VALUES (?, ?, ?)
  `),
  deleteSavedPost: db.prepare(`
    DELETE FROM forum_saved_posts WHERE address = ? AND question_id = ?
  `),
  isSavedPost: db.prepare(`
    SELECT 1 AS ok FROM forum_saved_posts WHERE address = ? AND question_id = ? LIMIT 1
  `),
  upsertUserState: db.prepare(`
    INSERT INTO forum_user_state (address, notifications_seen_at)
    VALUES (?, ?)
    ON CONFLICT(address) DO NOTHING
  `),
  updateNotificationsSeen: db.prepare(`
    UPDATE forum_user_state SET notifications_seen_at = ? WHERE address = ?
  `),
  getUserState: db.prepare(`
    SELECT notifications_seen_at FROM forum_user_state WHERE address = ?
  `),
  unreadNotifications: db.prepare(`
    SELECT COUNT(*) AS n
    FROM forum_answers fa
    JOIN forum_questions fq ON fq.id = fa.question_id
    LEFT JOIN forum_user_state fus ON fus.address = fq.author_address
    WHERE fq.author_address = ?
      AND fa.author_address <> ?
      AND fa.created_at > COALESCE(fus.notifications_seen_at, 0)
  `),
  popularPosts: db.prepare(`
    SELECT fq.*
    FROM forum_questions fq
    WHERE (? IS NULL OR fq.tags_json LIKE ?)
    ORDER BY (fq.answer_count * 4) + (fq.bump_count * 2) DESC, fq.bumped_at DESC
    LIMIT ?
  `),
  trendingAnswers: db.prepare(`
    SELECT fa.*, fq.title, fq.tags_json, fq.id AS thread_id
    FROM forum_answers fa
    JOIN forum_questions fq ON fq.id = fa.question_id
    ORDER BY fa.created_at DESC
    LIMIT ?
  `),
  receivedComments: db.prepare(`
    SELECT fa.*, fq.title, fq.tags_json, fq.id AS thread_id
    FROM forum_answers fa
    JOIN forum_questions fq ON fq.id = fa.question_id
    WHERE fq.author_address = ?
      AND fa.author_address <> ?
    ORDER BY fa.created_at DESC
    LIMIT ?
  `),
  countReceivedComments: db.prepare(`
    SELECT COUNT(*) AS n
    FROM forum_answers fa
    JOIN forum_questions fq ON fq.id = fa.question_id
    WHERE fq.author_address = ?
      AND fa.author_address <> ?
  `),
};

function normalizeWhitespace(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeTitle(text) {
  const title = normalizeWhitespace(text).replace(/\s+/g, ' ').trim();
  return title.slice(0, 140);
}

function sanitizeBody(text) {
  return normalizeWhitespace(text).slice(0, 5000);
}

function validTag(slug) {
  return typeof slug === 'string' && !!TAGS_BY_SLUG[slug];
}

function normalizeTags(tags) {
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const slug = String(raw || '').trim().toLowerCase();
    if (!validTag(slug) || out.includes(slug)) continue;
    out.push(slug);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function recommendTags(title, body) {
  const hay = `${title || ''}\n${body || ''}`.toLowerCase();
  const scores = new Map();
  for (const [slug, hints] of TAG_HINTS) {
    let score = 0;
    for (const hint of hints) {
      if (hay.includes(hint)) score += hint.includes(' ') ? 2 : 1;
    }
    if (score > 0) scores.set(slug, score);
  }
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAGS)
    .map(([slug]) => slug);
}

function parseQuestion(row) {
  if (!row) return null;
  let tags = [];
  try { tags = normalizeTags(JSON.parse(row.tags_json || '[]')); }
  catch (_) { tags = []; }
  return {
    id: row.id,
    authorAddress: row.author_address,
    title: row.title,
    body: row.body,
    tags,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bumpedAt: row.bumped_at,
    bumpCount: row.bump_count || 0,
    answerCount: row.answer_count || 0,
    lastAnsweredAt: row.last_answered_at || null,
    lastAnsweredBy: row.last_answered_by || null,
    saved: false,
  };
}

function parseAnswer(row) {
  if (!row) return null;
  return {
    id: row.id,
    questionId: row.question_id,
    authorAddress: row.author_address,
    body: row.body,
    createdAt: row.created_at,
    threadId: row.thread_id || row.question_id,
    threadTitle: row.title || null,
    tags: row.tags_json ? normalizeTags(JSON.parse(row.tags_json || '[]')) : [],
  };
}

function withSavedFlag(question, viewerAddress) {
  if (!question || !viewerAddress) return question;
  return Object.assign({}, question, { saved: !!stmts.isSavedPost.get(viewerAddress, question.id) });
}

function createQuestion(authorAddress, input) {
  const title = sanitizeTitle(input && input.title);
  const body = sanitizeBody(input && input.body);
  if (!title || title.length < 8) {
    const err = new Error('invalid_title');
    err.code = 'INVALID_TITLE';
    throw err;
  }
  if (!body || body.length < 20) {
    const err = new Error('invalid_body');
    err.code = 'INVALID_BODY';
    throw err;
  }
  const recommended = recommendTags(title, body);
  const tags = normalizeTags((input && input.tags) || recommended);
  const now = Date.now();
  const result = stmts.createQuestion.run(
    authorAddress,
    title,
    body,
    JSON.stringify(tags),
    now,
    now,
    now,
  );
  return getQuestion(result.lastInsertRowid);
}

function listQuestions(options = {}) {
  const tag = validTag(options.tag) ? options.tag : null;
  const search = String(options.q || '').trim().toLowerCase();
  const searchLike = search ? `%${search}%` : null;
  return stmts.listFeed.all(
    tag,
    tag ? `%"${tag}"%` : null,
    search || null,
    searchLike,
    searchLike,
    Math.min(100, Math.max(1, Number(options.limit) || 40)),
  ).map(parseQuestion).map((question) => withSavedFlag(question, options.viewerAddress));
}

function getQuestion(id) {
  return parseQuestion(stmts.getQuestion.get(Number(id)));
}

function getQuestionThread(id, viewerAddress) {
  const question = withSavedFlag(getQuestion(id), viewerAddress);
  if (!question) return null;
  const answers = stmts.getAnswers.all(Number(id)).map(parseAnswer);
  return { question, answers };
}

function answerQuestion(authorAddress, questionId, input) {
  const question = getQuestion(questionId);
  if (!question) {
    const err = new Error('question_not_found');
    err.code = 'QUESTION_NOT_FOUND';
    throw err;
  }
  const body = sanitizeBody(input && input.body);
  if (!body || body.length < 8) {
    const err = new Error('invalid_answer');
    err.code = 'INVALID_ANSWER';
    throw err;
  }
  const now = Date.now();
  const tx = db.transaction(() => {
    stmts.createAnswer.run(Number(questionId), authorAddress, body, now);
    stmts.touchQuestionOnAnswer.run(now, now, now, authorAddress, Number(questionId));
  });
  tx();
  return getQuestionThread(questionId);
}

function bumpQuestion(actorAddress, questionId) {
  const question = getQuestion(questionId);
  if (!question) {
    const err = new Error('question_not_found');
    err.code = 'QUESTION_NOT_FOUND';
    throw err;
  }
  if (!actorAddress) {
    const err = new Error('unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const now = Date.now();
  if (question.bumpedAt && now - question.bumpedAt < BUMP_COOLDOWN_MS) {
    const err = new Error('bump_cooldown');
    err.code = 'BUMP_COOLDOWN';
    err.retryAt = question.bumpedAt + BUMP_COOLDOWN_MS;
    throw err;
  }
  stmts.bumpQuestion.run(now, now, Number(questionId));
  return getQuestion(questionId);
}

function toggleSavedPost(address, questionId) {
  if (!address) {
    const err = new Error('unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const question = getQuestion(questionId);
  if (!question) {
    const err = new Error('question_not_found');
    err.code = 'QUESTION_NOT_FOUND';
    throw err;
  }
  const saved = !!stmts.isSavedPost.get(address, Number(questionId));
  if (saved) {
    stmts.deleteSavedPost.run(address, Number(questionId));
    return { saved: false, questionId: Number(questionId) };
  }
  stmts.insertSavedPost.run(address, Number(questionId), Date.now());
  return { saved: true, questionId: Number(questionId) };
}

function ensureUserState(address) {
  if (!address) return null;
  stmts.upsertUserState.run(address, 0);
  return stmts.getUserState.get(address) || { notifications_seen_at: 0 };
}

function markNotificationsSeen(address) {
  if (!address) return;
  ensureUserState(address);
  stmts.updateNotificationsSeen.run(Date.now(), address);
}

function unreadNotificationCount(address) {
  if (!address) return 0;
  ensureUserState(address);
  const row = stmts.unreadNotifications.get(address, address) || { n: 0 };
  return row.n || 0;
}

function popularPostsByTopic(topic, limit = 4, viewerAddress) {
  const tag = validTag(topic) ? topic : null;
  return stmts.popularPosts.all(
    tag,
    tag ? `%"${tag}"%` : null,
    Math.min(12, Math.max(1, Number(limit) || 4)),
  ).map(parseQuestion).map((question) => withSavedFlag(question, viewerAddress));
}

function trendingComments(limit = 5) {
  return stmts.trendingAnswers.all(Math.min(12, Math.max(1, Number(limit) || 5))).map(parseAnswer);
}

function listReceivedComments(address, limit = 30) {
  if (!address) return [];
  const cap = Math.min(100, Math.max(1, Number(limit) || 30));
  return stmts.receivedComments.all(address, address, cap).map(parseAnswer);
}

function profileSummary(address) {
  if (!address) return null;
  ensureUserState(address);
  return {
    postCount: (stmts.countPostsByAuthor.get(address) || { n: 0 }).n || 0,
    commentCount: (stmts.countAnswersByAuthor.get(address) || { n: 0 }).n || 0,
    savedCount: (stmts.countSavedByAddress.get(address) || { n: 0 }).n || 0,
    receivedCount: (stmts.countReceivedComments.get(address, address) || { n: 0 }).n || 0,
    unreadCount: unreadNotificationCount(address),
  };
}

function stats() {
  const row = stmts.questionCounts.get() || {};
  const tagCounts = Object.create(null);
  for (const entry of stmts.recentTags.all()) {
    let tags = [];
    try { tags = normalizeTags(JSON.parse(entry.tags_json || '[]')); }
    catch (_) { tags = []; }
    for (const tag of tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  return {
    totalQuestions: row.total || 0,
    answeredQuestions: row.answered || 0,
    openQuestions: row.open || 0,
    hotTags: Object.keys(tagCounts)
      .sort((a, b) => (tagCounts[b] - tagCounts[a]) || a.localeCompare(b))
      .slice(0, 6),
  };
}

module.exports = {
  PREFILLED_TAGS,
  MAX_TAGS,
  recommendTags,
  createQuestion,
  listQuestions,
  getQuestion,
  getQuestionThread,
  answerQuestion,
  bumpQuestion,
  toggleSavedPost,
  markNotificationsSeen,
  profileSummary,
  popularPostsByTopic,
  trendingComments,
  listReceivedComments,
  stats,
};