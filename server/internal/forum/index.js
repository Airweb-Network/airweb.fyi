const config = require('../../config');
const accounts = require('../../accounts');
const forum = require('../../forum');
const { createInternalServer, escapeHtml } = require('../base');
const { LOCALES, t, tagMeta: translatedTagMeta, formatTimeAgo, countLabel } = require('./translations');

const COOKIE_NAME = (config.sessions && config.sessions.cookieName) || 'airweb_sid';
const LOCALE_SET = new Set(LOCALES);

function pickLocale(req) {
  const cookie = (req && req.headers && req.headers.cookie) || '';
  const match = cookie.match(/(?:^|;\s*)airweb-locale=([A-Za-z\-]+)/);
  if (!match) return 'en';
  const base = String(match[1]).toLowerCase().split('-')[0];
  return LOCALE_SET.has(base) ? base : 'en';
}

function apexBase() {
  return (config.http && config.http.publicBaseUrl) || `http://${(config.http && config.http.publicDomain) || 'localhost'}`;
}

function parseCookies(req) {
  const h = (req && req.headers && req.headers.cookie) || '';
  const out = Object.create(null);
  for (const part of h.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  return token ? accounts.resolveSession(token) : null;
}

function readBody(req, limit = 128 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        return reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readForm(req) {
  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const out = Object.create(null);
  for (const [key, value] of params.entries()) {
    const normalized = key.endsWith('[]') ? key.slice(0, -2) : key;
    if (Object.prototype.hasOwnProperty.call(out, normalized)) {
      if (!Array.isArray(out[normalized])) out[normalized] = [out[normalized]];
      out[normalized].push(value);
    } else {
      out[normalized] = key.endsWith('[]') ? [value] : value;
    }
  }
  return out;
}

function html(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function redirect(res, to) {
  res.writeHead(303, { Location: to || '/' });
  res.end();
}

function notFound(req, res, ctx, session) {
  const locale = pickLocale(req);
  const page = renderPage(req, {
    ctx,
    session,
    locale,
    title: t(locale, 'questionNotFoundTitle'),
    lead: t(locale, 'questionNotFoundLead'),
    content: `
      <section class="forum-card empty-state">
        <h1>${escapeHtml(t(locale, 'questionNotFoundTitle'))}</h1>
        <p>${escapeHtml(t(locale, 'questionNotFoundBody'))}</p>
      </section>
    `,
  });
  html(res, 404, page);
}

function shortenAddress(address, locale) {
  const body = String(address || '').replace(/^aw_/, '');
  if (!body) return t(locale, 'anonymous');
  return body.length > 10 ? `${body.slice(0, 4)}…${body.slice(-4)}` : body;
}

function nl2br(text) {
  return escapeHtml(String(text || '')).replace(/\n/g, '<br>');
}

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi;

function extractUrls(text) {
  const out = [];
  if (!text) return out;
  const matches = String(text).match(URL_REGEX) || [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;!?)\]]+$/, '');
    if (cleaned && out.indexOf(cleaned) < 0) out.push(cleaned);
    if (out.length >= 4) break;
  }
  return out;
}

function classifyMediaUrl(url) {
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) return 'image';
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)) return 'video';
  if (/(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/i.test(url)) return 'youtube';
  if (/vimeo\.com\/(\d+)/i.test(url)) return 'vimeo';
  return 'link';
}

