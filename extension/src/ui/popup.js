// src/ui/popup.js
// Toolbar popup. Shows where you are (and whether the in-page button exists
// there), nudges setup, and offers "Quick draft": paste or select any text on
// any site, generate a reply in your voice, copy it.
import { storage } from '../lib/storage.js';
import { MSG } from '../lib/messages.js';
import { GOALS } from '../lib/prompt.js';
import { PLATFORMS, PLATFORM_ORDER, STATUS_LABEL, platformFromUrl } from '../lib/platforms.js';

const $ = (id) => document.getElementById(id);
let tab = null;
let platform = '';
let page = { postAuthor: '', postUrl: '' };
let lastMax = 0;

init();

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  platform = platformFromUrl(tab?.url || '');

  const [prefs, status, interest] = await Promise.all([
    storage.getPrefs(),
    chrome.runtime.sendMessage({ type: MSG.GET_STATUS }).catch(() => null),
    storage.getInterest(),
  ]);

  $('goal').innerHTML = Object.entries(GOALS).map(([id, g]) => `<option value="${id}">${esc(g.label)}</option>`).join('');
  $('goal').value = prefs.defaultGoal || 'insight';
  pressLength(platform === 'x' ? 'short' : (prefs.defaultLength || 'medium'));
  $('length').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pressLength(b.dataset.value)));

  renderSite(interest);
  renderGlyphs(interest);
  if (status && (!status.hasKey || !status.hasProfile)) renderSetup(status);

  $('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('open-history').addEventListener('click', () => openSection('history'));
  $('open-networks').addEventListener('click', (e) => { e.preventDefault(); openSection('networks'); });
  $('use-selection').addEventListener('click', () => loadSelection(true));
  $('generate').addEventListener('click', generate);
  $('copy').addEventListener('click', copyResult);
  $('source').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
  });

  await loadPageContext();
}

function openSection(section) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`src/ui/options.html#${section}`) });
}

function pressLength(v) {
  $('length').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
}

// ---- Where am I? -------------------------------------------------------------

function renderSite(interest) {
  const box = $('site');
  const p = PLATFORMS[platform];
  if (!p) {
    box.innerHTML = `
      <span class="logo">N</span>
      <div class="pp-site-name">Quick draft</div>
      <div class="pp-site-text">Works on any site: select the text you're replying to, generate, copy.</div>`;
    return;
  }
  const text = {
    live: 'Look for the <strong>Notidem</strong> button under any comment or message box.',
    beta: 'Look for the <strong>Notidem</strong> button in the reply toolbar. Beta — tell us if it breaks.',
    soon: 'The in-page button is coming soon. Quick draft below already works here.',
  }[p.status];
  const voted = interest[platform]?.count;
  box.innerHTML = `
    <span class="glyph" style="background:${p.color}">${esc(p.glyph)}</span>
    <div class="pp-site-name">${esc(p.name)} <span class="badge ${p.status}">${STATUS_LABEL[p.status]}</span></div>
    <div class="pp-site-text">${text}</div>
    ${p.status === 'soon' ? `<button class="btn btn-secondary sm" id="vote" type="button" title="Sends 1 anonymous click">${voted ? '✓ Voted — vote again' : `I want Notidem on ${esc(p.name)}`}</button>` : ''}`;
  $('vote')?.addEventListener('click', () => vote(platform));
}

function renderGlyphs(interest) {
  $('glyphs').innerHTML = PLATFORM_ORDER.map((id) => {
    const p = PLATFORMS[id];
    const voted = interest[id]?.count;
    const title = p.status === 'soon' ? `${p.name} — coming soon. Click to vote${voted ? ' (voted)' : ''}` : `${p.name} — ${STATUS_LABEL[p.status]}`;
    return `<button class="pp-glyph ${p.status}${voted ? ' voted' : ''}" data-id="${id}" title="${esc(title)}" aria-label="${esc(title)}">
      <span class="glyph" style="background:${p.color}">${esc(p.glyph)}</span><i class="tag"></i></button>`;
  }).join('');
  $('glyphs').querySelectorAll('.pp-glyph').forEach((b) => b.addEventListener('click', () => {
    if (PLATFORMS[b.dataset.id].status === 'soon') vote(b.dataset.id);
    else openSection('networks');
  }));
}

async function vote(id) {
  await chrome.runtime.sendMessage({ type: MSG.VOTE_PLATFORM, payload: { platform: id, surface: 'popup' } });
  const interest = await storage.getInterest();
  renderSite(interest);
  renderGlyphs(interest);
  toast(`Thanks! Vote for ${PLATFORMS[id].name} counted`);
}

