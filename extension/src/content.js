// src/content.js
// Runs on linkedin.com. Self-contained IIFE (no ES imports).
// Strategy: do NOT depend on one fragile LinkedIn class name. Instead, find any
// comment editor by its stable structure — a contenteditable element (Quill's
// .ql-editor) — and inject the trigger next to it. Works even when LinkedIn
// renames its wrapper classes.

(() => {
  'use strict';

  const MSG = {
    GENERATE: 'GENERATE_COMMENT',
    GENERATE_MESSAGE: 'GENERATE_MESSAGE',
    SAVE_HISTORY: 'SAVE_HISTORY',
    GET_PAGE_POST: 'GET_PAGE_POST',
    OPEN_OPTIONS: 'OPEN_OPTIONS',
    GET_PREFS: 'GET_PREFS',
  };

  const MARK = 'data-cc-ready';
  let panel = null;

  // ---- Find editors by stable structure -----------------------------------
  // LinkedIn uses contenteditable rich-text editors for BOTH comment boxes
  // (Quill .ql-editor) and the messaging composer. We match broadly and decide
  // per-editor whether it's a comment or a message via detectMode().

  function findEditors() {
    const set = new Set();
    // As of early 2026, LinkedIn's comment box is a Quill editor: the editable
    // node carries class "ql-editor" inside a ".ql-container". (LinkedIn briefly
    // used ProseMirror, then migrated back to Quill — verified against the live
    // DOM and community reports.) Match Quill first, keep ProseMirror as a
    // fallback in case of A/B rollouts.
    document.querySelectorAll('div.ql-editor[contenteditable="true"]').forEach((el) => set.add(el));
    document.querySelectorAll('div.ProseMirror[contenteditable="true"]').forEach((el) => set.add(el));
    // Messaging composer: contenteditable with a message-related label.
    // Fallback: any contenteditable that looks like a comment OR message box.
    document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      const ph = (el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || el.getAttribute('aria-placeholder') || '').toLowerCase();
      const looksLikeComment =
        ph.includes('comment') || ph.includes('coment') ||
        ph.includes('reply') || ph.includes('respond') || ph.includes('responder');
      const looksLikeMessage =
        ph.includes('message') || ph.includes('mensagem') ||
        ph.includes('write a message') || ph.includes('escreva') ||
        el.closest('.msg-form__contenteditable') || el.closest('[class*="msg-form"]');
      if (looksLikeComment || looksLikeMessage) set.add(el);
    });
    return [...set];
  }

  // Decide whether an editor is a comment box or the messaging composer.
  // Drives which context we extract and which prompt the background uses.
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

  // Detect which rich-text engine an editable node belongs to. This lets the
  // insert step pick the safe injection path instead of guessing.
  function editorKind(editor) {
    if (editor.closest('.ql-container') || editor.classList.contains('ql-editor')) return 'quill';
    if (editor.classList.contains('ProseMirror')) return 'prosemirror';
    return 'unknown';
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
  // Also rescan periodically — LinkedIn is a SPA and mutations can be missed.
  setInterval(scan, 1500);

  function scan() {
    findEditors().forEach((editor) => {
      if (editor.getAttribute(MARK)) return;
      editor.setAttribute(MARK, '1');
      injectTrigger(editor);
    });
  }

  function injectTrigger(editor) {
    const mode = detectMode(editor);
    // Place the button right after the editor's nearest sensible container.
    const host =
      (mode === 'message'
        ? (editor.closest('.msg-form') || editor.closest('[class*="msg-form"]'))
        : null) ||
      editor.closest('.comments-comment-texteditor') ||
      editor.closest('.comments-comment-box') ||
      editor.closest('form') ||
      editor.closest('[class*="comment-box"]') ||
      editor.closest('[class*="comments-"]') ||
      editor.parentElement;
    if (!host) return;
    if (host.querySelector(':scope > .cc-trigger-bar')) return; // avoid dup

    const bar = document.createElement('div');
    bar.className = 'cc-trigger-bar';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-trigger';
    const label = mode === 'message' ? 'Notidem reply' : 'Notidem';
    btn.innerHTML = '<span class="cc-trigger-spark">\u2726</span> ' + label;
    btn.title =
      mode === 'message'
        ? 'Draft a reply from the conversation, in your voice'
        : 'Draft a comment with AI from your profile';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ctx =
        mode === 'message' ? extractMessageContext(editor) : extractContext(editor);
      ctx.mode = mode;
      openPanel(btn, editor, ctx);
    });

    bar.appendChild(btn);
    host.appendChild(bar);
  }

  // ---- Extract post text, author, and permalink ---------------------------

  function extractContext(editor) {
    // LinkedIn renders post text via React hydration and frequently renames its
    // classes, so we don't trust any single selector. Strategy:
    //   1. Try known selectors first (fast path, correct when they exist).
    //   2. Otherwise, walk UP from the comment editor and, at each ancestor
    //      level, grab the largest block of VISIBLE text that isn't the
    //      comments section, the editor, or our own UI. Visible-text + geometry
    //      survives class renames and ignores hidden hydration templates.
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

    // Primary robust fallback: climb from the editor looking for the post body.
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

    const postUrl = pickHref(container, [
      'a[href*="/feed/update/"]',
      'a[href*="/posts/"]',
      '.update-components-actor__meta a',
    ]) || location.href;

    const result = { postText, postAuthor, postUrl };
    console.debug('[Notidem] detected context:', {
      author: postAuthor || '(none)',
      textChars: postText ? postText.length : 0,
      preview: postText ? postText.slice(0, 80) : '(empty)',
    });
    return result;
  }

  // True only if the element is actually painted on screen. Filters out the
  // hidden <code>/template nodes LinkedIn uses for hydration, which is exactly
  // what was making every post read as empty.
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function isInCommentsArea(el) {
    return !!(
      el.closest('.comments-comments-list') ||
      el.closest('[class*="comments-comment-item"]') ||
      el.closest('[class*="comments-comment-texteditor"]') ||
      el.closest('.cc-panel') ||
      el.closest('.cc-trigger-bar')
    );
  }

  // Walk up from the editor. At each ancestor, score every visible text node and
  // keep the best candidate for the post body. We stop climbing once we've found
  // a solid block, or after a bounded number of levels.
  function findPostTextNearEditor(editor) {
    let scope = editor ? editor.parentElement : null;
    let best = '';
    for (let level = 0; scope && scope !== document.body && level < 14; level++) {
      const candidate = bestTextIn(scope, editor);
      if (candidate.length > best.length) best = candidate;
      // A real post body is usually 40+ chars; once we have that and climbed a
      // few levels, stop — climbing further risks pulling in neighbouring posts.
      if (best.length >= 40 && level >= 2) break;
      scope = scope.parentElement;
    }
    return best.slice(0, 1500);
  }

  function bestTextIn(scope, editor) {
    if (!scope || !scope.querySelectorAll) return '';
    let best = '';
    // dir="ltr" / dir="rtl" marks user-authored text runs on LinkedIn; we also
    // accept spans and paragraphs generally.
    const nodes = scope.querySelectorAll('span[dir], p, span, div[dir]');
    for (const n of nodes) {
      if (editor && (n === editor || editor.contains(n) || n.contains(editor))) continue;
      if (isInCommentsArea(n)) continue;
      if (n.querySelector('[contenteditable="true"]')) continue;
      if (!isVisible(n)) continue;
      const t = (n.innerText || '').trim();
      if (t.length < 12) continue;
      // Avoid pure UI strings.
      if (/^(like|comment|repost|send|follow|·|reply|see more|see less)$/i.test(t)) continue;
      const childEls = n.children.length;
      if (childEls > 8 && t.length / childEls < 40) continue; // layout wrapper
      if (t.length > best.length) best = t;
    }
    return best;
  }

  function findAuthorNearEditor(editor) {
    let scope = editor ? editor.parentElement : null;
    for (let level = 0; scope && scope !== document.body && level < 14; level++) {
      // Author names are usually inside a link to a profile, near the top.
      const link = scope.querySelector('a[href*="/in/"], a[href*="/company/"]');
      if (link && isVisible(link)) {
        const t = (link.innerText || '').trim().split('\n')[0];
        if (t && t.length > 1 && t.length < 80) return t;
      }
      scope = scope.parentElement;
    }
    return '';
  }

  // ---- Messaging context ---------------------------------------------------
  // Read the visible conversation so the AI can reply IN CONTEXT. Privacy note:
  // this text is processed locally and only sent to the AI provider the user
  // chose (with their own key). It never goes to any Notidem server.
  //
  // We identify who said what without relying on a single class name: messages
  // the user sent are visually right-aligned / flagged "outgoing"; the rest are
  // from the other person. We fall back to "them"/"you" labels if unsure.
  function extractMessageContext(editor) {
    const convo =
      editor.closest('.msg-convo-wrapper') ||
      editor.closest('[class*="msg-overlay-conversation"]') ||
      editor.closest('[class*="msg-"]') ||
      document.querySelector('.msg-convo-wrapper') ||
      document;

    // The other person's name: the conversation title / participant link.
    let otherName =
      pickText(convo, [
        '.msg-entity-lockup__entity-title',
        '.msg-overlay-bubble-header__title',
        '.msg-thread__link-to-profile',
        'h2',
      ]) || findAuthorNearEditor(editor) || '';
    otherName = (otherName || '').split('\n')[0].slice(0, 80);

    // Collect message bubbles in order. Each list item usually holds one or more
    // message bodies. We keep it simple and robust: gather visible text bubbles.
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
      // Heuristic for sender: LinkedIn marks the user's own messages with an
      // "other"/"self" class or right alignment. We check a few signals.
      const cls = item.className || '';
      const isOther =
        /other|--other|incoming/i.test(cls) ||
        item.querySelector('[class*="--other"]');
      const isSelf =
        /self|--self|outgoing|sent/i.test(cls) ||
        item.querySelector('[class*="--self"]');
      let who = 'them';
      if (isSelf && !isOther) who = 'you';
      bubbles.push({ who, text: text.slice(0, 600) });
    });

    // De-dup consecutive identical bubbles (LinkedIn sometimes nests text).
    const cleaned = [];
    for (const b of bubbles) {
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.text === b.text) continue;
      cleaned.push(b);
    }

    // Keep the last ~12 turns so the prompt stays focused and cheap.
    const recent = cleaned.slice(-12);
    const transcript = recent
      .map((b) => `${b.who === 'you' ? 'You' : (otherName || 'Them')}: ${b.text}`)
      .join('\n');

    const result = {
      mode: 'message',
      otherName,
      transcript,
      conversationUrl: location.href,
    };
    console.debug('[Notidem] message context:', {
      with: otherName || '(unknown)',
      turns: recent.length,
      chars: transcript.length,
    });
    return result;
  }

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
    // Last resort: walk up a fixed number of levels and return the biggest block.
    el = node;
    for (let i = 0; i < 10 && el && el.parentElement; i++) el = el.parentElement;
    return el || document;
  }

  function pickText(scope, selectors) {
    if (!scope || !scope.querySelector) return '';
    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      const txt = el && el.innerText ? el.innerText.trim() : '';
      if (txt) return txt;
    }
    return '';
  }

  function pickHref(scope, selectors) {
    if (!scope || !scope.querySelector) return '';
    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      if (el && el.href) return el.href.split('?')[0];
    }
    return '';
  }

  // ---- Panel UI ------------------------------------------------------------

  function openPanel(anchor, editor, ctx) {
    closePanel();

    panel = document.createElement('div');
    panel.className = 'cc-panel';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = panelMarkup(ctx);
    document.body.appendChild(panel);

    position(panel, anchor);

    panel.querySelector('.cc-close').onclick = closePanel;
    panel.querySelector('.cc-generate').onclick = () => generate(ctx, editor);
    panel.querySelector('.cc-regenerate').onclick = () => generate(ctx, editor);
    panel.querySelector('.cc-insert').onclick = () => insert(editor, ctx);

    // Apply the user's saved default goal/length, if any.
    sendMessage({ type: MSG.GET_PREFS }).then((prefs) => {
      if (!prefs || !panel) return;
      const goalSel = panel.querySelector('.cc-goal');
      const lenSel = panel.querySelector('.cc-length');
      if (goalSel && prefs.defaultGoal) goalSel.value = prefs.defaultGoal;
      if (lenSel && prefs.defaultLength) lenSel.value = prefs.defaultLength;
    });

    setTimeout(() => document.addEventListener('mousedown', onOutside), 50);
  }

  function panelMarkup(ctx) {
    const isMsg = ctx.mode === 'message';
    const title = isMsg ? 'Notidem reply' : 'Notidem';

    let meta = '';
    let excerpt = '';
    if (isMsg) {
      meta = ctx.otherName
        ? `<div class="cc-meta">Replying to <strong>${esc(ctx.otherName)}</strong></div>`
        : '';
      excerpt = ctx.transcript
        ? `<p class="cc-excerpt">${esc(ctx.transcript.slice(-260))}</p>`
        : `<p class="cc-excerpt cc-excerpt-empty">No conversation detected yet. Open a chat thread, then try again.</p>`;
    } else {
      meta = ctx.postAuthor
        ? `<div class="cc-meta">Replying to <strong>${esc(ctx.postAuthor)}</strong></div>`
        : '';
      excerpt = ctx.postText
        ? `<p class="cc-excerpt">${esc(ctx.postText.slice(0, 200))}${ctx.postText.length > 200 ? '\u2026' : ''}</p>`
        : `<p class="cc-excerpt cc-excerpt-empty">No post text detected nearby. You can still generate, but results may be generic.</p>`;
    }

    const goalOptions = isMsg
      ? `
              <option value="reply">Reply in context</option>
              <option value="thank">Thank / acknowledge</option>
              <option value="schedule">Propose a next step</option>
              <option value="answer">Answer their question</option>
              <option value="decline">Politely decline</option>`
      : `
              <option value="insight">Add an insight</option>
              <option value="experience">Share an experience</option>
              <option value="question">Ask a question</option>
              <option value="support">Agree &amp; build on it</option>
              <option value="contrarian">Respectful counter-point</option>`;

    const customPlaceholder = isMsg
      ? "Optional: tell the AI anything (e.g. 'keep it warm but brief')"
      : "Optional: tell the AI anything (e.g. 'mention my fintech background')";

    const hint = isMsg
      ? 'Pick a goal, generate a reply, tweak it, then insert it into the message box.'
      : 'Pick a goal, generate a draft, tweak it, then insert it into the comment box.';

    return `
      <div class="cc-head">
        <span class="cc-head-title"><span class="cc-spark">\u2726</span> ${title}</span>
        <button class="cc-close" type="button" aria-label="Close">\u2715</button>
      </div>
      <div class="cc-body">
        ${meta}
        ${excerpt}
        <div class="cc-controls">
          <label class="cc-field">
            <span class="cc-field-label">Goal</span>
            <select class="cc-select cc-goal">${goalOptions}
            </select>
          </label>
          <label class="cc-field">
            <span class="cc-field-label">Length</span>
            <select class="cc-select cc-length">
              <option value="short">Short</option>
              <option value="medium" selected>Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
        </div>
        <input class="cc-custom" type="text" placeholder="${customPlaceholder}" />
        <div class="cc-output" data-state="idle">
          <p class="cc-hint">${hint}</p>
        </div>
      </div>
      <div class="cc-foot">
        <button class="cc-btn cc-generate" type="button">Generate</button>
        <button class="cc-btn cc-ghost cc-regenerate" type="button" disabled>Regenerate</button>
        <button class="cc-btn cc-primary cc-insert" type="button" disabled>Insert</button>
      </div>
      <div class="cc-status"></div>
    `;
  }

  async function generate(ctx, editor) {
    const output = panel.querySelector('.cc-output');
    const status = panel.querySelector('.cc-status');
    const genBtn = panel.querySelector('.cc-generate');
    const regenBtn = panel.querySelector('.cc-regenerate');
    const insertBtn = panel.querySelector('.cc-insert');
    const isMsg = ctx.mode === 'message';

    // Re-extract right now: LinkedIn loads content asynchronously, so the context
    // captured when the button was first clicked may be stale or empty.
    if (isMsg) {
      const fresh = extractMessageContext(editor);
      if (fresh.transcript) ctx.transcript = fresh.transcript;
      if (fresh.otherName) ctx.otherName = fresh.otherName;
    } else {
      const fresh = extractContext(editor);
      if (fresh.postText) ctx.postText = fresh.postText;
      if (fresh.postAuthor) ctx.postAuthor = fresh.postAuthor;
      if (fresh.postUrl) ctx.postUrl = fresh.postUrl;
    }

    // Refresh the excerpt shown in the panel.
    const excerptEl = panel.querySelector('.cc-excerpt');
    if (excerptEl) {
      const shown = isMsg ? ctx.transcript : ctx.postText;
      if (shown) {
        excerptEl.classList.remove('cc-excerpt-empty');
        excerptEl.textContent = isMsg
          ? shown.slice(-260)
          : shown.slice(0, 200) + (shown.length > 200 ? '\u2026' : '');
      }
    }

    // Hard stop with a guaranteed escape hatch via mouse selection.
    const primaryText = isMsg ? ctx.transcript : ctx.postText;
    if (!primaryText || primaryText.trim().length < 12) {
      const selected = (window.getSelection && window.getSelection().toString().trim()) || '';
      if (selected.length >= 12) {
        if (isMsg) ctx.transcript = selected.slice(0, 1500);
        else ctx.postText = selected.slice(0, 1500);
      } else {
        output.dataset.state = 'error';
        output.innerHTML = isMsg
          ? '<div class="cc-error">Could not read the conversation automatically.<br><br><strong>Quick fix:</strong> select the messages with your mouse, then click Generate again.</div>'
          : '<div class="cc-error">Could not read the post automatically.<br><br><strong>Quick fix:</strong> select the post text with your mouse (highlight it), then click Generate again.</div>';
        status.textContent = '';
        genBtn.disabled = false;
        return;
      }
    }

    output.dataset.state = 'loading';
    output.innerHTML =
      '<div class="cc-loading"><span class="cc-spinner"></span> ' +
      (isMsg ? 'Drafting your reply\u2026' : 'Drafting your comment\u2026') +
      '</div>';
    status.textContent = '';
    [genBtn, regenBtn, insertBtn].forEach((b) => (b.disabled = true));

    const goal = panel.querySelector('.cc-goal')?.value;
    const length = panel.querySelector('.cc-length')?.value;
    const customInstruction = panel.querySelector('.cc-custom')?.value || '';

    const resp = await sendMessage(
      isMsg
        ? {
            type: MSG.GENERATE_MESSAGE,
            payload: {
              transcript: ctx.transcript,
              otherName: ctx.otherName,
              goal,
              length,
              customInstruction,
            },
          }
        : {
            type: MSG.GENERATE,
            payload: {
              postText: ctx.postText,
              postAuthor: ctx.postAuthor,
              goal,
              length,
              customInstruction,
            },
          }
    );

    genBtn.disabled = false;

    if (!resp || !resp.ok) {
      output.dataset.state = 'error';
      output.innerHTML = `<div class="cc-error">${esc(resp && resp.error ? resp.error : 'Something went wrong.')}</div>`;
      status.innerHTML = '<button class="cc-link cc-open-settings" type="button">Open Settings \u2192</button>';
      const s = panel.querySelector('.cc-open-settings');
      if (s) s.addEventListener('click', () => sendMessage({ type: MSG.OPEN_OPTIONS }));
      return;
    }

    output.dataset.state = 'ready';
    output.innerHTML = `<textarea class="cc-textarea" spellcheck="true">${esc(resp.comment)}</textarea>`;
    regenBtn.disabled = false;
    insertBtn.disabled = false;
    status.textContent = `${cap(resp.provider)} \u00b7 ${resp.language}`;
  }

  function insert(editor, ctx) {
    const textarea = panel.querySelector('.cc-textarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) return;

    const kind = editorKind(editor);

    editor.focus();

    // Move the caret to the end of any existing content (without selecting it,
    // so we append rather than overwrite — friendlier if the user already typed).
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // collapse to end
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}

    let inserted = false;

    // Strategy 1 — synthetic paste. Quill (and ProseMirror) intercept the paste
    // event and route the text through their internal document model, keeping the
    // model and DOM in sync. This is the ONLY reliable way to inject text into a
    // modern rich-text editor: writing to the DOM directly desyncs Quill's Delta
    // state and makes the next keystroke/submit crash or silently drop the text.
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      editor.dispatchEvent(pasteEvent);
      inserted = (editor.innerText || '').includes(text.slice(0, 12));
    } catch (_) {}

    // Strategy 2 — beforeinput with insertFromPaste. Editors that follow the
    // Input Events spec (Quill 2.x included) honor this and update their model.
    if (!inserted) {
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const ev = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          dataTransfer: dt,
        });
        editor.dispatchEvent(ev);
        inserted = (editor.innerText || '').includes(text.slice(0, 12));
      } catch (_) {}
    }

    // Strategy 3 — execCommand insertText. Deprecated but still works in Chrome
    // and routes through the editor's selection, so the model stays consistent.
    if (!inserted) {
      try {
        document.execCommand('insertText', false, text);
        inserted = (editor.innerText || '').includes(text.slice(0, 12));
      } catch (_) {}
    }

    // NOTE: we deliberately do NOT fall back to editor.textContent = text.
    // Writing the DOM directly bypasses Quill's Delta model; the editor then
    // re-renders against a stale model and the comment box can crash or discard
    // the text on the next interaction. If all safe paths failed, we surface a
    // copy-to-clipboard fallback instead of corrupting the editor.
    if (!inserted) {
      try { navigator.clipboard.writeText(text); } catch (_) {}
      const status = panel.querySelector('.cc-status');
      if (status) {
        status.textContent = 'Could not auto-insert — copied to clipboard, just paste it (Ctrl/Cmd+V).';
      }
      // Still save to history below; do not close, let the user paste manually.
    } else {
      // Notify the editor's framework that content changed.
      ['input', 'change', 'keyup'].forEach((ev) =>
        editor.dispatchEvent(new Event(ev, { bubbles: true }))
      );
    }

    const isMsg = ctx.mode === 'message';
    sendMessage({
      type: MSG.SAVE_HISTORY,
      payload: {
        comment: text,
        kind: isMsg ? 'message' : 'comment',
        postAuthor: isMsg ? (ctx.otherName || '') : (ctx.postAuthor || ''),
        postTitle: isMsg
          ? `Message to ${ctx.otherName || 'a connection'}`
          : (ctx.postText || '').split('\n')[0].slice(0, 90),
        postUrl: (isMsg ? ctx.conversationUrl : ctx.postUrl) || location.href,
        savedAt: new Date().toISOString(),
      },
    });

    if (inserted) closePanel();
  }

  function position(el, anchor) {
    const r = anchor.getBoundingClientRect();
    const width = 380;
    let left = Math.max(8, r.left + window.scrollX);
    if (left + width > window.scrollX + window.innerWidth) {
      left = window.scrollX + window.innerWidth - width - 8;
    }
    el.style.top = `${r.bottom + window.scrollY + 8}px`;
    el.style.left = `${left}px`;
  }

  function closePanel() {
    if (panel) {
      panel.remove();
      panel = null;
      document.removeEventListener('mousedown', onOutside);
    }
  }

  function onOutside(e) {
    if (panel && !panel.contains(e.target)) closePanel();
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(resp);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  function esc(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cap(s) {
    return (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === MSG.GET_PAGE_POST) {
      const editor = findEditors()[0];
      const ctx = editor ? extractContext(editor) : scrapeTopPost();
      sendResponse(ctx);
      return false;
    }
    return false;
  });

  function scrapeTopPost() {
    const container = document.querySelector('.feed-shared-update-v2') || document;
    return {
      postText: pickText(container, [
        '.feed-shared-update-v2__description',
        '.update-components-text',
        '.feed-shared-text',
      ]),
      postAuthor: pickText(container, [
        '.update-components-actor__name',
        '.feed-shared-actor__name',
      ]),
      postUrl: location.href,
    };
  }

  // Visible signal in the console that the script loaded.
  console.log('[Notidem] content script loaded \u2014 watching for comment boxes.');
})();