function youtubeId(url) {
  let m = url.match(/youtu\.be\/([\w-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]v=([\w-]+)/);
  if (m) return m[1];
  m = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (m) return m[1];
  return null;
}

function renderMediaEmbed(url) {
  const kind = classifyMediaUrl(url);
  const safe = escapeHtml(url);
  if (kind === 'image') {
    return `<img class="media-embed" loading="lazy" alt="" src="${safe}">`;
  }
  if (kind === 'video') {
    return `<video class="video-embed" controls preload="metadata" src="${safe}"></video>`;
  }
  if (kind === 'youtube') {
    const id = youtubeId(url);
    if (id) {
      return `<iframe class="video-embed" loading="lazy" src="https://www.youtube.com/embed/${encodeURIComponent(id)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
  }
  if (kind === 'vimeo') {
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) {
      return `<iframe class="video-embed" loading="lazy" src="https://player.vimeo.com/video/${encodeURIComponent(vm[1])}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
  }
  // generic link — hydrated client-side
  let host = '';
  try { host = new URL(url).host; } catch (_) { host = url; }
  return `<a class="link-card" href="${safe}" target="_blank" rel="noopener noreferrer" data-link-preview="${safe}">
    <div class="lc-body">
      <div class="lc-title">${escapeHtml(url)}</div>
      <div class="lc-host">${escapeHtml(host)}</div>
    </div>
  </a>`;
}

function renderPostMedia(body) {
  const urls = extractUrls(body);
  if (!urls.length) return '';
  const items = urls.map(renderMediaEmbed).filter(Boolean);
  if (!items.length) return '';
  return `<div class="post-media">${items.join('')}</div>`;
}

function tagMeta(slug, locale) {
  const base = forum.PREFILLED_TAGS.find((item) => item.slug === slug) || { slug, label: slug, description: '' };
  return translatedTagMeta(locale, slug, base);
}

const INTENT_ORDER = [
  'bug-report',
  'feature-request',
  'jobs',
  'hiring',
  'project',
  'event',
  'launch',
  'services',
  'buy-sell',
  'showcase',
  'marketplace',
  'setup',
];

const INTENT_ICONS = {
  'bug-report': '🐛',
  'feature-request': '✨',
  'jobs': '💼',
  'hiring': '📣',
  'project': '🤝',
  'event': '📅',
  'launch': '🚀',
  'services': '🛠️',
  'buy-sell': '💱',
  'showcase': '🎨',
  'marketplace': '🏪',
  'setup': '⚙️',
  'ssh': '🔑',
  'http': '🌐',
  'tcp': '🔌',
  'handles': '🏷️',
  'billing': '💳',
  'security': '🛡️',
  'docker': '🐳',
  'linux': '🐧',
  'windows': '🪟',
  'macos': '🍎',
  'database': '🗄️',
  'troubleshooting': '🧰',
};

function intentIcon(slug) {
  return INTENT_ICONS[slug] || '🏷️';
}

const TAG_GROUPS = [
  {
    title: 'What are you posting?',
    tags: ['setup', 'bug-report', 'feature-request', 'jobs', 'hiring', 'project', 'event', 'launch', 'services', 'buy-sell', 'showcase'],
  },
  {
    title: 'Technical context',
    tags: ['ssh', 'http', 'tcp', 'handles', 'billing', 'marketplace', 'security', 'docker', 'linux', 'windows', 'macos', 'database', 'troubleshooting'],
  },
];

function intentSlug(tags) {
  for (const slug of INTENT_ORDER) {
    if (Array.isArray(tags) && tags.includes(slug)) return slug;
  }
  return (Array.isArray(tags) && tags[0]) || 'setup';
}

function intentLabel(tags, locale) {
  const tag = tagMeta(intentSlug(tags), locale);
  return tag.label;
}

function intentClass(slug) {
  if (slug === 'bug-report') return 'danger';
  if (slug === 'feature-request' || slug === 'launch' || slug === 'showcase') return 'accent';
  if (slug === 'jobs' || slug === 'hiring' || slug === 'buy-sell' || slug === 'services') return 'good';
  if (slug === 'event' || slug === 'project' || slug === 'marketplace') return 'warm';
  return 'default';
}

function renderTag(slug, active, locale) {
  const tag = tagMeta(slug, locale);
  return `<a class="tag-chip${active ? ' active' : ''}" href="/?tag=${encodeURIComponent(tag.slug)}" title="${escapeHtml(tag.description || tag.label)}">#${escapeHtml(tag.label)}</a>`;
}

function renderTagChecks(selected, locale) {
  const set = new Set(Array.isArray(selected) ? selected : []);
  return TAG_GROUPS.map((group) => `
    <section class="tag-group">
      <div class="subhead">${escapeHtml(group.title === 'What are you posting?' ? t(locale, 'groupingWhatPosting') : t(locale, 'groupingContext'))}</div>
      <div class="tag-grid">
        ${group.tags.map((slug) => {
          const tag = tagMeta(slug, locale);
          return `
            <label class="tag-option${set.has(tag.slug) ? ' selected' : ''}" data-tag="${escapeHtml(tag.slug)}">
              <input type="checkbox" name="tags[]" value="${escapeHtml(tag.slug)}"${set.has(tag.slug) ? ' checked' : ''}>
              <span>
                <strong>#${escapeHtml(tag.label)}</strong>
                <small>${escapeHtml(tag.description)}</small>
              </span>
            </label>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function renderSaveButton(question, opts) {
  if (!opts.session) return '';
  const locale = opts.locale || 'en';
  return `
    <form method="post" action="/q/${question.id}/save" class="inline-form save-form">
      <input type="hidden" name="returnTo" value="${escapeHtml(opts.returnTo || '/')}">
      <button type="submit" class="ghost small save-btn${question.saved ? ' saved' : ''}">${escapeHtml(question.saved ? t(locale, 'savedState') : t(locale, 'save'))}</button>
    </form>
  `;
}

function renderBumpControl(question, opts) {
  if (opts.canBump) {
    return `
      <form method="post" action="/q/${question.id}/bump" class="inline-form">
        <input type="hidden" name="returnTo" value="${escapeHtml(opts.returnTo || '/')}">
        <button type="submit" class="plus-one-btn" title="+1 this thread">
          <span class="plus-one-label">+1</span>
          <strong class="plus-one-count">${question.bumpCount || 0}</strong>
        </button>
      </form>
    `;
  }
  return `
    <span class="plus-one-btn static" aria-label="+1 count">
      <span class="plus-one-label">+1</span>
      <strong class="plus-one-count">${question.bumpCount || 0}</strong>
    </span>
  `;
}

function renderQuestionCard(question, opts) {
  const locale = opts.locale || 'en';
  const intent = intentSlug(question.tags);
  const tags = question.tags.map((tag) => renderTag(tag, opts.activeTag === tag, locale)).join('');
  const excerpt = question.body.length > 320 ? `${question.body.slice(0, 320).trim()}…` : question.body;
  const commentsLabel = countLabel(locale, 'answer', question.answerCount);
  return `
    <article class="forum-card question-card${opts.featured ? ' featured' : ''}" data-question-id="${question.id}">
      <div class="question-topline">
        <div class="question-meta">
          <span class="intent-pill ${intentClass(intent)}">${escapeHtml(intentLabel(question.tags, locale))}</span>
          <span class="pill ${question.status === 'answered' ? 'ok' : 'warn'}">${escapeHtml(question.status === 'answered' ? t(locale, 'answered') : t(locale, 'open'))}</span>
          <span>${escapeHtml(t(locale, 'by'))} <code>${escapeHtml(shortenAddress(question.authorAddress, locale))}</code></span>
          <span class="meta-sep">•</span>
          <span>${escapeHtml(formatTimeAgo(locale, question.bumpedAt))}</span>
        </div>
        <div class="question-actions">
          ${renderSaveButton(question, opts)}
          ${renderBumpControl(question, opts)}
        </div>
      </div>
      <h2><a href="/q/${question.id}">${escapeHtml(question.title)}</a></h2>
      <p class="question-excerpt">${nl2br(excerpt)}</p>
      ${renderPostMedia(question.body)}
      <div class="question-footer">
        <div class="tags-row">${tags || `<span class="mute">${escapeHtml(t(locale, 'noTags'))}</span>`}</div>
        <button type="button" class="comments-toggle" data-comments-toggle data-question-id="${question.id}" aria-expanded="false">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 3.5h11v8H6L3 14V11.5H2.5z" stroke-linejoin="round"/></svg>
          <span class="comments-toggle-label">${escapeHtml(commentsLabel)}</span>
          <span class="caret" aria-hidden="true">▾</span>
        </button>
      </div>
      <div class="comments-panel" data-comments-panel hidden>
        <div class="comments-loading">Loading…</div>
      </div>
    </article>
  `;
}

function renderAskForm(state) {
  const locale = state.locale || 'en';
  const signedIn = !!(state.session && state.session.account);
  const draft = state.askDraft || {};
  const selectedTags = Array.isArray(draft.tags) ? draft.tags : [];
  const disabled = signedIn ? '' : ' disabled';
  const cta = signedIn
    ? `<button type="submit" class="primary">${escapeHtml(t(locale, 'publishPost'))}</button>`
    : `<a class="primary button-link" href="${escapeHtml(state.apex)}/login">${escapeHtml(t(locale, 'loginToPublish'))}</a>`;
  const currentIntent = (selectedTags.find((slug) => INTENT_ORDER.indexOf(slug) >= 0)) || 'setup';
  const typeOptions = INTENT_ORDER.map((slug) => {
    const tag = tagMeta(slug, locale);
    const sel = slug === currentIntent ? ' selected' : '';
    return `<option value="${escapeHtml(slug)}"${sel}>${intentIcon(slug)}  ${escapeHtml(tag.label)}</option>`;
  }).join('');
  const allTagsJson = JSON.stringify(forum.PREFILLED_TAGS.map((tag) => ({
    slug: tag.slug,
    label: translatedTagMeta(locale, tag.slug, tag).label,
    icon: intentIcon(tag.slug),
  })));
  // Initial chips: existing draft tags (minus the chosen intent slug — it's represented by the dropdown)
  const initialChips = selectedTags.filter((slug) => slug !== currentIntent);
  const chipsHtml = initialChips.map((slug) => {
    const tag = tagMeta(slug, locale);
    return `<span class="chip" data-tag="${escapeHtml(slug)}"><span class="chip-icon">${intentIcon(slug)}</span>#${escapeHtml(tag.label)}<button type="button" class="chip-x" data-chip-remove aria-label="remove">×</button><input type="hidden" name="tags[]" value="${escapeHtml(slug)}"></span>`;
  }).join('');
  return `
    <section class="ask-card" id="ask">
      ${state.askError ? `<div class="flash error">${escapeHtml(state.askError)}</div>` : ''}
      <form method="post" action="/ask" class="compose-form" id="askForm" data-all-tags='${escapeHtml(allTagsJson)}'>
        <div class="compose-row">
          <label class="compose-field type-field">
            <span class="compose-label">${escapeHtml(t(locale, 'postType'))}</span>
            <select name="postType" id="postType"${disabled}>${typeOptions}</select>
          </label>
          <label class="compose-field title-field">
            <span class="compose-label">${escapeHtml(t(locale, 'titleLabel'))}</span>
            <input type="text" name="title" maxlength="140" placeholder="${escapeHtml(t(locale, 'titlePlaceholder'))}" value="${escapeHtml(draft.title || '')}"${disabled} autocomplete="off">
          </label>
        </div>
        <label class="compose-field body-field">
          <span class="compose-label">${escapeHtml(t(locale, 'bodyLabel'))}</span>
          <textarea name="body" id="composeBody" rows="5" maxlength="5000" placeholder="${escapeHtml(t(locale, 'bodyPlaceholder'))} — paste image, video, or web URLs to embed them"${disabled}>${escapeHtml(draft.body || '')}</textarea>
        </label>
        <div class="media-preview" id="mediaPreview" hidden></div>
        <label class="compose-field tag-field">
          <span class="compose-label">${escapeHtml(t(locale, 'tagsLabel'))}</span>
          <div class="tag-input" id="tagInput">
            <div class="chip-list" id="chipList">${chipsHtml}</div>
            <input type="text" id="chipEntry" class="chip-entry" placeholder="add a tag…" autocomplete="off"${disabled}>
          </div>
          <div class="tag-suggestions" id="tagSuggestions" hidden></div>
        </label>
        <div class="form-actions compose-actions">
          <span class="fine-print">${escapeHtml(t(locale, 'askFinePrint', { count: forum.MAX_TAGS }))}</span>
          <div class="actions-buttons">
            <button type="button" class="ghost" data-close-compose>${escapeHtml(t(locale, 'close'))}</button>
            ${cta}
          </div>
        </div>
      </form>
    </section>
  `;
}

function renderTopicColumn(title, posts, state) {
  const locale = state.locale || 'en';
  const items = posts.length ? posts.map((post) => `
    <a class="mini-thread" href="/q/${post.id}">
      <strong>${escapeHtml(post.title)}</strong>
      <span>${escapeHtml(countLabel(locale, 'answer', post.answerCount))}</span>
    </a>
  `).join('') : `<div class="mini-empty">${escapeHtml(t(locale, 'quietRightNow'))}</div>`;
  return `
    <section class="forum-card discovery-card">
      <div class="section-head compact"><h3>${escapeHtml(title)}</h3></div>
      <div class="mini-list">${items}</div>
    </section>
  `;
}

function renderTrendingComments(state) {
  const locale = state.locale || 'en';
  const items = (state.trendingComments || []).length
    ? state.trendingComments.map((comment) => {
        const excerpt = comment.body.length > 120 ? `${comment.body.slice(0, 120).trim()}…` : comment.body;
        return `
          <a class="comment-blip" href="/q/${comment.threadId}#reply">
            <div class="comment-blip-head">
              <strong>${escapeHtml(comment.threadTitle || t(locale, 'threadFallback'))}</strong>
              <span>${escapeHtml(formatTimeAgo(locale, comment.createdAt))}</span>
            </div>
            <p>${escapeHtml(excerpt)}</p>
          </a>
        `;
      }).join('')
    : `<div class="mini-empty">${escapeHtml(t(locale, 'noRecentComments'))}</div>`;
  return `
    <section class="forum-card discovery-card">
      <div class="section-head compact"><h3>${escapeHtml(t(locale, 'trendingComments'))}</h3></div>
      <div class="comment-blip-list">${items}</div>
    </section>
  `;
}

function renderForumStatusCard(state) {
  const locale = state.locale || 'en';
  const profile = state.profile || { postCount: 0, commentCount: 0, savedCount: 0, receivedCount: 0, unreadCount: 0 };
  const signedIn = !!(state.session && state.session.account);
  const postCount     = signedIn ? (profile.postCount     || 0) : 0;
  const commentCount  = signedIn ? (profile.commentCount  || 0) : 0;
  const savedCount    = signedIn ? (profile.savedCount    || 0) : 0;
  // Comments received on the user's own posts. Backwards-compat: fall back to
  // commentCount when the dedicated field isn't populated yet.
  const receivedCount = signedIn ? (profile.receivedCount != null ? profile.receivedCount : (profile.commentCount || 0)) : 0;
  const unread        = signedIn ? (profile.unreadCount   || 0) : 0;

  const composeAction = signedIn
    ? `<button type="button" class="stat-tile stat-action" data-open-compose aria-label="${escapeHtml(t(locale, 'newPost'))}">
         <span class="stat-action-icon" aria-hidden="true">+</span>
         <span class="stat-action-label">${escapeHtml(t(locale, 'newPost'))}</span>
       </button>`
    : `<a class="stat-tile stat-action" href="${escapeHtml(state.apex)}/login" aria-label="${escapeHtml(t(locale, 'logInToPost'))}">
         <span class="stat-action-icon" aria-hidden="true">→</span>
         <span class="stat-action-label">${escapeHtml(t(locale, 'logInToPost'))}</span>
       </a>`;

  return `
    <section class="forum-card forum-status-card">
      <div class="profile-stat-grid">
        <div class="stat-tile"><strong>${postCount}</strong><span>${escapeHtml(t(locale, 'postsLabel'))}</span></div>
        <div class="stat-tile"><strong>${commentCount}</strong><span>${escapeHtml(t(locale, 'commentsLabel'))}</span></div>
        <div class="stat-tile"><strong>${savedCount}</strong><span>${escapeHtml(t(locale, 'savedLabel'))}</span></div>
        <a class="stat-tile stat-tile-link" href="/notifications" aria-label="${escapeHtml(t(locale, 'commentsReceived'))}">
          <strong>${receivedCount}</strong>
          <span>${escapeHtml(t(locale, 'receivedLabel'))}</span>
          ${unread > 0 ? `<span class="stat-tile-pill">${unread}</span>` : ''}
        </a>
        ${composeAction}
      </div>
    </section>
  `;
}

function renderCommentsReceivedCard(state) {
  const locale = state.locale || 'en';
  const profile = state.profile || { commentCount: 0, unreadCount: 0 };
  const signedIn = !!(state.session && state.session.account);
  const unread = signedIn ? (profile.unreadCount || 0) : 0;
  const total = signedIn ? (profile.commentCount || 0) : 0;
  return `
    <a class="forum-card comments-received-card" href="/notifications">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(t(locale, 'commentsReceived'))}</h3>
          <span class="mute fine-print">${total} ${escapeHtml(t(locale, 'commentsLabel'))}</span>
        </div>
        ${unread > 0 ? `<span class="notif-pill hot">${unread}</span>` : ''}
      </div>
    </a>
  `;
}

function renderSidebar(state) {
  const locale = state.locale || 'en';
  const stats = state.stats || { totalQuestions: 0, answeredQuestions: 0, openQuestions: 0, hotTags: [] };
  const hotTags = stats.hotTags.map((tag) => renderTag(tag, state.activeTag === tag, locale)).join('');
  return `
    <aside class="forum-sidebar">
      <section class="forum-card stat-card">
        <div class="section-head">
          <div>
            <span class="kicker">${escapeHtml(t(locale, 'pulse'))}</span>
            <h2>${escapeHtml(t(locale, 'communityGlance'))}</h2>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-tile"><strong>${stats.totalQuestions}</strong><span>${escapeHtml(t(locale, 'threads'))}</span></div>
          <div class="stat-tile"><strong>${stats.openQuestions}</strong><span>${escapeHtml(t(locale, 'open'))}</span></div>
          <div class="stat-tile"><strong>${stats.answeredQuestions}</strong><span>${escapeHtml(t(locale, 'answered'))}</span></div>
        </div>
        <div class="hot-tags-block">
          <div class="subhead">${escapeHtml(t(locale, 'activeTags'))}</div>
          <div class="tags-row">${hotTags || `<span class="mute">${escapeHtml(t(locale, 'noTags'))}</span>`}</div>
        </div>
      </section>
      ${renderTopicColumn(t(locale, 'popularLaunches'), state.popularLaunches || [], state)}
      ${renderTopicColumn(t(locale, 'popularJobs'), state.popularJobs || [], state)}
      ${renderTopicColumn(t(locale, 'popularTroubleshooting'), state.popularTroubleshooting || [], state)}
      ${renderTrendingComments(state)}
    </aside>
  `;
}

function renderComposeModal(state) {
  const open = state.askError ? ' open' : '';
  const locale = state.locale || 'en';
  return `
    <div class="compose-modal${open}" id="composeModal" aria-hidden="${state.askError ? 'false' : 'true'}">
      <div class="compose-backdrop" data-close-compose></div>
      <div class="compose-panel" role="dialog" aria-modal="true" aria-labelledby="composeHeading">
        <div class="compose-head">
          <h2 id="composeHeading">${escapeHtml(t(locale, 'startPost'))}</h2>
          <button type="button" class="ghost small" data-close-compose>${escapeHtml(t(locale, 'close'))}</button>
        </div>
        ${renderAskForm(state)}
      </div>
    </div>
  `;
}

function renderFeed(req, state) {
  const locale = state.locale || 'en';
  const searchValue = escapeHtml(state.search || '');
  const filters = ['bug-report', 'jobs', 'event', 'launch', 'services', 'buy-sell', 'showcase', 'marketplace', 'troubleshooting']
    .map((slug) => renderTag(slug, state.activeTag === slug, locale)).join('');
  const cards = state.questions.length
    ? state.questions.map((item, index) => renderQuestionCard(item, {
        locale,
        activeTag: state.activeTag,
        canBump: !!state.session,
        returnTo: req.url || '/',
        featured: index === 0 && !state.activeTag && !state.search,
      })).join('')
    : `
      <section class="forum-card empty-state">
        <h2>${escapeHtml(t(locale, 'noQuestionsMatch'))}</h2>
        <p>${escapeHtml(t(locale, 'noQuestionsBody'))}</p>
      </section>
    `;
  return `
    <section class="forum-main">
      <section class="forum-card hero-card forum-shell-header">
        <div class="hero-copy">
          <h1 class="hero-title">${escapeHtml(t(locale, 'heroTitle'))}</h1>
        </div>
        <form method="get" action="/" class="search-bar">
          <input type="search" name="q" value="${searchValue}" placeholder="${escapeHtml(t(locale, 'searchPlaceholder'))}">
          ${state.activeTag ? `<input type="hidden" name="tag" value="${escapeHtml(state.activeTag)}">` : ''}
          <button type="submit" class="primary">${escapeHtml(t(locale, 'search'))}</button>
        </form>
        <div class="tags-row filters-row">${filters}</div>
      </section>
      ${renderForumStatusCard(state)}
      ${state.feedError ? `<div class="flash error">${escapeHtml(state.feedError)}</div>` : ''}
      <div class="forum-list">${cards}</div>
    </section>
    ${renderSidebar(state)}
    ${renderComposeModal(state)}
  `;
}

function renderDetail(req, state) {
  const locale = state.locale || 'en';
  const thread = state.thread;
  const question = thread.question;
  const answers = thread.answers;
  const intent = intentSlug(question.tags);
  const tags = question.tags.map((tag) => renderTag(tag, state.activeTag === tag, locale)).join('');
  const bumpForm = state.session ? `
    <form method="post" action="/q/${question.id}/bump" class="inline-form">
      <input type="hidden" name="returnTo" value="/q/${question.id}">
      <button type="submit" class="plus-one-btn" title="+1 this thread">
        <span class="plus-one-label">+1</span>
        <strong class="plus-one-count">${question.bumpCount || 0}</strong>
      </button>
    </form>
  ` : `
    <span class="plus-one-btn static" aria-label="+1 count">
      <span class="plus-one-label">+1</span>
      <strong class="plus-one-count">${question.bumpCount || 0}</strong>
    </span>
  `;
  const answersHtml = answers.length
    ? answers.map((answer, index) => `
        <article class="forum-card answer-card">
          <div class="question-meta">
            <span class="pill ok">${escapeHtml(t(locale, 'answerCard', { count: index + 1 }))}</span>
            <span>${escapeHtml(t(locale, 'by'))} <code>${escapeHtml(shortenAddress(answer.authorAddress, locale))}</code></span>
            <span>•</span>
            <span>${escapeHtml(formatTimeAgo(locale, answer.createdAt))}</span>
          </div>
          <div class="prose">${nl2br(answer.body)}</div>
        </article>
      `).join('')
    : `
      <section class="forum-card empty-state">
        <h2>${escapeHtml(t(locale, 'noAnswersYet'))}</h2>
        <p>${escapeHtml(t(locale, 'noAnswersBody'))}</p>
      </section>
    `;
  return `
    <section class="forum-main">
      <article class="forum-card detail-card">
        <div class="question-topline">
          <div class="question-meta">
            <a class="ghost back-link" href="/">← ${escapeHtml(t(locale, 'backToFeed'))}</a>
            <span class="intent-pill ${intentClass(intent)}">${escapeHtml(intentLabel(question.tags, locale))}</span>
            <span class="pill ${question.status === 'answered' ? 'ok' : 'warn'}">${escapeHtml(question.status === 'answered' ? t(locale, 'answered') : t(locale, 'open'))}</span>
            <span>${escapeHtml(countLabel(locale, 'answer', question.answerCount))}</span>
          </div>
          <div class="question-actions">${bumpForm}</div>
        </div>
        <h1>${escapeHtml(question.title)}</h1>
        <div class="question-meta detail-meta">
          <span>${escapeHtml(t(locale, 'by'))} <code>${escapeHtml(shortenAddress(question.authorAddress, locale))}</code></span>
          <span>•</span>
          <span>${escapeHtml(formatTimeAgo(locale, question.createdAt))}</span>
          ${question.lastAnsweredAt ? `<span>•</span><span>${escapeHtml(t(locale, 'lastAnswered', { value: formatTimeAgo(locale, question.lastAnsweredAt) }))}</span>` : ''}
        </div>
        <div class="tags-row detail-tags">${tags}</div>
        <div class="prose question-body">${nl2br(question.body)}</div>
        ${renderPostMedia(question.body)}
      </article>
      <section class="detail-answer-stack">
        <div class="section-head flush-top">
          <div>
            <span class="kicker">${escapeHtml(t(locale, 'answersHeading'))}</span>
            <h2>${escapeHtml(countLabel(locale, 'answer', answers.length))}</h2>
          </div>
        </div>
        ${answersHtml}
        <section class="forum-card answer-form-card" id="reply">
          <div class="section-head">
            <div>
              <span class="kicker">${escapeHtml(t(locale, 'reply'))}</span>
              <h2>${escapeHtml(t(locale, 'postAnswerHeading'))}</h2>
            </div>
          </div>
          ${state.answerError ? `<div class="flash error">${escapeHtml(state.answerError)}</div>` : ''}
          ${state.session ? `
            <form method="post" action="/q/${question.id}/answer" class="stack">
              <label>
                <span>${escapeHtml(t(locale, 'yourAnswer'))}</span>
                <textarea name="body" rows="7" maxlength="5000" placeholder="${escapeHtml(t(locale, 'answerPlaceholder'))}">${escapeHtml((state.answerDraft && state.answerDraft.body) || '')}</textarea>
              </label>
              <div class="form-actions">
                <button type="submit" class="primary">${escapeHtml(t(locale, 'postAnswer'))}</button>
                <span class="fine-print">${escapeHtml(t(locale, 'answerFinePrint'))}</span>
              </div>
            </form>
          ` : `
            <p class="lead">${escapeHtml(t(locale, 'needSessionAnswer'))}</p>
            <a class="primary button-link" href="${escapeHtml(state.apex)}/login">${escapeHtml(t(locale, 'logIn'))}</a>
          `}
        </section>
      </section>
    </section>
    ${renderSidebar(state)}
    ${renderComposeModal(state)}
  `;
}

function renderPage(req, state) {
  const apex = state.apex || apexBase();
  const locale = state.locale || pickLocale(req);
  const title = state.title || t(locale, 'forumTitle');
  const lead = state.lead || t(locale, 'forumLead');
  const body = state.content;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(lead)}">
<link rel="icon" type="image/png" href="${apex}/logo.png">
<link rel="stylesheet" href="${apex}/header.css">
<link rel="stylesheet" href="${apex}/app.css">
<script>window.__awApiBase = ${JSON.stringify(apex)};</script>
<script>
  (function(){
    try {
      var theme = localStorage.getItem('airweb-theme');
      if (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
      if (!theme) theme = 'light';
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
  })();
</script>
<script src="${apex}/header.js" defer></script>
<script src="${apex}/i18n.js" defer></script>
<script src="${apex}/currency.js" defer></script>
<style>
  main.forum {
    max-width: 1240px;
    margin: 0 auto;
    padding: 1.4rem 1.4rem 3.2rem;
  }
  .forum-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) 380px;
    gap: 1.2rem;
    align-items: start;
  }
  .forum-main,
  .forum-sidebar {
    display: grid;
    gap: 1.6rem;
    align-content: start;
  }
  .forum-sidebar {
    position: sticky;
    top: calc(48px + 1rem);
  }
  .forum-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 1.4rem 1.5rem;
  }
  .hero-card {
    padding: 1.35rem;
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--good) 12%, transparent), transparent 28%),
      radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 35%),
      linear-gradient(180deg, color-mix(in srgb, var(--panel2, var(--panel)) 84%, transparent), var(--panel));
  }
  .forum-shell-header { overflow: hidden; }
  .profile-card,
  .discovery-card,
  .guide-card {
    display: grid;
    gap: .85rem;
  }
  .profile-copy { margin-top: 0; }
  .profile-stat-grid {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: .5rem;
  }
  .profile-stat-grid > .stat-tile {
    flex: 0 0 84px;
    width: 84px;
    height: 84px;
    display: grid;
    grid-template-rows: auto 1fr;
    padding: .4rem .55rem;
    gap: 0;
    position: relative;
    text-align: left;
  }
  .profile-stat-grid > .stat-tile span {
    font-size: .68rem;
    color: var(--mute);
    text-transform: uppercase;
    letter-spacing: .04em;
    line-height: 1;
    justify-self: start;
    align-self: start;
  }
  .profile-stat-grid > .stat-tile strong {
    grid-row: 2;
    font-size: 1.55rem;
    line-height: 1;
    place-self: center;
    text-align: center;
  }
  /* Make the "comments received" tile clickable like a link. */
  .stat-tile-link {
    text-decoration: none;
    color: inherit;
    transition: border-color .15s ease, transform .15s ease, background .15s ease;
  }
  .stat-tile-link:hover {
    text-decoration: none;
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
    background: color-mix(in srgb, var(--accent) 6%, var(--hover));
  }
  .stat-tile-pill {
    position: absolute;
    top: .35rem; right: .35rem;
    min-width: 1.05rem; height: 1.05rem;
    padding: 0 .3rem;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font: 700 .62rem/1 var(--display);
    color: var(--accent-fg);
    background: linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)));
    box-shadow: 0 3px 8px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  /* "New post" action tile — right-aligned, accent-coloured, bright white label. */
  .stat-tile.stat-action {
    margin-left: auto;
    cursor: pointer;
    appearance: none;
    border: 1px solid transparent;
    color: #fff;
    background: linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)));
    box-shadow: 0 8px 18px color-mix(in srgb, var(--accent) 28%, transparent);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: .35rem;
    padding: .4rem .6rem;
    transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
    text-decoration: none;
    font: inherit;
  }
  .stat-tile.stat-action:hover {
    transform: translateY(-1px);
    filter: brightness(1.06);
    box-shadow: 0 12px 24px color-mix(in srgb, var(--accent) 36%, transparent);
  }
  .stat-tile.stat-action:active { transform: translateY(0); }
  .stat-tile.stat-action .stat-action-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font: 700 1.15rem/1 var(--display);
    line-height: 1;
  }
  .stat-tile.stat-action .stat-action-label {
    font: 700 .9rem/1 var(--display);
    letter-spacing: .02em;
    color: #fff;
    text-shadow: 0 1px 1px rgba(0, 0, 0, .15);
  }
  .profile-actions {
    display: flex;
    gap: .55rem;
    flex-wrap: wrap;
  }
  .notif-pill {
    min-width: 2rem;
    height: 2rem;
    padding: 0 .55rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: 700 .92rem/1 var(--display);
    color: var(--fg);
    background: var(--hover);
    border: 1px solid var(--line);
  }
  .notif-pill.hot {
    color: var(--accent-fg);
    background: linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)));
    border-color: transparent;
    box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 28%, transparent);
  }
  .section-head,
  .question-topline,
  .question-footer,
  .tag-prompt-row,
  .form-actions,
  .search-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .8rem;
  }
  .flush-top { margin-top: -.2rem; }
  .kicker {
    display: inline-block;
    margin-bottom: .35rem;
    color: var(--accent);
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    font-weight: 700;
  }
  h1, h2, h3 { margin: 0; color: var(--fg); font-family: var(--display); }
  h1 { font-size: 1.8rem; line-height: 1.15; }
  h2 { font-size: 1.15rem; line-height: 1.25; }
  .hero-title {
    font-size: 1.05rem;
    line-height: 1.35;
    font-weight: 600;
    color: var(--fg2);
  }
  p, li, label, input, textarea, button { font: inherit; }
  .lead { margin: .55rem 0 0; color: var(--fg2); line-height: 1.65; }
  .mute, .fine-print { color: var(--mute); }
  .fine-print { font-size: .84rem; }
  .hero-copy { display: grid; gap: .45rem; }
  .hero-lanes {
    display: flex;
    flex-wrap: wrap;
    gap: .45rem;
    margin-top: 1rem;
  }
  .lane-pill {
    display: inline-flex;
    align-items: center;
    padding: .22rem .5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--panel2, var(--panel)) 80%, transparent);
    border: 1px solid var(--line);
    color: var(--fg2);
    font-size: .72rem;
    line-height: 1.1;
  }
  .filters-row {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  .filters-row .tag-chip {
    padding: .2rem .5rem;
    font-size: .72rem;
    white-space: nowrap;
  }
  .search-bar { margin-top: 1rem; margin-bottom: .85rem; }
  .search-bar input {
    flex: 1;
    min-width: 0;
  }
  .forum-list {
    display: grid;
    gap: 1.2rem;
  }
  .forum-status-card {
    display: grid;
    gap: .75rem;
  }
  .comments-received-card {
    display: block;
    text-decoration: none;
    color: inherit;
    transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
  }
  .comments-received-card:hover {
    text-decoration: none;
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
    box-shadow: var(--shadow-card), 0 8px 18px color-mix(in srgb, black 8%, transparent);
  }
  .comments-received-card .section-head { margin: 0; }
  .notif-item {
    display: grid;
    gap: .35rem;
    text-decoration: none;
    color: inherit;
    transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
  }
  .notif-item:hover {
    text-decoration: none;
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
    box-shadow: var(--shadow-card), 0 8px 18px color-mix(in srgb, black 8%, transparent);
  }
  .notif-item-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: .6rem;
  }
  .notif-item-body { margin: 0; color: var(--fg2); line-height: 1.55; }
  input[type="text"],
  input[type="search"],
  textarea {
    width: 100%;
    background: var(--panel2, var(--panel));
    color: var(--fg);
    border: 1px solid var(--line2, var(--line));
    border-radius: var(--radius);
    padding: .72rem .82rem;
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
  }
  textarea { resize: vertical; min-height: 8rem; }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .stack { display: grid; gap: .85rem; }
  .gap-sm { gap: .55rem; }
  .intent-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: .55rem;
  }
  .intent-card {
    appearance: none;
    text-align: left;
    display: grid;
    gap: .18rem;
    padding: .8rem .85rem;
    border-radius: var(--radius);
    background: var(--hover);
    border: 1px solid var(--line);
    color: var(--fg);
    cursor: pointer;
  }
  .intent-card:hover {
    background: var(--hover2, var(--hover));
    transform: translateY(-1px);
  }
  .intent-card.active {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
    background: color-mix(in srgb, var(--accent) 11%, var(--hover));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .intent-card-title {
    font-weight: 700;
    color: var(--fg);
  }
  .intent-card-copy {
    color: var(--mute);
    font-size: .82rem;
    line-height: 1.4;
  }
  label > span {
    display: block;
    margin-bottom: .38rem;
    color: var(--fg);
    font-size: .88rem;
    font-weight: 600;
  }
  .tags-row,
  .tag-grid,
  .filters-row,
  .recommended-tags {
    display: flex;
    flex-wrap: wrap;
    gap: .45rem;
  }
  .tag-group {
    display: grid;
    gap: .5rem;
  }
  .tag-chip {
    display: inline-flex;
    align-items: center;
    padding: .3rem .62rem;
    border-radius: 999px;
    background: var(--hover);
    border: 1px solid var(--line);
    color: var(--fg2);
    text-decoration: none;
    font-size: .82rem;
  }
  .tag-chip:hover { text-decoration: none; background: var(--hover2, var(--hover)); }
  .tag-chip.active {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
    color: var(--accent);
  }
  .tag-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tag-option {
    display: flex;
    align-items: flex-start;
    gap: .65rem;
    padding: .72rem .8rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--hover);
    cursor: pointer;
    transition: border-color .15s ease, background .15s ease, transform .15s ease;
  }
  .tag-option.selected {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
    background: color-mix(in srgb, var(--accent) 11%, var(--hover));
  }
  .tag-option:hover { transform: translateY(-1px); }
  .tag-option input { width: auto; margin-top: .2rem; }
  .tag-option span { display: grid; gap: .18rem; min-width: 0; }
  .tag-option strong { color: var(--fg); font-size: .88rem; }
  .tag-option small { color: var(--mute); line-height: 1.35; }
  .question-meta,
  .question-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .45rem;
    color: var(--mute);
    font-size: .83rem;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: .2rem .48rem;
    border-radius: 999px;
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .06em;
    font-weight: 700;
    border: 1px solid var(--line);
    background: var(--hover);
    color: var(--fg2);
  }
  .pill.ok {
    color: var(--good);
    border-color: color-mix(in srgb, var(--good) 40%, var(--line));
    background: color-mix(in srgb, var(--good) 11%, transparent);
  }
  .pill.warn {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 40%, var(--line));
    background: color-mix(in srgb, var(--warn) 12%, transparent);
  }
  .intent-pill {
    display: inline-flex;
    align-items: center;
    padding: .26rem .54rem;
    border-radius: 999px;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .04em;
    border: 1px solid var(--line);
    color: var(--fg);
    background: var(--hover);
  }
  .intent-pill.accent {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
  }
  .intent-pill.good {
    color: var(--good);
    background: color-mix(in srgb, var(--good) 12%, transparent);
    border-color: color-mix(in srgb, var(--good) 35%, var(--line));
  }
  .intent-pill.danger {
    color: var(--bad, #ff453a);
    background: color-mix(in srgb, var(--bad, #ff453a) 12%, transparent);
    border-color: color-mix(in srgb, var(--bad, #ff453a) 35%, var(--line));
  }
  .intent-pill.warm {
    color: var(--warn);
    background: color-mix(in srgb, var(--warn) 14%, transparent);
    border-color: color-mix(in srgb, var(--warn) 34%, var(--line));
  }
  .question-card h2 a,
  .detail-card h1,
  .back-link { color: var(--fg); }
  .question-card h2 a:hover,
  .back-link:hover { color: var(--accent); }
  .question-excerpt,
  .prose {
    color: var(--fg2);
    line-height: 1.7;
  }
  .question-card h2 {
    margin-top: .45rem;
    font-size: 1.22rem;
  }
  .question-card {
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
  }
  .question-card:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 24%, var(--line));
    box-shadow: var(--shadow-card), 0 10px 24px color-mix(in srgb, black 10%, transparent);
  }
  .featured {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    box-shadow: var(--shadow-card), 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent) inset;
  }
  .question-card h2 {
    margin-top: .55rem;
    font-size: 1.32rem;
    line-height: 1.3;
  }
  .question-excerpt {
    margin: .8rem 0 .25rem;
    font-size: .98rem;
    line-height: 1.72;
    color: var(--fg);
    opacity: .92;
  }
  .question-footer {
    margin-top: 1rem;
    padding-top: .85rem;
    border-top: 1px dashed color-mix(in srgb, var(--line) 65%, transparent);
  }
  .meta-sep { opacity: .55; }
  /* +1 button — prominent, accent-tinted, count is the hero */
  .plus-one-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: .35rem;
    padding: .32rem .68rem .32rem .58rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
    color: var(--fg2);
    cursor: pointer;
    font: 600 .82rem/1 var(--display);
    text-decoration: none;
    transition: transform .12s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
  }
  .plus-one-btn:hover {
    transform: translateY(-1px);
    background: color-mix(in srgb, var(--accent) 18%, var(--panel));
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
    box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .plus-one-btn.static {
    cursor: default;
    opacity: .85;
  }
  .plus-one-btn.static:hover {
    transform: none;
    box-shadow: none;
  }
  .plus-one-label {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: .02em;
  }
  .plus-one-count {
    color: var(--fg);
    font: 700 1rem/1 var(--display);
    min-width: 1ch;
    text-align: center;
  }
  /* Comments toggle button */
  .comments-toggle {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: .42rem;
    padding: .42rem .8rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--hover);
    color: var(--fg);
    cursor: pointer;
    font: 600 .85rem/1 var(--display);
    transition: background .15s ease, border-color .15s ease, transform .12s ease;
  }
  .comments-toggle:hover {
    background: var(--hover2, var(--hover));
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    transform: translateY(-1px);
  }
  .comments-toggle svg { opacity: .75; }
  .comments-toggle .caret {
    color: var(--mute);
    font-size: .72rem;
    transition: transform .18s ease;
  }
  .comments-toggle[aria-expanded="true"] {
    background: color-mix(in srgb, var(--accent) 12%, var(--hover));
    border-color: color-mix(in srgb, var(--accent) 38%, var(--line));
    color: var(--accent);
  }
  .comments-toggle[aria-expanded="true"] .caret {
    transform: rotate(180deg);
    color: var(--accent);
  }
  /* Inline comments panel inside a feed card */
  .comments-panel {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    display: grid;
    gap: .8rem;
  }
  .comments-panel[hidden] { display: none; }
  .comments-loading,
  .comments-empty {
    color: var(--mute);
    font-size: .88rem;
    padding: .35rem .1rem;
  }
  .inline-comment {
    padding: .85rem 1rem;
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: grid;
    gap: .45rem;
  }
  .inline-comment-meta {
    display: flex;
    align-items: center;
    gap: .45rem;
    color: var(--mute);
    font-size: .8rem;
  }
  .inline-comment-meta code {
    font-size: .78em;
  }
  .inline-comment-body {
    color: var(--fg);
    line-height: 1.65;
    font-size: .94rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .inline-comment-more {
    text-align: center;
    color: var(--accent);
    font-size: .85rem;
    text-decoration: none;
    padding: .4rem;
  }
  .inline-comment-more:hover { text-decoration: underline; }
  .forum-toolbar,
  .toolbar-copy {
    display: grid;
    gap: .28rem;
  }
  .section-head.compact {
    align-items: baseline;
  }
  .forum-toolbar {
    margin-top: 1rem;
  }
  .detail-card,
  .answer-card,
  .answer-form-card { padding: 1.6rem 1.7rem; }
  .detail-answer-stack { display: grid; gap: 1.3rem; }
  .answer-card { display: grid; gap: .85rem; }
  .answer-card .prose {
    font-size: .98rem;
    line-height: 1.75;
  }
  .detail-meta { margin-top: .55rem; }
  .detail-tags { margin-top: .8rem; }
  .question-body { margin-top: 1rem; font-size: .98rem; }
  .empty-state p { margin-top: .45rem; }
  .flash {
    border-radius: var(--radius);
    border: 1px solid var(--line);
    padding: .72rem .82rem;
    font-size: .92rem;
  }
  .flash.error {
    color: var(--bad, #ff453a);
    border-color: color-mix(in srgb, var(--bad, #ff453a) 40%, var(--line));
    background: color-mix(in srgb, var(--bad, #ff453a) 12%, transparent);
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: .6rem;
    margin-top: .8rem;
  }
  .stat-tile {
    display: grid;
    gap: .16rem;
    padding: .75rem .8rem;
    border-radius: var(--radius);
    background: var(--hover);
    border: 1px solid var(--line);
  }
  .stat-tile strong {
    color: var(--fg);
    font: 700 1.2rem/1 var(--display);
  }
  .stat-tile span,
  .subhead { color: var(--mute); font-size: .82rem; }
  .hot-tags-block { margin-top: 1rem; display: grid; gap: .55rem; }
  .guide-list {
    margin: .5rem 0 0;
    padding-left: 1.05rem;
    color: var(--fg2);
    display: grid;
    gap: .45rem;
    line-height: 1.55;
  }
  .recommended-tags {
    min-height: 1.5rem;
    color: var(--mute);
    font-size: .83rem;
  }
  .save-btn.saved {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--hover));
  }
  .mini-list,
  .comment-blip-list {
    display: grid;
    gap: .55rem;
  }
  .mini-thread,
  .comment-blip {
    display: grid;
    gap: .22rem;
    padding: .78rem .82rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--hover);
    color: var(--fg);
    text-decoration: none;
  }
  .mini-thread:hover,
  .comment-blip:hover {
    text-decoration: none;
    background: var(--hover2, var(--hover));
    border-color: color-mix(in srgb, var(--accent) 24%, var(--line));
  }
  .mini-thread span,
  .comment-blip span,
  .mini-empty,
  .comment-blip p {
    color: var(--mute);
    font-size: .83rem;
    line-height: 1.45;
    margin: 0;
  }
  .comment-blip-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .7rem;
  }
  .comment-blip-head strong,
  .mini-thread strong {
    color: var(--fg);
    font-size: .92rem;
    line-height: 1.35;
  }
  .compose-modal {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: none;
  }
  .compose-modal.open { display: flex; align-items: center; justify-content: center; }
  .compose-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(6, 10, 18, .55);
    backdrop-filter: blur(6px);
  }
  .compose-panel {
    position: relative;
    width: min(720px, calc(100vw - 1.2rem));
    max-height: calc(100dvh - 1.5rem);
    display: flex;
    flex-direction: column;
    padding: .85rem 1rem 1rem;
    border-radius: calc(var(--radius-lg) + 4px);
    background: var(--panel);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
  }
  .compose-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: .55rem;
    flex: 0 0 auto;
  }
  .compose-head h2 { margin: 0; font-size: 1.05rem; }
  .ask-card {
    display: flex;
    flex-direction: column;
    gap: .55rem;
    min-height: 0;
    flex: 1 1 auto;
  }
  .compose-form {
    display: flex;
    flex-direction: column;
    gap: .55rem;
    min-height: 0;
    flex: 1 1 auto;
  }
  .compose-row {
    display: grid;
    grid-template-columns: minmax(180px, 220px) 1fr;
    gap: .55rem;
  }
  .compose-field {
    display: flex;
    flex-direction: column;
    gap: .25rem;
    min-width: 0;
  }
  .compose-label {
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--mute);
    font-weight: 600;
  }
  .compose-field input[type="text"],
  .compose-field select,
  .compose-field textarea {
    width: 100%;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--hover);
    color: var(--fg);
    padding: .5rem .65rem;
    font: inherit;
  }
  .compose-field select {
    appearance: none;
    -webkit-appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, var(--mute) 50%), linear-gradient(135deg, var(--mute) 50%, transparent 50%);
    background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
    padding-right: 1.6rem;
    font-size: .92rem;
  }
  .body-field { flex: 1 1 auto; min-height: 0; }
  .body-field textarea {
    flex: 1 1 auto;
    min-height: 5.5rem;
    max-height: 30vh;
    resize: vertical;
    line-height: 1.5;
  }
  .tag-input {
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
    padding: .35rem .4rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--hover);
    align-items: center;
    min-height: 2.1rem;
  }
  .tag-input:focus-within {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  }
  .chip-list {
    display: contents;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: .25rem;
    padding: .18rem .4rem .18rem .35rem;
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    color: var(--fg);
    border-radius: 999px;
    font-size: .82rem;
    line-height: 1.2;
  }
  .chip .chip-icon { font-size: .85rem; line-height: 1; }
  .chip-x {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--mute);
    font-size: 1rem;
    line-height: 1;
    padding: 0 .1rem;
    margin-left: .15rem;
    cursor: pointer;
  }
  .chip-x:hover { color: var(--bad, #ff453a); }
  .chip-entry {
    flex: 1 0 6rem;
    border: 0 !important;
    background: transparent !important;
    padding: .15rem .25rem !important;
    outline: none;
    min-width: 5rem;
    font-size: .9rem;
  }
  .tag-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
    margin-top: .25rem;
  }
  .tag-suggestions[hidden] { display: none; }
  .suggestion-chip {
    appearance: none;
    cursor: pointer;
    background: var(--hover);
    border: 1px dashed var(--line);
    color: var(--mute);
    border-radius: 999px;
    padding: .2rem .5rem;
    font-size: .78rem;
  }
  .suggestion-chip:hover {
    color: var(--fg);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
  }
  .media-preview {
    display: grid;
    gap: .5rem;
    padding: .55rem;
    border-radius: var(--radius);
    border: 1px dashed var(--line);
    background: color-mix(in srgb, var(--accent) 4%, var(--panel));
    max-height: 22vh;
    overflow: auto;
  }
  .media-preview[hidden] { display: none; }
  .media-card {
    display: flex;
    gap: .6rem;
    align-items: center;
    padding: .4rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    min-height: 0;
  }
  .media-card .media-thumb {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    object-fit: cover;
    background: var(--hover);
    flex: 0 0 auto;
  }
  .media-card .media-body {
    min-width: 0;
    display: grid;
    gap: .15rem;
  }
  .media-card .media-title {
    font-weight: 600;
    color: var(--fg);
    font-size: .9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .media-card .media-desc {
    color: var(--mute);
    font-size: .78rem;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .media-card .media-host {
    color: var(--mute);
    font-size: .72rem;
    text-transform: lowercase;
  }
  .media-card img.media-inline {
    max-width: 100%;
    max-height: 18vh;
    border-radius: 6px;
  }
  .media-card .media-video {
    width: 100%;
    aspect-ratio: 16/9;
    border: 0;
    border-radius: 6px;
    background: #000;
  }
  .compose-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .6rem;
    flex: 0 0 auto;
  }
  .actions-buttons {
    display: inline-flex;
    gap: .5rem;
  }
  /* Embedded media inside question cards / detail */
  .post-media {
    display: grid;
    gap: .55rem;
    margin: .75rem 0 .35rem;
  }
  .post-media img.media-embed {
    max-width: 100%;
    max-height: 360px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    object-fit: contain;
    background: var(--hover);
  }
  .post-media .video-embed {
    width: 100%;
    aspect-ratio: 16/9;
    border: 0;
    border-radius: var(--radius);
    background: #000;
  }
  .post-media .link-card {
    display: flex;
    gap: .65rem;
    padding: .55rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--hover);
    color: var(--fg);
    text-decoration: none;
    align-items: center;
  }
  .post-media .link-card:hover {
    text-decoration: none;
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    background: var(--hover2, var(--hover));
  }
  .post-media .link-card .lc-thumb {
    width: 72px;
    height: 72px;
    border-radius: 6px;
    object-fit: cover;
    flex: 0 0 auto;
    background: var(--panel);
  }
  .post-media .link-card .lc-body { min-width: 0; display: grid; gap: .15rem; }
  .post-media .link-card .lc-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .post-media .link-card .lc-desc {
    color: var(--mute);
    font-size: .82rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .post-media .link-card .lc-host {
    color: var(--mute);
    font-size: .72rem;
    text-transform: lowercase;
  }
  .inline-form { display: inline-flex; margin: 0; }
  .small {
    font-size: .8rem;
    padding: .42rem .62rem;
  }
  .primary,
  .ghost,
  .button-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .4rem;
    border-radius: var(--radius);
    padding: .62rem .9rem;
    border: 1px solid transparent;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    max-width: none;
  }
  .primary,
  .button-link {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .primary:hover,
  .button-link:hover {
    text-decoration: none;
    background: var(--accent2, var(--accent));
  }
  .ghost {
    background: var(--hover);
    border-color: var(--line);
    color: var(--fg);
  }
  .ghost:hover { text-decoration: none; background: var(--hover2, var(--hover)); }
  .primary[disabled],
  .ghost[disabled],
  input[disabled],
  textarea[disabled] {
    opacity: .6;
    cursor: not-allowed;
  }
  code {
    background: var(--code);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: var(--mono);
    font-size: .82em;
  }
  @media (max-width: 980px) {
    .forum-layout {
      grid-template-columns: 1fr;
      gap: 1.6rem;
    }
    .forum-sidebar {
      position: static;
      display: contents;
    }
    .forum-sidebar > .comments-received-card {
      order: -1;
    }
    .forum-main {
      order: 0;
    }
  }
  @media (max-width: 720px) {
    main.forum { padding: 1rem .9rem 2rem; }
    .forum-card { padding: 1rem; }
    .filters-row {
      flex-wrap: wrap;
      overflow-x: visible;
    }
    .intent-grid,
    .tag-grid { grid-template-columns: 1fr; }
    .compose-row { grid-template-columns: 1fr; }
    .compose-panel {
      width: 100%;
      max-height: 100dvh;
      max-height: calc(100dvh - env(safe-area-inset-top, 0px));
      border-radius: 0;
      padding: .7rem .8rem 1rem;
    }
    .compose-modal.open { align-items: stretch; }
    .body-field textarea { max-height: 36vh; min-height: 4.5rem; }
    .media-preview { max-height: 16vh; }
    .compose-actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .actions-buttons { justify-content: space-between; }
    .search-bar,
    .section-head,
    .question-topline,
    .question-footer,
    .tag-prompt-row,
    .form-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .profile-actions,
    .comment-blip-head,
    .compose-head {
      flex-direction: row;
      align-items: center;
    }
    .stat-grid { grid-template-columns: 1fr 1fr 1fr; }
  }
  @media (max-width: 720px) {
    .profile-stat-grid > .stat-tile { flex: 0 0 72px; width: 72px; height: 72px; }
  }
</style>
</head>
<body data-forum-auth="${state.session && state.session.account ? 'in' : 'out'}">
<div id="aw-header"></div>
<main class="forum">
  <div class="forum-layout">${body}</div>
</main>
<script>
  (function () {
    try {
    var MAX_TAGS = ${forum.MAX_TAGS};
    var keywordHints = {
      setup: ['install', 'setup', 'configure', 'config', 'first run', 'getting started'],
      'bug-report': ['bug', 'broken', 'crash', 'issue', 'regression', 'not working'],
      'feature-request': ['feature request', 'proposal', 'idea', 'should support', 'would like'],
      ssh: ['ssh', 'key', 'ed25519', 'public key', 'private key', 'reverse tunnel', 'permission denied'],
      http: ['http', 'https', 'webhook', 'websocket', 'browser', 'react', 'frontend', 'nextjs'],
      tcp: ['tcp', 'port', 'socket', 'minecraft', 'rdp', 'vnc', 'raw tunnel'],
      handles: ['handle', 'subdomain', 'hostname', 'vanity'],
      billing: ['credit', 'credits', 'billing', 'balance', 'charge', 'charged', 'top up'],
      marketplace: ['marketplace', 'listing', 'lease', 'rent', 'seller', 'buyer'],
      jobs: ['job', 'freelance', 'available', 'for hire', 'looking for work'],
      hiring: ['hiring', 'need help', 'looking for', 'contractor', 'recruit'],
      project: ['project', 'collaborate', 'cofounder', 'partnership'],
      event: ['event', 'meetup', 'conference', 'workshop', 'webinar', 'hackathon'],
      launch: ['launch', 'released', 'announcing', 'shipping', 'new program', 'new service'],
      services: ['service', 'consulting', 'support', 'managed', 'agency'],
      'buy-sell': ['buy', 'sell', 'for sale', 'selling', 'hardware', 'digital goods'],
      showcase: ['showcase', 'built', 'shipped', 'demo', 'case study'],
      security: ['security', 'auth', 'tls', 'ssl', 'password', 'firewall', 'secure'],
      docker: ['docker', 'container', 'compose', 'image'],
      linux: ['linux', 'ubuntu', 'debian', 'systemd'],
      windows: ['windows', 'powershell', 'wsl'],
      macos: ['macos', 'osx', 'sonoma', 'sequoia'],
      database: ['postgres', 'postgresql', 'mysql', 'redis', 'mongodb', 'database', 'sql'],
      troubleshooting: ['error', 'failing', 'failed', 'broken', 'debug', 'timeout', 'stuck']
    };
    var POPULAR_DEFAULTS = ['troubleshooting', 'ssh', 'http'];

    var form = document.getElementById('askForm');
    if (!form) return;
    var titleInput = form.querySelector('input[name="title"]');
    var bodyInput = form.querySelector('textarea[name="body"]');
    var typeSelect = form.querySelector('#postType');
    var chipList = form.querySelector('#chipList');
    var chipEntry = form.querySelector('#chipEntry');
    var suggestionsBox = form.querySelector('#tagSuggestions');
    var mediaPreview = form.querySelector('#mediaPreview');
    var allTags = [];
    try { allTags = JSON.parse(form.getAttribute('data-all-tags') || '[]'); } catch (e) { allTags = []; }
    var tagBySlug = {};
    allTags.forEach(function (t) { tagBySlug[t.slug] = t; });
    var INTENT_SLUGS = {};
    Array.prototype.slice.call(typeSelect ? typeSelect.options : []).forEach(function (opt) { INTENT_SLUGS[opt.value] = true; });
    var userTouchedTags = chipList && chipList.children.length > 0;

    function slugify(text) {
      return String(text || '').toLowerCase().trim()
        .replace(/[^a-z0-9\\s-]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 32);
    }

    function currentChips() {
      if (!chipList) return [];
      return Array.prototype.slice.call(chipList.querySelectorAll('.chip'))
        .map(function (c) { return c.getAttribute('data-tag'); });
    }

    function addChip(slug) {
      slug = slugify(slug);
      if (!slug || !chipList) return false;
      var chips = currentChips();
      if (chips.indexOf(slug) >= 0) return false;
      if (typeSelect && slug === typeSelect.value) return false;
      if (chips.length >= MAX_TAGS) return false;
      var tag = tagBySlug[slug];
      var label = tag ? tag.label : slug;
      var icon = tag ? tag.icon : '🏷️';
      var span = document.createElement('span');
      span.className = 'chip';
      span.setAttribute('data-tag', slug);
      span.innerHTML = '<span class="chip-icon">' + icon + '</span>#' + escapeHtmlLocal(label)
        + '<button type="button" class="chip-x" data-chip-remove aria-label="remove">×</button>'
        + '<input type="hidden" name="tags[]" value="' + escapeAttrLocal(slug) + '">';
      chipList.appendChild(span);
      renderSuggestions();
      return true;
    }

    function removeChip(slug) {
      if (!chipList) return;
      var chip = chipList.querySelector('.chip[data-tag="' + cssEscape(slug) + '"]');
      if (chip) chip.parentNode.removeChild(chip);
      userTouchedTags = true;
      renderSuggestions();
    }

    function escapeHtmlLocal(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttrLocal(str) { return escapeHtmlLocal(str); }
    function cssEscape(str) { return String(str).replace(/(["\\\\])/g, '\\\\$1'); }

    function recommendTags() {
      var hay = ((titleInput && titleInput.value) || '') + ' ' + ((bodyInput && bodyInput.value) || '');
      hay = hay.toLowerCase();
      var scored = [];
      Object.keys(keywordHints).forEach(function (slug) {
        if (INTENT_SLUGS[slug]) return;
        var score = 0;
        keywordHints[slug].forEach(function (hint) {
          if (hay.indexOf(hint) >= 0) score += hint.indexOf(' ') >= 0 ? 2 : 1;
        });
        if (score > 0) scored.push({ slug: slug, score: score });
      });
      scored.sort(function (a, b) { return b.score - a.score || a.slug.localeCompare(b.slug); });
      var picks = scored.map(function (x) { return x.slug; });
      if (!picks.length) picks = POPULAR_DEFAULTS.slice();
      return picks;
    }

    function renderSuggestions() {
      if (!suggestionsBox) return;
      var current = currentChips();
      var picks = recommendTags().filter(function (s) {
        return current.indexOf(s) < 0 && (!typeSelect || s !== typeSelect.value);
      }).slice(0, 6);
      if (!picks.length || current.length >= MAX_TAGS) {
        suggestionsBox.hidden = true;
        suggestionsBox.innerHTML = '';
        return;
      }
      suggestionsBox.hidden = false;
      suggestionsBox.innerHTML = picks.map(function (slug) {
        var tag = tagBySlug[slug] || { label: slug, icon: '🏷️' };
        return '<button type="button" class="suggestion-chip" data-suggest="' + escapeAttrLocal(slug) + '">'
          + tag.icon + ' +#' + escapeHtmlLocal(tag.label) + '</button>';
      }).join('');
    }

    function autoSeedChips() {
      // Pre-populate with up to 2 recommended chips on initial load.
      if (userTouchedTags) return;
      var picks = recommendTags();
      var n = 0;
      picks.forEach(function (slug) {
        if (n >= 2) return;
        if (addChip(slug)) n++;
      });
    }

    if (chipEntry) {
      chipEntry.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
          var val = chipEntry.value.trim();
          if (val) {
            e.preventDefault();
            if (addChip(val)) {
              chipEntry.value = '';
              userTouchedTags = true;
            }
          } else if (e.key === 'Enter') {
            // empty + enter: submit form
            return;
          }
        } else if (e.key === 'Backspace' && !chipEntry.value) {
          var chips = currentChips();
          if (chips.length) {
            removeChip(chips[chips.length - 1]);
          }
        }
      });
      chipEntry.addEventListener('blur', function () {
        var val = chipEntry.value.trim();
        if (val && addChip(val)) {
          chipEntry.value = '';
          userTouchedTags = true;
        }
      });
    }
    form.addEventListener('click', function (e) {
      var rm = e.target.closest && e.target.closest('[data-chip-remove]');
      if (rm) {
        e.preventDefault();
        var chip = rm.closest('.chip');
        if (chip) {
          var slug = chip.getAttribute('data-tag');
          removeChip(slug);
        }
        return;
      }
      var sug = e.target.closest && e.target.closest('[data-suggest]');
      if (sug) {
        e.preventDefault();
        if (addChip(sug.getAttribute('data-suggest'))) {
          userTouchedTags = true;
        }
      }
    });
    if (titleInput) titleInput.addEventListener('input', renderSuggestions);
    if (bodyInput) {
      bodyInput.addEventListener('input', function () {
        renderSuggestions();
        scheduleMediaPreview();
      });
    }
    if (typeSelect) typeSelect.addEventListener('change', renderSuggestions);

    autoSeedChips();
    renderSuggestions();

    // ----- Media preview -----
    var mediaState = { lastUrls: '', cache: {} };
    var mediaTimer = null;
    function scheduleMediaPreview() {
      if (mediaTimer) clearTimeout(mediaTimer);
      mediaTimer = setTimeout(updateMediaPreview, 350);
    }
    function extractUrls(text) {
      var re = /https?:\\/\\/[^\\s<>"')]+/gi;
      var out = [];
      var m;
      while ((m = re.exec(text || ''))) {
        var u = m[0].replace(/[.,;!?)\\]]+$/, '');
        if (out.indexOf(u) < 0) out.push(u);
        if (out.length >= 4) break;
      }
      return out;
    }
    function classifyUrl(url) {
      if (/\\.(png|jpe?g|gif|webp|svg)(\\?|#|$)/i.test(url)) return 'image';
      if (/\\.(mp4|webm|ogg)(\\?|#|$)/i.test(url)) return 'video';
      if (/(?:youtube\\.com\\/watch|youtu\\.be\\/|youtube\\.com\\/shorts\\/)/i.test(url)) return 'youtube';
      if (/vimeo\\.com\\/(\\d+)/i.test(url)) return 'vimeo';
      return 'link';
    }
    function ytId(url) {
      var m = url.match(/youtu\\.be\\/([\\w-]+)/);
      if (m) return m[1];
      m = url.match(/[?&]v=([\\w-]+)/);
      if (m) return m[1];
      m = url.match(/youtube\\.com\\/shorts\\/([\\w-]+)/);
      if (m) return m[1];
      return null;
    }
    function renderMediaCard(url) {
      var kind = classifyUrl(url);
      var card = document.createElement('div');
      card.className = 'media-card';
      if (kind === 'image') {
        card.innerHTML = '<img class="media-inline" alt="" src="' + escapeAttrLocal(url) + '">';
      } else if (kind === 'video') {
        card.innerHTML = '<video class="media-video" controls preload="metadata" src="' + escapeAttrLocal(url) + '"></video>';
      } else if (kind === 'youtube') {
        var vid = ytId(url);
        if (vid) {
          card.innerHTML = '<iframe class="media-video" src="https://www.youtube.com/embed/' + encodeURIComponent(vid) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
        } else {
          card.innerHTML = '<div class="media-body"><div class="media-title">YouTube link</div><div class="media-host">' + escapeHtmlLocal(url) + '</div></div>';
        }
      } else if (kind === 'vimeo') {
        var vm = url.match(/vimeo\\.com\\/(\\d+)/);
        if (vm) {
          card.innerHTML = '<iframe class="media-video" src="https://player.vimeo.com/video/' + encodeURIComponent(vm[1]) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
        }
      } else {
        // generic link — placeholder then fetch
        var host = '';
        try { host = new URL(url).host; } catch (e) { host = url; }
        card.innerHTML = '<div class="media-body"><div class="media-title">' + escapeHtmlLocal(url) + '</div><div class="media-host">' + escapeHtmlLocal(host) + '</div><div class="media-desc">Loading preview…</div></div>';
        var body = card.querySelector('.media-body');
        loadLinkPreview(url, function (meta) {
          if (!meta) {
            var d = body.querySelector('.media-desc');
            if (d) d.textContent = '';
            return;
          }
          body.innerHTML = (meta.image ? '<img class="media-thumb" alt="" src="' + escapeAttrLocal(meta.image) + '">' : '')
            + '<div>'
            + '<div class="media-title">' + escapeHtmlLocal(meta.title || url) + '</div>'
            + (meta.description ? '<div class="media-desc">' + escapeHtmlLocal(meta.description) + '</div>' : '')
            + '<div class="media-host">' + escapeHtmlLocal(meta.host || host) + '</div>'
            + '</div>';
          if (meta.image) {
            // re-layout: pull thumb out as sibling
            card.classList.add('with-thumb');
          }
        });
      }
      return card;
    }
    function loadLinkPreview(url, cb) {
      if (mediaState.cache[url]) return cb(mediaState.cache[url]);
      fetch('/api/link-preview?u=' + encodeURIComponent(url), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data) mediaState.cache[url] = data;
          cb(data);
        })
        .catch(function () { cb(null); });
    }
    function updateMediaPreview() {
      if (!mediaPreview || !bodyInput) return;
      var urls = extractUrls(bodyInput.value);
      var key = urls.join('|');
      if (key === mediaState.lastUrls) return;
      mediaState.lastUrls = key;
      mediaPreview.innerHTML = '';
      if (!urls.length) {
        mediaPreview.hidden = true;
        return;
      }
      mediaPreview.hidden = false;
      urls.forEach(function (url) {
        mediaPreview.appendChild(renderMediaCard(url));
      });
    }

    } catch (e) {
      console.error('[forum] compose enhancer failed:', e);
    }
  })();

  (function () {
    var modal = document.getElementById('composeModal');
    if (!modal) return;
    function openCompose() {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeCompose() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    document.addEventListener('click', function (e) {
      var openBtn = e.target && e.target.closest ? e.target.closest('[data-open-compose]') : null;
      if (openBtn) {
        e.preventDefault();
        openCompose();
        return;
      }
      var closeBtn = e.target && e.target.closest ? e.target.closest('[data-close-compose]') : null;
      if (closeBtn) {
        e.preventDefault();
        closeCompose();
      }
    });
    if (modal.classList.contains('open')) openCompose();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCompose();
    });
  })();

  (function () {
    // Inline comments toggle on the feed cards. Lazy-loads via JSON.
    function escapeHtml(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function render(answers, questionId) {
      if (!answers.length) {
        return '<div class="comments-empty">No comments yet. Be the first to reply.</div>';
      }
      var max = 6;
      var shown = answers.slice(-max).reverse();
      var html = shown.map(function (a) {
        return ''
          + '<div class="inline-comment">'
          +   '<div class="inline-comment-meta">'
          +     'by <code>' + escapeHtml(a.authorShort) + '</code>'
          +     '<span class="meta-sep">\u2022</span>'
          +     '<span>' + escapeHtml(a.ago) + '</span>'
          +   '</div>'
          +   '<div class="inline-comment-body">' + escapeHtml(a.body) + '</div>'
          + '</div>';
      }).join('');
      if (answers.length > max) {
        html += '<a class="inline-comment-more" href="/q/' + questionId + '">View all ' + answers.length + ' comments \u2192</a>';
      } else if (answers.length >= 1) {
        html += '<a class="inline-comment-more" href="/q/' + questionId + '#reply">Open thread to reply \u2192</a>';
      }
      return html;
    }
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-comments-toggle]') : null;
      if (!btn) return;
      e.preventDefault();
      var card = btn.closest('.question-card');
      if (!card) return;
      var panel = card.querySelector('[data-comments-panel]');
      if (!panel) return;
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        return;
      }
      btn.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      if (panel.getAttribute('data-loaded') === '1') return;
      panel.innerHTML = '<div class="comments-loading">Loading\u2026</div>';
      var id = btn.getAttribute('data-question-id');
      fetch('/q/' + encodeURIComponent(id) + '/comments.json', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) { panel.innerHTML = '<div class="comments-empty">Could not load comments.</div>'; return; }
          panel.innerHTML = render(data.answers || [], id);
          panel.setAttribute('data-loaded', '1');
        })
        .catch(function () {
          panel.innerHTML = '<div class="comments-empty">Could not load comments.</div>';
        });
    });
  })();

  (function () {
    // Hydrate generic link previews (Facebook-style cards) for [data-link-preview] anchors.
    function esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    var seen = new WeakSet();
    function hydrate() {
      var nodes = document.querySelectorAll('a[data-link-preview]');
      Array.prototype.forEach.call(nodes, function (a) {
        if (seen.has(a)) return;
        seen.add(a);
        var url = a.getAttribute('data-link-preview');
        if (!url) return;
        fetch('/api/link-preview?u=' + encodeURIComponent(url), { credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (meta) {
            if (!meta) return;
            var thumb = meta.image ? '<img class="lc-thumb" loading="lazy" alt="" src="' + esc(meta.image) + '">' : '';
            var desc = meta.description ? '<div class="lc-desc">' + esc(meta.description) + '</div>' : '';
            a.innerHTML = thumb
              + '<div class="lc-body">'
              + '<div class="lc-title">' + esc(meta.title || meta.url || url) + '</div>'
              + desc
              + '<div class="lc-host">' + esc(meta.siteName || meta.host || url) + '</div>'
              + '</div>';
          })
          .catch(function () {});
      });
    }
    hydrate();
    // re-run when comments panels open or modal opens
    var mo = new MutationObserver(function () { hydrate(); });
    mo.observe(document.body, { childList: true, subtree: true });
  })();

  (function () {
    var key = 'airweb-forum-auth-sync';
    if (document.body.getAttribute('data-forum-auth') !== 'out') {
      try { sessionStorage.removeItem(key); } catch (e) {}
      return;
    }
    try {
      if (sessionStorage.getItem(key) === 'done') return;
    } catch (e) {}
    fetch(window.__awApiBase + '/api/me', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (!me || !me.address) return;
        try { sessionStorage.setItem(key, 'done'); } catch (e) {}
        window.location.reload();
      })
      .catch(function () {});
  })();
