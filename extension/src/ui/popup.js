// src/ui/popup.js
import { storage } from '../lib/storage.js';
import { MSG } from '../lib/messages.js';
import { PROVIDERS, PROVIDER_ORDER } from '../providers/registry.js';

let context = { postText: '', postAuthor: '', postUrl: '' };

const els = {
  context: document.getElementById('context'),
  provider: document.getElementById('provider'),
  output: document.getElementById('output'),
  generate: document.getElementById('generate'),
  regenerate: document.getElementById('regenerate'),
  copy: document.getElementById('copy'),
  status: document.getElementById('status'),
};

// ---- Init -------------------------------------------------------------------

init();

async function init() {
  // Provider dropdown
  els.provider.innerHTML = PROVIDER_ORDER.map(
    (id) => `<option value="${id}">${PROVIDERS[id].emoji} ${PROVIDERS[id].label}</option>`
  ).join('');

  const prefs = await storage.getPrefs();
  els.provider.value = prefs.provider || 'groq';

  // Persist provider choice when changed in the popup
  els.provider.addEventListener('change', () => storage.setPrefs({ provider: els.provider.value }));

  document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.generate.addEventListener('click', generate);
  els.regenerate.addEventListener('click', generate);
  els.copy.addEventListener('click', copyResult);

  await loadContext();
}

// ---- Get the current post from the active tab's content script --------------

async function loadContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes('linkedin.com')) {
    els.context.innerHTML = '<span class="pp-context-label">Open a LinkedIn page to start.</span>';
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: MSG.GET_PAGE_POST }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      els.context.innerHTML = '<span class="pp-context-label">Scroll to a post or open one, then reopen this popup.</span>';
      return;
    }
    context = resp;
    if (context.postText) {
      const author = context.postAuthor ? `<span class="pp-context-author">${esc(context.postAuthor)}</span> · ` : '';
      els.context.innerHTML = `${author}${esc(context.postText.slice(0, 180))}${context.postText.length > 180 ? '…' : ''}`;
    } else {
      els.context.innerHTML = '<span class="pp-context-label">No post text detected. Open a specific post for best results.</span>';
    }
  });
}

// ---- Generate ---------------------------------------------------------------

async function generate() {
  if (!context.postText) {
    setStatus('warn', 'No post detected. Open a LinkedIn post first.');
    return;
  }

  setLoading(true);

  // Make sure background uses the provider currently chosen in the popup.
  await storage.setPrefs({ provider: els.provider.value });

  chrome.runtime.sendMessage(
    { type: MSG.GENERATE, payload: { postText: context.postText, postAuthor: context.postAuthor } },
    (resp) => {
      setLoading(false);

      if (!resp || !resp.ok) {
        showError(resp?.error || 'Something went wrong.');
        setStatus('warn', '');
        els.status.innerHTML = '<button class="pp-link" id="to-settings">Open Settings →</button>';
        document.getElementById('to-settings')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
        return;
      }

      showResult(resp.comment);
      setStatus('', `${cap(resp.provider)} · ${resp.language}`);
    }
  );
}

async function copyResult() {
  const ta = els.output.querySelector('.pp-textarea');
  if (!ta) return;
  await navigator.clipboard.writeText(ta.value);

  // Save to history when copied from the popup too.
  chrome.runtime.sendMessage({
    type: MSG.SAVE_HISTORY,
    payload: {
      comment: ta.value.trim(),
      postAuthor: context.postAuthor || '',
      postTitle: (context.postText || '').split('\n')[0].slice(0, 90),
      postUrl: context.postUrl || '',
      savedAt: new Date().toISOString(),
    },
  });

  setStatus('ok', '✓ Copied & saved to history');
}

// ---- UI helpers -------------------------------------------------------------

function setLoading(on) {
  els.generate.disabled = on;
  els.regenerate.disabled = on;
  els.copy.disabled = on;
  if (on) {
    els.output.dataset.state = 'loading';
    els.output.innerHTML = '<div class="pp-loading"><span class="spinner"></span> Drafting your comment…</div>';
    els.status.textContent = '';
  } else {
    els.generate.disabled = false;
  }
}

function showResult(text) {
  els.output.dataset.state = 'ready';
  els.output.innerHTML = `<textarea class="pp-textarea" spellcheck="true">${esc(text)}</textarea>`;
  els.regenerate.disabled = false;
  els.copy.disabled = false;
}

function showError(msg) {
  els.output.dataset.state = 'error';
  els.output.innerHTML = `<div class="pp-error">${esc(msg)}</div>`;
}

function setStatus(kind, msg) {
  els.status.className = `pp-status ${kind}`;
  els.status.textContent = msg;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }
