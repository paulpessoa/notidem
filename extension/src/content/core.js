// src/content/core.js
// Platform-agnostic part of the content script: finds editors through the
// active platform adapter, injects the Notidem button, renders the drafting
// panel (inside Shadow DOM) and inserts the approved draft into the editor.
//
// Human in the loop: nothing is ever posted or sent. The user reviews the
// draft, clicks Insert, and then clicks the site's own Post/Send button.

(() => {
  'use strict';

  const N = globalThis.__notidem;
  const adapter = N && N.pick(location.hostname.toLowerCase());
  if (!adapter) return;

  // Keep in sync with src/lib/messages.js (content scripts can't import modules).
  const MSG = {
    GENERATE: 'GENERATE_COMMENT',
    GENERATE_MESSAGE: 'GENERATE_MESSAGE',
    SAVE_HISTORY: 'SAVE_HISTORY',
    GET_PAGE_POST: 'GET_PAGE_POST',
    OPEN_OPTIONS: 'OPEN_OPTIONS',
    GET_STATUS: 'GET_STATUS',
    TRACK: 'TRACK',
  };

  const MARK = 'data-notidem-ready';
  const FALLBACK_GOALS = {
    comment: { insight: 'Add an insight', experience: 'Share an experience', question: 'Ask a question', support: 'Agree & build on it', contrarian: 'Respectful counter-point' },
    message: { reply: 'Reply in context', thank: 'Thank / acknowledge', schedule: 'Propose a next step', answer: 'Answer their question', decline: 'Politely decline' },
  };
  const ICON_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let panel = null; // { host, root, editor, ctx, anchor }

  // ---- Shadow-DOM helper --------------------------------------------------

  function shadowHost(tag = 'div') {
    const host = document.createElement(tag);
    host.className = 'notidem-host';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = N.css;
    root.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'root' + (isDarkPage() ? ' dark' : '');
    root.appendChild(wrap);
    // Stop the host site's keyboard shortcuts (e.g. X's "l" = like) from firing
    // while the user types inside our UI. Events still reach our own handlers.
    ['keydown', 'keyup', 'keypress', 'input', 'paste', 'copy', 'cut'].forEach((ev) =>
      host.addEventListener(ev, (e) => e.stopPropagation())
    );
    return { host, root, wrap };
  }

  // Follow the host site's theme by measuring its background luminance.
  function isDarkPage() {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m) continue;
      const [r, g, b, a = 1] = m.map(Number);
      if (a === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ---- Scan + inject -------------------------------------------------------

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  let scanQueued = false;
  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scan(); });
  }
  scan();
  // Also rescan periodically — these sites are SPAs and mutations can be missed.
  setInterval(scan, 1500);

  function scan() {
    adapter.findEditors().forEach((editor) => {
      if (editor.getAttribute(MARK)) return;
      const mode = adapter.detectMode(editor);
      if (!mode) return; // not ready / not supported — retry on next scan
      if (injectTrigger(editor, mode)) editor.setAttribute(MARK, '1');
    });
  }

  function injectTrigger(editor, mode) {
    const host = adapter.inlineHost(editor, mode);
    if (!host) return false;
    if (host.querySelector(':scope > .notidem-host')) return true; // avoid dup

    const { host: el, wrap } = shadowHost('span');
    const compact = adapter.id !== 'linkedin';
    el.style.display = compact ? 'inline-flex' : 'block';
    wrap.innerHTML = `
      <div class="bar ${compact ? 'compact' : 'block'}">
        <button class="trigger" type="button" title="${mode === 'message' ? 'Draft a reply from the conversation, in your voice' : 'Draft a reply with AI, in your voice'}">
          <span class="logo">N</span>${mode === 'message' ? 'Notidem reply' : 'Notidem'}
        </button>
      </div>`;
    const btn = wrap.querySelector('.trigger');
    // Keep focus in the site's editor so its selection survives the click.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panel && panel.editor === editor) return closePanel();
      const ctx = { ...adapter.extract(editor, mode), mode };
      openPanel(btn, editor, ctx);
    });
    host.appendChild(el);
    return true;
  }

  // ---- Panel ---------------------------------------------------------------

  async function openPanel(anchor, editor, ctx) {
    closePanel();
    const { host, root, wrap } = shadowHost();
    Object.assign(host.style, { position: 'fixed', zIndex: '2147483000', top: '0', left: '0' });
    wrap.innerHTML = panelMarkup(ctx);
    // Inside a modal (e.g. X's reply dialog) mount within it so focus traps and
    // "click outside to close" logic of the site keep working.
    (editor.closest('[aria-modal="true"], [role="dialog"]') || document.body).appendChild(host);
    panel = { host, root, wrap, editor, ctx, anchor, draft: false };

    const $ = (s) => wrap.querySelector(s);
    $('.close').onclick = closePanel;
    $('.settings').onclick = () => send({ type: MSG.OPEN_OPTIONS });
    $('.generate').onclick = () => generate();
    $('.regen').onclick = () => generate();
    $('.copy').onclick = () => copyDraft();
    $('.insert').onclick = () => insert();
    $('.ctx-toggle') && ($('.ctx-toggle').onclick = () => {
      const open = $('.ctx').classList.toggle('open');
      $('.ctx-toggle').textContent = open ? 'Show less' : 'Show more';
    });
    wrap.querySelectorAll('.chips .chip').forEach((chip) =>
      chip.addEventListener('click', () => pressOne(chip))
    );
    wrap.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => pressOne(b)));
    wrap.addEventListener('keydown', onPanelKey);

    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 50);

    // Status: default goal/length, setup warnings, goal labels from the worker.
    const status = await send({ type: MSG.GET_STATUS });
    if (!panel || panel.host !== host) return;
    if (status) {
      renderGoals(status);
      if (!status.hasKey || !status.hasProfile) renderSetup(status);
    }
    send({ type: MSG.TRACK, payload: { name: 'panel_open', params: { platform: adapter.id, mode: ctx.mode } } });
  }

  function pressOne(btn) {
    btn.parentElement.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  }

  function renderGoals(status) {
    const isMsg = panel.ctx.mode === 'message';
    const goals = (isMsg ? status.messageGoals : status.goals) || FALLBACK_GOALS[panel.ctx.mode];
    const preferred = isMsg ? 'reply' : status.defaultGoal;
    const chips = panel.wrap.querySelector('.chips');
    chips.innerHTML = Object.entries(goals).map(([id, label], i) =>
      `<button type="button" class="chip" data-value="${id}" aria-pressed="${id === preferred || (!goals[preferred] && i === 0)}">${esc(label)}</button>`
    ).join('');
    chips.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => pressOne(chip)));
    if (status.defaultLength) {
      panel.wrap.querySelectorAll('.seg button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.value === status.defaultLength))
      );
    }
  }

  function renderSetup(status) {
    const box = panel.wrap.querySelector('.setup');
    const missing = [!status.hasProfile && 'a short profile', !status.hasKey && `an API key for ${status.providerLabel}`].filter(Boolean);
    box.innerHTML = `<span class="logo">N</span><div>Almost there — add ${missing.join(' and ')} so drafts sound like you. <button type="button" class="link">Finish setup →</button></div>`;
    box.hidden = false;
    box.querySelector('.link').onclick = () =>
      send({ type: MSG.OPEN_OPTIONS, payload: { section: status.hasProfile ? 'ai' : 'profile' } });
  }

  function panelMarkup(ctx) {
    const isMsg = ctx.mode === 'message';
    const who = isMsg ? ctx.otherName : ctx.postAuthor;
    const source = isMsg ? ctx.transcript : ctx.postText;
    const excerpt = isMsg ? (source || '').slice(-600) : (source || '').slice(0, 1200);
    const goals = FALLBACK_GOALS[ctx.mode];
    const beta = adapter.id === 'x' ? '<span class="pill beta">Beta</span>' : '';
    const kindLabel = isMsg ? 'Message reply' : (adapter.id === 'x' ? 'Reply' : 'Comment');

    return `
      <div class="panel" role="dialog" aria-label="Notidem">
        <header class="head">
          <div class="brand">
            <span class="logo lg">N</span>
            <div>
              <div class="title">Notidem</div>
              <div class="sub">${esc(adapter.name)} · ${kindLabel} ${beta}</div>
            </div>
          </div>
          <button class="icon-btn settings" type="button" title="Settings" aria-label="Settings">${ICON_GEAR}</button>
          <button class="icon-btn close" type="button" title="Close (Esc)" aria-label="Close">${ICON_CLOSE}</button>
        </header>
        <div class="body">
          <div class="setup" hidden></div>
          <section class="ctx">
            <div class="ctx-meta">${who ? `Replying to <strong>${esc(who)}</strong>` : 'Replying to this ' + (isMsg ? 'conversation' : 'post')}</div>
            ${source
              ? `<p class="ctx-text">${esc(excerpt)}</p>${excerpt.length > 180 ? '<button type="button" class="link ctx-toggle">Show more</button>' : ''}`
              : `<p class="ctx-text ctx-empty">${isMsg ? 'No conversation detected yet. Open a chat thread, or select the messages with your mouse.' : 'No post text detected. Expand the post (“see more”) or select its text with your mouse.'}</p>`}
          </section>
          <div class="label">Goal</div>
          <div class="chips">${Object.entries(goals).map(([id, label], i) =>
            `<button type="button" class="chip" data-value="${id}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('')}</div>
          <div class="row">
            <div class="label" style="margin:0">Length</div>
            <div class="seg" role="group" aria-label="Length">
              <button type="button" data-value="short" aria-pressed="${adapter.maxChars ? 'true' : 'false'}">Short</button>
              <button type="button" data-value="medium" aria-pressed="${adapter.maxChars ? 'false' : 'true'}">Medium</button>
              <button type="button" data-value="long" aria-pressed="false">Long</button>
            </div>
          </div>
          <input class="input custom" type="text" placeholder="${isMsg ? 'Optional: anything to add? e.g. “keep it warm but brief”' : 'Optional: anything to add? e.g. “mention my fintech background”'}" />
          <div class="out" data-state="idle">
            <p class="hint">Pick a goal and generate a draft. You review it before anything is posted. <span class="kbd">Ctrl</span> + <span class="kbd">Enter</span></p>
          </div>
          <div class="counter"></div>
        </div>
        <footer class="foot">
          <button class="btn primary generate" type="button">Generate</button>
          <button class="btn ghost regen" type="button" hidden>Regenerate</button>
          <button class="btn ghost copy" type="button" hidden>Copy</button>
          <button class="btn primary insert push" type="button" hidden>Insert</button>
        </footer>
        <div class="status" aria-live="polite"></div>
      </div>`;
  }

  function onPanelKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (panel.draft) insert(); else generate();
    }
  }

  async function generate() {
    const { wrap, editor, ctx } = panel;
    const $ = (s) => wrap.querySelector(s);
    const isMsg = ctx.mode === 'message';

    // Re-extract right now: sites load content asynchronously, so the context
    // captured when the button was first clicked may be stale or empty.
    const fresh = adapter.extract(editor, ctx.mode);
    for (const k of Object.keys(fresh)) if (fresh[k]) ctx[k] = fresh[k];

    // Escape hatch: whatever the user highlighted with the mouse.
    const primary = isMsg ? ctx.transcript : ctx.postText;
    if (!primary || primary.trim().length < 12) {
      const selected = (window.getSelection && window.getSelection().toString().trim()) || '';
      if (selected.length >= 12) {
        if (isMsg) ctx.transcript = selected.slice(0, 1500);
        else ctx.postText = selected.slice(0, 1500);
        const t = $('.ctx-text');
        t.classList.remove('ctx-empty');
        t.textContent = selected.slice(0, 600);
      } else {
        showError(isMsg
          ? 'Could not read the conversation automatically. Quick fix: select the messages with your mouse, then click Generate again.'
          : 'Could not read the post automatically. Quick fix: select the post text with your mouse, then click Generate again.');
        return;
      }
    }

    const out = $('.out');
    out.dataset.state = 'loading';
    out.innerHTML = '<div class="loading" aria-label="Drafting"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    setStatus('');
    $('.counter').textContent = '';
    ['.generate', '.regen', '.copy', '.insert'].forEach((s) => ($(s).disabled = true));

    const payload = {
      platform: adapter.id,
      surface: 'panel',
      goal: wrap.querySelector('.chips [aria-pressed="true"]')?.dataset.value,
      length: wrap.querySelector('.seg [aria-pressed="true"]')?.dataset.value,
      customInstruction: $('.custom').value || '',
      ...(isMsg
        ? { transcript: ctx.transcript, otherName: ctx.otherName }
        : { postText: ctx.postText, postAuthor: ctx.postAuthor }),
    };
    const resp = await send({ type: isMsg ? MSG.GENERATE_MESSAGE : MSG.GENERATE, payload });
    if (!panel || panel.wrap !== wrap) return;
    ['.generate', '.regen', '.copy', '.insert'].forEach((s) => ($(s).disabled = false));

    if (!resp || !resp.ok) {
      showError(resp && resp.error ? resp.error : 'Something went wrong. Is the extension still enabled? Try reloading the page.');
      const st = $('.status');
      st.innerHTML = '<button class="link" type="button">Open Settings →</button>';
      st.querySelector('.link').onclick = () => send({ type: MSG.OPEN_OPTIONS });
      return;
    }

    out.dataset.state = 'ready';
    out.innerHTML = `<textarea class="textarea" spellcheck="true" aria-label="Draft"></textarea>`;
    const ta = out.querySelector('textarea');
    ta.value = resp.comment;
    const max = resp.maxChars || adapter.maxChars || 0;
    const count = () => {
      const c = $('.counter');
      c.textContent = max ? `${ta.value.length} / ${max}` : `${ta.value.length} characters`;
      c.classList.toggle('over', Boolean(max && ta.value.length > max));
    };
    ta.addEventListener('input', count);
    count();
    ta.focus();
    panel.draft = true;
    $('.generate').hidden = true;
    $('.regen').hidden = false;
    $('.copy').hidden = false;
    $('.insert').hidden = false;
    setStatus(`${resp.providerLabel || resp.provider} · ${resp.language} · Edit freely before inserting`);
  }

  function showError(msg) {
    const out = panel.wrap.querySelector('.out');
    out.dataset.state = 'error';
    out.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = msg;
    out.appendChild(div);
    ['.generate', '.regen', '.copy', '.insert'].forEach((s) => (panel.wrap.querySelector(s).disabled = false));
  }

  function setStatus(text, kind = '') {
    const st = panel.wrap.querySelector('.status');
    st.className = 'status ' + kind;
    st.textContent = text;
  }

  function currentDraft() {
    const ta = panel && panel.wrap.querySelector('.textarea');
    return ta ? ta.value.trim() : '';
  }

  async function copyDraft() {
    const text = currentDraft();
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setStatus('✓ Copied to clipboard', 'ok'); }
    catch { setStatus('Could not copy — select the text and press Ctrl/Cmd+C.'); }
    saveHistory(text, 'copy');
  }

  function saveHistory(text, how) {
    const { ctx } = panel;
    const isMsg = ctx.mode === 'message';
    send({
      type: MSG.SAVE_HISTORY,
      payload: {
        comment: text,
        kind: isMsg ? 'message' : 'comment',
        platform: adapter.id,
        surface: how,
        postAuthor: isMsg ? (ctx.otherName || '') : (ctx.postAuthor || ''),
        postTitle: isMsg
          ? `Message to ${ctx.otherName || 'a connection'}`
          : (ctx.postText || '').split('\n')[0].slice(0, 90),
        postUrl: (isMsg ? ctx.conversationUrl : ctx.postUrl) || location.href,
        savedAt: new Date().toISOString(),
      },
    });
  }

  // ---- Insert into the site's editor -----------------------------------------

  function insert() {
    const text = currentDraft();
    if (!text) return;
    const { editor } = panel;

    editor.focus();
    // Move the caret to the end of any existing content (append, don't overwrite).
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}

    const probe = text.slice(0, 12);
    const landed = () => (editor.innerText || '').includes(probe);
    let inserted = false;

    // Strategy 1 — synthetic paste. Quill, ProseMirror and Draft.js intercept
    // paste and route the text through their internal document model, keeping
    // the model and DOM in sync. Writing to the DOM directly would desync them.
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      inserted = landed();
    } catch (_) {}

    // Strategy 2 — beforeinput with insertFromPaste (Input Events spec).
    if (!inserted) {
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        editor.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertFromPaste', dataTransfer: dt,
        }));
        inserted = landed();
      } catch (_) {}
    }

    // Strategy 3 — execCommand insertText: deprecated but routes through the
    // editor's selection, so the model stays consistent.
    if (!inserted) {
      try {
        document.execCommand('insertText', false, text);
        inserted = landed();
      } catch (_) {}
    }

    // We deliberately never fall back to editor.textContent = text (it corrupts
    // the editor's model). If every safe path failed, copy to clipboard instead.
    saveHistory(text, 'insert');
    if (!inserted) {
      try { navigator.clipboard.writeText(text); } catch (_) {}
      setStatus('Could not auto-insert — copied to clipboard. Click the box and paste (Ctrl/Cmd+V).');
      return;
    }
    ['input', 'change'].forEach((ev) => editor.dispatchEvent(new Event(ev, { bubbles: true })));
    closePanel();
  }

  // ---- Positioning + lifecycle ---------------------------------------------

  function position() {
    if (!panel) return;
    if (!panel.anchor.isConnected) return closePanel();
    const r = panel.anchor.getBoundingClientRect();
    const box = panel.wrap.querySelector('.panel');
    const w = box.offsetWidth || 400;
    const h = box.offsetHeight || 480;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    panel.host.style.left = `${left}px`;
    panel.host.style.top = `${top}px`;
  }

  function closePanel() {
    if (!panel) return;
    panel.host.remove();
    panel = null;
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('scroll', position, true);
    window.removeEventListener('resize', position);
  }

  function onOutside(e) {
    if (!panel) return;
    const path = e.composedPath();
    if (path.includes(panel.host)) return;
    if (path.some((n) => n && n.classList && n.classList.contains('notidem-host'))) return;
    closePanel();
  }

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(resp);
        });
      } catch (_) {
        resolve(null); // extension was reloaded; this page's script is orphaned
      }
    });
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- Popup bridge -------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === MSG.GET_PAGE_POST) {
      const editor = adapter.findEditors().find((ed) => adapter.detectMode(ed) === 'comment');
      const ctx = editor ? adapter.extract(editor, 'comment') : adapter.scrapeTop();
      const selected = (window.getSelection && window.getSelection().toString().trim()) || '';
      sendResponse({ ...ctx, selected: selected.slice(0, 1500), platform: adapter.id });
    }
    return false;
  });

  console.log(`[Notidem] content script loaded on ${adapter.name}.`);
})();