</script>
</body>
</html>`;
}

function buildFeedState(req, session, ctx, extra) {
  const url = new URL(req.url, 'http://forum.local');
  const locale = pickLocale(req);
  const viewerAddress = session && session.account ? session.account.address : null;
  return Object.assign({
    apex: apexBase(),
    ctx,
    session,
    locale,
    activeTag: String(url.searchParams.get('tag') || '').trim().toLowerCase() || null,
    search: String(url.searchParams.get('q') || '').trim(),
    questions: forum.listQuestions({
      viewerAddress,
      tag: String(url.searchParams.get('tag') || '').trim().toLowerCase(),
      q: String(url.searchParams.get('q') || '').trim(),
      limit: 40,
    }),
    stats: forum.stats(),
    profile: viewerAddress ? forum.profileSummary(viewerAddress) : null,
    popularLaunches: forum.popularPostsByTopic('launch', 4, viewerAddress),
    popularJobs: forum.popularPostsByTopic('jobs', 4, viewerAddress),
    popularTroubleshooting: forum.popularPostsByTopic('troubleshooting', 4, viewerAddress),
    trendingComments: forum.trendingComments(5),
    askDraft: { title: '', body: '', tags: [] },
    askError: null,
    feedError: null,
  }, extra || {});
}

function renderFeedPage(req, res, ctx, session, extra) {
  const state = buildFeedState(req, session, ctx, extra);
  const page = renderPage(req, {
    apex: state.apex,
    ctx,
    session,
    locale: state.locale,
    title: t(state.locale, 'forumTitle'),
    lead: t(state.locale, 'feedLead'),
    content: renderFeed(req, state),
  });
  html(res, extra && extra.status ? extra.status : 200, page);
}

function renderDetailPage(req, res, ctx, session, thread, extra) {
  const locale = pickLocale(req);
  const viewerAddress = session && session.account ? session.account.address : null;
  const state = Object.assign({
    apex: apexBase(),
    ctx,
    session,
    locale,
    thread,
    stats: forum.stats(),
    profile: viewerAddress ? forum.profileSummary(viewerAddress) : null,
    popularLaunches: forum.popularPostsByTopic('launch', 4, viewerAddress),
    popularJobs: forum.popularPostsByTopic('jobs', 4, viewerAddress),
    popularTroubleshooting: forum.popularPostsByTopic('troubleshooting', 4, viewerAddress),
    trendingComments: forum.trendingComments(5),
    askDraft: { title: '', body: '', tags: [] },
    askError: null,
    answerDraft: { body: '' },
    answerError: null,
    activeTag: null,
  }, extra || {});
  const page = renderPage(req, {
    apex: state.apex,
    ctx,
    session,
    locale: state.locale,
    title: thread.question.title,
    lead: thread.question.body.slice(0, 160),
    content: renderDetail(req, state),
  });
  html(res, extra && extra.status ? extra.status : 200, page);
}

async function handleAsk(req, res, ctx, session) {
  const locale = pickLocale(req);
  if (!session) {
    return renderFeedPage(req, res, ctx, session, {
      status: 401,
      askError: t(locale, 'errorLoginAsk'),
      askDraft: { title: '', body: '', tags: [] },
    });
  }
  const form = await readForm(req);
  const tagList = Array.isArray(form.tags) ? form.tags : (form.tags ? [form.tags] : []);
  const postType = String(form.postType || '').trim().toLowerCase();
  const combinedTags = [];
  if (postType) combinedTags.push(postType);
  for (const tag of tagList) {
    const slug = String(tag || '').trim().toLowerCase();
    if (slug && combinedTags.indexOf(slug) < 0) combinedTags.push(slug);
  }
  const draft = {
    title: form.title || '',
    body: form.body || '',
    tags: combinedTags,
  };
  try {
    const question = forum.createQuestion(session.account.address, draft);
    return redirect(res, `/q/${question.id}`);
  } catch (err) {
    return renderFeedPage(req, res, ctx, session, {
      status: 400,
      askError: friendlyError(err, { locale }),
      askDraft: draft,
    });
  }
}

async function handleAnswer(req, res, ctx, session, questionId) {
  const locale = pickLocale(req);
  const thread = forum.getQuestionThread(questionId);
  if (!thread) return notFound(req, res, ctx, session);
  if (!session) {
    return renderDetailPage(req, res, ctx, session, thread, {
      status: 401,
      answerError: t(locale, 'errorLoginAnswer'),
    });
  }
  const form = await readForm(req);
  const draft = { body: form.body || '' };
  try {
    forum.answerQuestion(session.account.address, questionId, draft);
    return redirect(res, `/q/${questionId}#reply`);
  } catch (err) {
    return renderDetailPage(req, res, ctx, session, thread, {
      status: 400,
      answerError: friendlyError(err, { locale }),
      answerDraft: draft,
    });
  }
}