function renderSetup(status) {
  const box = $('setup');
  const missing = [!status.hasProfile && 'a short profile', !status.hasKey && `an API key for ${status.providerLabel}`].filter(Boolean);
  box.innerHTML = `<span class="logo sm">N</span><div><strong>Finish setup:</strong> add ${missing.join(' and ')}. <button class="pp-link" id="finish" type="button">Open settings →</button></div>`;
  box.hidden = false;
  $('finish').addEventListener('click', () => openSection(status.hasProfile ? 'ai' : 'profile'));
}

// ---- Page context ---------------------------------------------------------------

async function loadPageContext() {
  if (!tab?.id || !/^https?:/.test(tab.url || '')) {
    $('use-selection').hidden = true;
    return;
  }
  // On LinkedIn / X the content script knows the post next to the comment box.
  if (platform === 'linkedin' || platform === 'x') {
    const resp = await new Promise((resolve) =>
      chrome.tabs.sendMessage(tab.id, { type: MSG.GET_PAGE_POST }, (r) => resolve(chrome.runtime.lastError ? null : r))
    );
    if (resp) {
      page = { postAuthor: resp.postAuthor || '', postUrl: resp.postUrl || '' };
      const text = resp.selected || resp.postText;
      if (text) { $('source').value = text; return; }
    }
  }
  await loadSelection(false);
}

// Read the user's current selection on the active tab (activeTab + scripting:
// granted only because the user opened this popup on that tab).
async function loadSelection(explicit) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.getSelection ? window.getSelection().toString() : ''),
    });
    const text = (res?.result || '').trim().slice(0, 2000);
    if (text) { $('source').value = text; return; }
    if (explicit) setStatus('', 'Nothing selected on the page. Highlight the text first, or paste it here.');
  } catch {
    if (explicit) setStatus('', 'This page cannot be read. Paste the text instead.');
  }
}

// ---- Generate ---------------------------------------------------------------------

async function generate() {
  const postText = $('source').value.trim();
  if (postText.length < 12) {
    setStatus('', 'Paste or select the post you are replying to first.');
    $('source').focus();
    return;
  }
  const out = $('output');
  out.hidden = false;
  out.dataset.state = 'loading';
  out.innerHTML = '<div class="pp-loading"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
  $('generate').disabled = true;
  $('copy').disabled = true;
  setStatus('', '');

  const resp = await chrome.runtime.sendMessage({
    type: MSG.GENERATE,
    payload: {
      platform: platform || 'generic',
      surface: 'popup',
      postText,
      postAuthor: page.postAuthor,
      goal: $('goal').value,
      length: $('length').querySelector('[aria-pressed="true"]')?.dataset.value,
    },
  }).catch(() => null);

  $('generate').disabled = false;
  if (!resp || !resp.ok) {
    out.dataset.state = 'error';
    out.innerHTML = '';
    const div = Object.assign(document.createElement('div'), { className: 'pp-error', textContent: resp?.error || 'Something went wrong.' });
    out.appendChild(div);
    $('status').innerHTML = '<button class="pp-link" id="to-settings" type="button">Open Settings →</button>';
    $('to-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
    return;
  }

  out.dataset.state = 'ready';
  out.innerHTML = '<textarea class="textarea" spellcheck="true" aria-label="Draft"></textarea><div class="pp-counter"></div>';
  const ta = out.querySelector('textarea');
  ta.value = resp.comment;
  lastMax = resp.maxChars || 0;
  const count = () => {
    const c = out.querySelector('.pp-counter');
    c.textContent = lastMax ? `${ta.value.length} / ${lastMax}` : `${ta.value.length} characters`;
    c.classList.toggle('over', Boolean(lastMax && ta.value.length > lastMax));
  };
  ta.addEventListener('input', count);
  count();
  $('generate').textContent = 'Regenerate';
  $('copy').hidden = false;
  $('copy').disabled = false;
  setStatus('', `${resp.providerLabel} · ${resp.language}`);
}

async function copyResult() {
  const ta = $('output').querySelector('textarea');
  if (!ta) return;
  await navigator.clipboard.writeText(ta.value);
  chrome.runtime.sendMessage({
    type: MSG.SAVE_HISTORY,
    payload: {
      comment: ta.value.trim(),
      kind: 'comment',
      platform: platform || 'generic',
      surface: 'popup',
      postAuthor: page.postAuthor || '',
      postTitle: $('source').value.trim().split('\n')[0].slice(0, 90),
      postUrl: page.postUrl || (/^https:/.test(tab?.url || '') ? tab.url : ''),
      savedAt: new Date().toISOString(),
    },
  });
  setStatus('ok', '✓ Copied & saved to history — paste it where you want it.');
}

// ---- Helpers ----------------------------------------------------------------------

function setStatus(kind, msg) {
  const el = $('status');
  el.className = `pp-status ${kind}`;
  el.textContent = msg;
}

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
