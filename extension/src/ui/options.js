// src/ui/options.js
import { storage } from '../lib/storage.js';
import { PROVIDERS, PROVIDER_ORDER } from '../providers/registry.js';

// pdfjsLib is provided globally by vendor/pdf.min.js (classic script).
const pdfjsLib = globalThis.pdfjsLib;

// ---- Tabs -------------------------------------------------------------------

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.panel').forEach((p) =>
      p.classList.toggle('is-active', p.id === `panel-${name}`)
    );
    if (name === 'history') renderHistory();
  });
});

// ---- Build keys list + provider pills from registry -------------------------

function buildKeysList() {
  const container = document.getElementById('keys-list');
  container.innerHTML = PROVIDER_ORDER.map((id) => {
    const p = PROVIDERS[id];
    return `
      <div class="keyrow">
        <div class="emoji">${p.emoji}</div>
        <div>
          <div class="pname">${p.label}</div>
          <div class="pmodel">${p.modelLabel} · <a href="${p.keyUrl}" target="_blank" rel="noopener">get key ↗</a></div>
        </div>
        <div class="keyfield">
          <input type="password" id="key-${id}" placeholder="${p.keyPlaceholder}" autocomplete="off" spellcheck="false" />
          <button class="eye" data-target="key-${id}" type="button" aria-label="Show key">👁</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
  });
}

function buildProviderPills(selected) {
  const wrap = document.getElementById('provider-pills');
  wrap.innerHTML = PROVIDER_ORDER.map((id) => {
    const p = PROVIDERS[id];
    return `<div class="opt-pill${id === selected ? ' on' : ''}" data-value="${id}">${p.emoji} ${p.label}</div>`;
  }).join('');
  wrap.querySelectorAll('.opt-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      wrap.querySelectorAll('.opt-pill').forEach((x) => x.classList.toggle('on', x === pill));
    });
  });
}

function selectedProvider() {
  return document.querySelector('.opt-pill.on')?.dataset.value || 'groq';
}

// ---- Load existing data -----------------------------------------------------

async function hydrate() {
  buildKeysList();

  const [profile, keys, prefs] = await Promise.all([
    storage.getProfile(),
    storage.getApiKeys(),
    storage.getPrefs(),
  ]);

  document.getElementById('about').value = profile.manualText || '';
  document.getElementById('tone').value = profile.tone || '';
  if (profile.pdfText) {
    const chip = document.getElementById('pdf-chip');
    chip.hidden = false;
    chip.textContent = profile.pdfName ? `✓ ${profile.pdfName}` : '✓ Resume loaded';
    setFileHint('ok', `${kchars(profile.pdfText)} of text stored`);
  }

  PROVIDER_ORDER.forEach((id) => {
    const input = document.getElementById(`key-${id}`);
    if (input) input.value = keys[id] || '';
  });

  // One-time migration: if any keys were stored in plain text by an older
  // version, re-saving them now encrypts them at rest. getApiKeys already
  // returns plain values, and setApiKeys always encrypts, so this is safe.
  const hasAnyKey = PROVIDER_ORDER.some((id) => keys[id]);
  if (hasAnyKey) {
    const raw = await new Promise((resolve) =>
      chrome.storage.local.get({ apiKeys: {} }, (d) => resolve(d.apiKeys || {}))
    );
    const anyPlain = PROVIDER_ORDER.some((id) => {
      const v = raw[id];
      if (!v) return false;
      try { const p = JSON.parse(v); return !(p && p.v === 1); } catch { return true; }
    });
    if (anyPlain) await storage.setApiKeys(keys);
  }

  buildProviderPills(prefs.provider || 'groq');
  document.getElementById('language').value = prefs.language || 'English';
}

// ---- PDF extraction ---------------------------------------------------------

const dropzone = document.getElementById('dropzone');
const pdfInput = document.getElementById('pdf-input');

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const file = e.dataTransfer.files?.[0];
  if (file?.type === 'application/pdf') extractPdf(file);
  else setFileHint('err', 'Please drop a PDF file.');
});
pdfInput.addEventListener('change', () => {
  if (pdfInput.files?.[0]) extractPdf(pdfInput.files[0]);
});

async function extractPdf(file) {
  setFileHint('busy', 'Extracting text…');
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js');
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n';
    }
    text = text.trim().replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');

    await storage.setProfile({ pdfText: text, pdfName: file.name });
    const chip = document.getElementById('pdf-chip');
    chip.hidden = false;
    chip.textContent = `✓ ${file.name}`;
    setFileHint('ok', `${pdf.numPages} page(s) · ${kchars(text)} extracted`);
  } catch (err) {
    setFileHint('err', `Could not read PDF: ${err.message}`);
  }
}

function setFileHint(kind, msg) {
  const el = document.getElementById('pdf-status');
  el.className = `filehint ${kind}`;
  el.textContent = msg;
}
function kchars(s) {
  return `${(s.length / 1000).toFixed(1)}k chars`;
}

// ---- Save handlers ----------------------------------------------------------

document.getElementById('save-profile').addEventListener('click', async () => {
  await storage.setProfile({
    manualText: document.getElementById('about').value.trim(),
    tone: document.getElementById('tone').value.trim(),
  });
  flash('msg-profile', '✓ Profile saved');
});

document.getElementById('save-keys').addEventListener('click', async () => {
  const keys = {};
  PROVIDER_ORDER.forEach((id) => {
    keys[id] = document.getElementById(`key-${id}`).value.trim();
  });
  await storage.setApiKeys(keys);
  flash('msg-keys', '✓ Keys saved & encrypted on this device');
});

document.getElementById('forget-keys').addEventListener('click', async () => {
  if (!confirm('Remove all saved API keys from this browser? You can paste them again anytime.')) return;
  await storage.clearApiKeys();
  PROVIDER_ORDER.forEach((id) => {
    const input = document.getElementById(`key-${id}`);
    if (input) input.value = '';
  });
  flash('msg-keys', '✓ Keys removed from this device');
});

document.getElementById('save-prefs').addEventListener('click', async () => {
  await storage.setPrefs({
    provider: selectedProvider(),
    language: document.getElementById('language').value,
  });
  flash('msg-prefs', '✓ Preferences saved');
});

document.getElementById('reset-all').addEventListener('click', async () => {
  if (!confirm('Delete your profile, keys, preferences, and history? This cannot be undone.')) return;
  await storage.clearAll();
  await hydrate();
  setFileHint('ok', 'All data cleared.');
  document.getElementById('pdf-chip').hidden = true;
});

document.getElementById('why-keys').addEventListener('click', (e) => {
  e.preventDefault();
  document.querySelector('.keyrow .pmodel a')?.focus();
  flash('msg-keys', 'Each provider links to its key page →');
});

// ---- History ----------------------------------------------------------------

document.getElementById('clear-history').addEventListener('click', async () => {
  if (!confirm('Clear all saved comments?')) return;
  await storage.clearHistory();
  renderHistory();
});

async function renderHistory() {
  const list = document.getElementById('history-list');
  const count = document.getElementById('history-count');
  const items = await storage.getHistory();

  count.textContent = `${items.length} comment${items.length === 1 ? '' : 's'} saved`;

  if (!items.length) {
    list.innerHTML = `<div class="history-empty">No comments yet.<br>Use Notidem on LinkedIn and hit <strong>Insert</strong> to save your drafts here.</div>`;
    return;
  }

  list.innerHTML = items.map((it) => `
    <div class="hentry" data-id="${it.id}">
      <div class="hentry-top">
        <span class="hentry-author">${esc(it.postAuthor || 'Unknown author')}</span>
        <span class="hentry-date">${fmtDate(it.savedAt)}</span>
      </div>
      ${it.postTitle ? `<div class="hentry-title">${esc(it.postTitle)}…</div>` : ''}
      <div class="hentry-body">${esc(it.comment)}</div>
      <div class="hentry-foot">
        ${it.postUrl ? `<a class="hlink" href="${esc(it.postUrl)}" target="_blank" rel="noopener">↗ Open post</a>` : ''}
        <button class="mini copy" data-id="${it.id}">Copy</button>
        <button class="mini del" data-id="${it.id}">Remove</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = items.find((x) => String(x.id) === btn.dataset.id);
      if (!item) return;
      await navigator.clipboard.writeText(item.comment);
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1600);
    });
  });

  list.querySelectorAll('.del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await storage.removeHistoryEntry(Number(btn.dataset.id));
      renderHistory();
    });
  });
}

// ---- Utils ------------------------------------------------------------------

function flash(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  setTimeout(() => (el.textContent = ''), 2600);
}
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

hydrate();