async function handleBump(req, res, ctx, session, questionId) {
  const locale = pickLocale(req);
  const form = await readForm(req);
  const returnTo = safeReturnTo(form.returnTo, `/q/${questionId}`);
  if (!session) return redirect(res, returnTo);
  try {
    forum.bumpQuestion(session.account.address, questionId);
    return redirect(res, returnTo);
  } catch (err) {
    const thread = forum.getQuestionThread(questionId);
    if (!thread) return notFound(req, res, ctx, session);
    if ((returnTo || '').startsWith('/q/')) {
      return renderDetailPage(req, res, ctx, session, thread, {
        status: 400,
        answerError: friendlyError(err, { locale }),
      });
    }
    return renderFeedPage(req, res, ctx, session, {
      status: 400,
      feedError: friendlyError(err, { locale }),
    });
  }
}

async function handleSave(req, res, ctx, session, questionId) {
  const form = await readForm(req);
  const returnTo = safeReturnTo(form.returnTo, `/q/${questionId}`);
  if (!session) return redirect(res, returnTo);
  try {
    forum.toggleSavedPost(session.account.address, questionId);
    return redirect(res, returnTo);
  } catch (err) {
    return redirect(res, returnTo);
  }
}

async function handleNotificationsRead(req, res, ctx, session) {
  const form = await readForm(req);
  const returnTo = safeReturnTo(form.returnTo, '/');
  if (session && session.account) forum.markNotificationsSeen(session.account.address);
  return redirect(res, returnTo);
}

