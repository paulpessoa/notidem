// src/content/platforms/linkedin.js
// LinkedIn adapter. Strategy: do NOT depend on one fragile LinkedIn class name.
// Find any comment editor by its stable structure — a contenteditable element
// (Quill's .ql-editor) — and decide per editor whether it is a comment box or
// the messaging composer.

(() => {
  const N = globalThis.__notidem;
  const { isVisible, pickText, pickHref, placeholderOf } = N.util;

  function findEditors() {
    const set = new Set();
    // As of early 2026, LinkedIn's comment box is a Quill editor: the editable
    // node carries class "ql-editor" inside a ".ql-container". (LinkedIn briefly
    // used ProseMirror, then migrated back to Quill.) Match Quill first, keep
    // ProseMirror as a fallback in case of A/B rollouts.
    document.querySelectorAll('div.ql-editor[contenteditable="true"]').forEach((el) => set.add(el));
    document.querySelectorAll('div.ProseMirror[contenteditable="true"]').forEach((el) => set.add(el));
    // Fallback: any contenteditable that looks like a comment OR message box.
    document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      const ph = placeholderOf(el);
      const looksLikeComment =
        ph.includes('comment') || ph.includes('coment') ||
        ph.includes('reply') || ph.includes('respond') || ph.includes('responder');
      const looksLikeMessage =
        ph.includes('message') || ph.includes('mensagem') || ph.includes('escreva') ||
        el.closest('.msg-form__contenteditable') || el.closest('[class*="msg-form"]');
      if (looksLikeComment || looksLikeMessage) set.add(el);
    });
    return [...set];
  }

  function detectMode(editor) {
    if (
      editor.closest('.msg-form') ||
      editor.closest('[class*="msg-form"]') ||
      editor.closest('.msg-convo-wrapper') ||
      editor.closest('[class*="msg-overlay"]') ||
      location.pathname.startsWith('/messaging')
    ) {
      const ph = (editor.getAttribute('aria-label') || '').toLowerCase();
      // On the messaging page, only treat the actual composer as a message box.
      if (ph.includes('message') || ph.includes('mensagem') || editor.closest('[class*="msg-form"]')) {
        return 'message';
      }
    }
    return 'comment';
  }

  function inlineHost(editor, mode) {
    return (
      (mode === 'message'
        ? (editor.closest('.msg-form') || editor.closest('[class*="msg-form"]'))
        : null) ||
      editor.closest('.comments-comment-texteditor') ||
      editor.closest('.comments-comment-box') ||
      editor.closest('form') ||
      editor.closest('[class*="comment-box"]') ||
      editor.closest('[class*="comments-"]') ||
      editor.parentElement
    );
  }

  // ---- Post context ---------------------------------------------------------

  function findPostContainer(node) {
    let el = node;
    const selectors = [
      '.feed-shared-update-v2',
      '.fie-impression-container',
      '.occludable-update',
      '[data-urn]',
      '[data-id]',
      '[data-finite-scroll-hotkey-item]',
      'div.feed-shared-update-v2__content',
      'article',
    ];
    while (el && el !== document.body) {
      for (const s of selectors) {
        if (el.matches && el.matches(s)) return el;
      }
      el = el.parentElement;
    }
    el = node;
    for (let i = 0; i < 10 && el && el.parentElement; i++) el = el.parentElement;
    return el || document;
  }

  function findPostUrl(container) {
    let el = container;
    while (el && el !== document.body) {
      if (el.getAttribute) {
        const urn = el.getAttribute('data-urn') || el.getAttribute('data-id');
        if (urn && urn.includes('urn:li:')) {
          return `https://www.linkedin.com/feed/update/${urn}/`;
        }
      }
      el = el.parentElement;
    }
    return pickHref(container, [
      'a[href*="/feed/update/"]',
      'a[href*="/posts/"]',
      '.update-components-actor__meta a',
      '.feed-shared-actor__meta a',
      'a.app-aware-link',
    ]) || location.href;
  }

  function isInCommentsArea(el) {
    return !!(
      el.closest('.comments-comments-list') ||
      el.closest('[class*="comments-comment-item"]') ||
      el.closest('[class*="comments-comment-texteditor"]') ||
      el.closest('.notidem-host')
    );
  }

  function bestTextIn(scope, editor) {
    if (!scope || !scope.querySelectorAll) return '';
    let best = '';
    const nodes = scope.querySelectorAll('span[dir], p, span, div[dir]');
    for (const n of nodes) {
      if (editor && (n === editor || editor.contains(n) || n.contains(editor))) continue;
      if (isInCommentsArea(n)) continue;
      if (n.querySelector('[contenteditable="true"]')) continue;
      if (!isVisible(n)) continue;
      const t = (n.innerText || '').trim();
      if (t.length < 12) continue;
      if (/^(like|comment|repost|send|follow|·|reply|see more|see less)$/i.test(t)) continue;
      const childEls = n.children.length;
      if (childEls > 8 && t.length / childEls < 40) continue; // layout wrapper
      if (t.length > best.length) best = t;
    }
    return best;
  }

  // Walk up from the editor; at each ancestor keep the largest block of VISIBLE
  // text that isn't the comments section, the editor, or our own UI. Survives
  // class renames and ignores hidden hydration templates.
  function findPostTextNearEditor(editor) {
    let scope = editor ? editor.parentElement : null;
    let best = '';
    for (let level = 0; scope && scope !== document.body && level < 14; level++) {
      const candidate = bestTextIn(scope, editor);
      if (candidate.length > best.length) best = candidate;
      if (best.length >= 40 && level >= 2) break;
      scope = scope.parentElement;
    }
    return best.slice(0, 1500);
  }

  function findAuthorNearEditor(editor) {
    let scope = editor ? editor.parentElement : null;
    for (let level = 0; scope && scope !== document.body && level < 14; level++) {
      const link = scope.querySelector('a[href*="/in/"], a[href*="/company/"]');
      if (link && isVisible(link)) {
        const t = (link.innerText || '').trim().split('\n')[0];
        if (t && t.length > 1 && t.length < 80) return t;
      }
      scope = scope.parentElement;
    }
    return '';
  }

  function extractPost(editor) {
    const container = findPostContainer(editor);
    let postText = pickText(container, [
      '.feed-shared-inline-show-more-text .update-components-text',
      '.feed-shared-inline-show-more-text',
      '.update-components-text',
      '.feed-shared-update-v2__description .update-components-text',
      '.feed-shared-update-v2__description',
      '[data-test-id="main-feed-activity-card__commentary"]',
      '.feed-shared-text',
      '.update-components-update-v2__commentary',
    ]);
    if (!postText || postText.length < 12) {
      postText = findPostTextNearEditor(editor) || postText;
    }
    let postAuthor = pickText(container, [
      '.update-components-actor__title span[aria-hidden="true"]',
      '.update-components-actor__name span[aria-hidden="true"]',
      '.update-components-actor__title',
      '.update-components-actor__name',
      '.feed-shared-actor__name',
    ]);
    if (!postAuthor) postAuthor = findAuthorNearEditor(editor);
    return { postText, postAuthor: (postAuthor || '').split('\n')[0], postUrl: findPostUrl(container) };
  }

  // ---- Messaging context ----------------------------------------------------
  // Read the visible conversation so the AI can reply IN CONTEXT. Processed
  // locally and only sent to the AI provider the user chose, with their key.

  function extractMessages(editor) {
    const convo =
      editor.closest('.msg-convo-wrapper') ||
      editor.closest('[class*="msg-overlay-conversation"]') ||
      editor.closest('[class*="msg-"]') ||
      document.querySelector('.msg-convo-wrapper') ||
      document;

    let otherName =
      pickText(convo, [
        '.msg-entity-lockup__entity-title',
        '.msg-overlay-bubble-header__title',
        '.msg-thread__link-to-profile',
        'h2',
      ]) || findAuthorNearEditor(editor) || '';
    otherName = (otherName || '').split('\n')[0].slice(0, 80);

    const bubbles = [];
    const items = convo.querySelectorAll(
      '.msg-s-event-listitem, [class*="msg-s-event-listitem"], [class*="message-list-item"], li'
    );
    items.forEach((item) => {
      if (!isVisible(item)) return;
      if (editor.contains(item) || item.contains(editor)) return;
      const body = item.querySelector(
        '.msg-s-event-listitem__body, [class*="event-listitem__body"], p, span[dir]'
      );
      const text = ((body && body.innerText) || item.innerText || '').trim();
      if (!text || text.length < 2) return;
      const cls = typeof item.className === 'string' ? item.className : '';
      const isOther = /other|--other|incoming/i.test(cls) || item.querySelector('[class*="--other"]');
      const isSelf = /self|--self|outgoing|sent/i.test(cls) || item.querySelector('[class*="--self"]');
      bubbles.push({ who: isSelf && !isOther ? 'you' : 'them', text: text.slice(0, 600) });
    });

    const cleaned = [];
    for (const b of bubbles) {
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.text === b.text) continue;
      cleaned.push(b);
    }
    const recent = cleaned.slice(-12);
    const transcript = recent
      .map((b) => `${b.who === 'you' ? 'You' : (otherName || 'Them')}: ${b.text}`)
      .join('\n');

    return { otherName, transcript, conversationUrl: location.href };
  }

  N.register({
    id: 'linkedin',
    name: 'LinkedIn',
    trigger: 'inline',
    maxChars: 0,
    matches: (host) => host === 'linkedin.com' || host.endsWith('.linkedin.com'),
    findEditors,
    detectMode,
    inlineHost,
    extract: (editor, mode) => (mode === 'message' ? extractMessages(editor) : extractPost(editor)),
    scrapeTop() {
      const container = document.querySelector('.feed-shared-update-v2') || document;
      return {
        postText: pickText(container, ['.feed-shared-update-v2__description', '.update-components-text', '.feed-shared-text']),
        postAuthor: pickText(container, ['.update-components-actor__name', '.feed-shared-actor__name']).split('\n')[0],
        postUrl: location.href,
      };
    },
  });
})();