function renderNotifications(state) {
  const locale = state.locale || 'en';
  const items = state.receivedComments || [];
  const body = items.length
    ? items.map((c) => {
        const excerpt = c.body && c.body.length > 240 ? `${c.body.slice(0, 240).trim()}…` : (c.body || '');
        return `
          <a class="forum-card notif-item" href="/q/${c.threadId}#reply">
            <div class="notif-item-head">
              <strong>${escapeHtml(c.threadTitle || t(locale, 'threadFallback'))}</strong>
              <span class="mute fine-print">${escapeHtml(formatTimeAgo(locale, c.createdAt))}</span>
            </div>
            <p class="notif-item-body">${escapeHtml(excerpt)}</p>
            <div class="fine-print mute">${escapeHtml(t(locale, 'by'))} <code>${escapeHtml(shortenAddress(c.authorAddress, locale))}</code></div>
          </a>
        `;
      }).join('')
    : `
      <section class="forum-card empty-state">
        <h2>${escapeHtml(t(locale, 'notificationsEmpty'))}</h2>
      </section>
    `;
  return `
    <section class="forum-main notifications-main">
      <section class="forum-card hero-card forum-shell-header">
        <a class="back-link" href="/">${escapeHtml(t(locale, 'backToFeedShort'))}</a>
        <div class="hero-copy">
          <h1 class="hero-title">${escapeHtml(t(locale, 'notificationsTitle'))}</h1>
          <p class="mute fine-print">${escapeHtml(t(locale, 'notificationsLead'))}</p>
        </div>
      </section>
      <div class="forum-list">${body}</div>
    </section>
    ${renderSidebar(state)}
  `;
}

function renderNotificationsPage(req, res, ctx, session) {
  const locale = pickLocale(req);
  const viewerAddress = session && session.account ? session.account.address : null;
  const receivedComments = viewerAddress ? forum.listReceivedComments(viewerAddress, 50) : [];
  if (viewerAddress) forum.markNotificationsSeen(viewerAddress);
  const state = {
    apex: apexBase(),
    ctx,
    session,
    locale,
    activeTag: null,
    search: '',
    questions: [],
    stats: forum.stats(),
    profile: viewerAddress ? forum.profileSummary(viewerAddress) : null,
    popularLaunches: forum.popularPostsByTopic('launch', 4, viewerAddress),
    popularJobs: forum.popularPostsByTopic('jobs', 4, viewerAddress),
    popularTroubleshooting: forum.popularPostsByTopic('troubleshooting', 4, viewerAddress),
    trendingComments: forum.trendingComments(5),
    receivedComments,
  };
  const page = renderPage(req, {
    apex: state.apex,
    ctx,
    session,
    locale: state.locale,
    title: t(state.locale, 'notificationsTitle'),
    lead: t(state.locale, 'notificationsLead'),
    content: renderNotifications(state),
  });
  html(res, 200, page);
}

// ---- Link preview (Open Graph) ----
const LINK_PREVIEW_CACHE = new Map();
const LINK_PREVIEW_TTL_MS = 30 * 60 * 1000;
const LINK_PREVIEW_MAX_BYTES = 256 * 1024;

function isPublicHttpUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (!host) return null;
    if (host === 'localhost') return null;
    if (/^127\./.test(host)) return null;
    if (/^10\./.test(host)) return null;
    if (/^192\.168\./.test(host)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    if (/^0\./.test(host)) return null;
    if (host.endsWith('.lvh.me') || host.endsWith('.local')) return null;
    return u;
  } catch (_) {
    return null;
  }
}

function extractMetaTag(html, prop) {
  // matches <meta property="og:title" content="..."> or name=
  const reProp = new RegExp(
    '<meta[^>]+(?:property|name)\\s*=\\s*["\'\\s]*' + prop + '["\'\\s][^>]*content\\s*=\\s*"([^"]*)"',
    'i'
  );
  const reAlt = new RegExp(
    '<meta[^>]+content\\s*=\\s*"([^"]*)"[^>]+(?:property|name)\\s*=\\s*["\'\\s]*' + prop + '["\'\\s]',
    'i'
  );
  const m = html.match(reProp) || html.match(reAlt);
  return m ? decodeHtmlEntities(m[1].trim()) : '';
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x?([0-9a-f]+);/gi, (m, n) => {
      const code = m.toLowerCase().includes('x') ? parseInt(n, 16) : parseInt(n, 10);
      return isNaN(code) ? m : String.fromCharCode(code);
    });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeHtmlEntities(m[1].trim()) : '';
}

function absoluteUrl(maybe, base) {
  if (!maybe) return '';
  try { return new URL(maybe, base).toString(); } catch (_) { return ''; }
}

function fetchLinkPreview(url) {
  return new Promise((resolve) => {
    const u = isPublicHttpUrl(url);
    if (!u) return resolve(null);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request({
      method: 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'airweb-link-preview/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 4000,
    }, (resp) => {
      // follow simple redirects
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        resp.resume();
        const next = absoluteUrl(resp.headers.location, u.toString());
        if (next && next !== url) return fetchLinkPreview(next).then(resolve);
        return resolve(null);
      }
      if (resp.statusCode !== 200) {
        resp.resume();
        return resolve(null);
      }
      const ct = String(resp.headers['content-type'] || '');
      if (!/text\/html|application\/xhtml/i.test(ct)) {
        resp.resume();
        return resolve(null);
      }
      let received = 0;
      const chunks = [];
      resp.on('data', (chunk) => {
        received += chunk.length;
        if (received > LINK_PREVIEW_MAX_BYTES) {
          resp.destroy();
          return;
        }
        chunks.push(chunk);
      });
      resp.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        // Truncate to <head> for safety
        const headEnd = html.search(/<\/head>/i);
        const slice = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 64 * 1024);
        const title = extractMetaTag(slice, 'og:title') || extractMetaTag(slice, 'twitter:title') || extractTitle(slice);
        const description = extractMetaTag(slice, 'og:description') || extractMetaTag(slice, 'twitter:description') || extractMetaTag(slice, 'description');
        const image = absoluteUrl(extractMetaTag(slice, 'og:image') || extractMetaTag(slice, 'twitter:image'), u.toString());
        const siteName = extractMetaTag(slice, 'og:site_name') || u.hostname;
        resolve({
          url,
          title: title.slice(0, 200),
          description: description.slice(0, 280),
          image: image.slice(0, 1000),
          siteName: siteName.slice(0, 80),
          host: u.hostname,
        });
      });
      resp.on('error', () => resolve(null));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function handleLinkPreview(req, res) {
  const url = new URL(req.url, 'http://forum.local');
  const target = String(url.searchParams.get('u') || '');
  if (!isPublicHttpUrl(target)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'invalid_url' }));
    return;
  }
  const cached = LINK_PREVIEW_CACHE.get(target);
  if (cached && Date.now() - cached.at < LINK_PREVIEW_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
    res.end(JSON.stringify(cached.data));
    return;
  }
  const data = await fetchLinkPreview(target);
  if (!data) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'no_preview' }));
    return;
  }
  LINK_PREVIEW_CACHE.set(target, { at: Date.now(), data });
  // prune occasionally
  if (LINK_PREVIEW_CACHE.size > 500) {
    const oldest = [...LINK_PREVIEW_CACHE.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
    for (const [k] of oldest) LINK_PREVIEW_CACHE.delete(k);
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
  res.end(JSON.stringify(data));
}

function safeReturnTo(value, fallback) {
  const text = String(value || '').trim();
  if (!text || text[0] !== '/' || text.startsWith('//')) return fallback;
  return text;
}

function friendlyError(err, noun) {
  const locale = (noun && noun.locale) || 'en';
  switch (err && err.code) {
    case 'INVALID_TITLE': return t(locale, 'errorInvalidTitle');
    case 'INVALID_BODY': return t(locale, 'errorInvalidBody');
    case 'INVALID_ANSWER': return t(locale, 'errorInvalidAnswer');
    case 'BUMP_COOLDOWN': return t(locale, 'errorBumpCooldown');
    case 'QUESTION_NOT_FOUND': return t(locale, 'errorQuestionGone');
    default: return t(locale, 'errorSave');
  }
}

module.exports = createInternalServer({
  key: 'forum',
  label: 'Forum',
  configKey: 'internalForum',
  defaultPort: 8091,
  defaultSubdomain: 'forum',
  defaultTitle: t('en', 'forumTitle'),
  handler: async (req, res, ctx) => {
    const session = getSession(req);
    const locale = pickLocale(req);
    const pathname = new URL(req.url, 'http://forum.local').pathname;
    try {
      if ((pathname === '/' || pathname === '') && req.method === 'GET') {
        return renderFeedPage(req, res, ctx, session);
      }
      if (pathname === '/ask' && req.method === 'POST') {
        return await handleAsk(req, res, ctx, session);
      }

      const detailMatch = pathname.match(/^\/q\/(\d+)\/?$/);
      if (detailMatch && req.method === 'GET') {
        const thread = forum.getQuestionThread(detailMatch[1], session && session.account ? session.account.address : null);
        if (!thread) return notFound(req, res, ctx, session);
        return renderDetailPage(req, res, ctx, session, thread);
      }

      const commentsJsonMatch = pathname.match(/^\/q\/(\d+)\/comments\.json$/);
      if (commentsJsonMatch && req.method === 'GET') {
        const viewer = session && session.account ? session.account.address : null;
        const thread = forum.getQuestionThread(commentsJsonMatch[1], viewer);
        if (!thread) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        const answers = thread.answers.map((a) => ({
          id: a.id,
          authorAddress: a.authorAddress,
          authorShort: shortenAddress(a.authorAddress, locale),
          body: a.body,
          createdAt: a.createdAt,
          ago: formatTimeAgo(locale, a.createdAt),
        }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ questionId: thread.question.id, answers }));
        return;
      }

      const answerMatch = pathname.match(/^\/q\/(\d+)\/answer\/?$/);
      if (answerMatch && req.method === 'POST') {
        return await handleAnswer(req, res, ctx, session, answerMatch[1]);
      }

      const bumpMatch = pathname.match(/^\/q\/(\d+)\/bump\/?$/);
      if (bumpMatch && req.method === 'POST') {
        return await handleBump(req, res, ctx, session, bumpMatch[1]);
      }

      const saveMatch = pathname.match(/^\/q\/(\d+)\/save\/?$/);
      if (saveMatch && req.method === 'POST') {
        return await handleSave(req, res, ctx, session, saveMatch[1]);
      }

      if (pathname === '/notifications/read' && req.method === 'POST') {
        return await handleNotificationsRead(req, res, ctx, session);
      }

      if (pathname === '/notifications' && req.method === 'GET') {
        return renderNotificationsPage(req, res, ctx, session);
      }

      if (pathname === '/api/link-preview' && req.method === 'GET') {
        return await handleLinkPreview(req, res);
      }

      return notFound(req, res, ctx, session);
    } catch (err) {
      console.error('[forum] request failed:', err);
      const page = renderPage(req, {
        apex: apexBase(),
        ctx,
        session,
        locale,
        title: t(locale, 'forumErrorTitle'),
        lead: t(locale, 'forumErrorLead'),
        content: `
          <section class="forum-card empty-state">
            <h1>${escapeHtml(t(locale, 'forumErrorHeading'))}</h1>
            <p>${escapeHtml(t(locale, 'forumErrorBody'))}</p>
          </section>
        `,
      });
      return html(res, 500, page);
    }
  },
});