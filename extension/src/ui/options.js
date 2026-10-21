// src/ui/options.js
import { storage, LIMITS, uid } from '../lib/storage.js';
import { PROVIDERS, PROVIDER_ORDER } from '../providers/registry.js';
import { PLATFORMS, PLATFORM_ORDER, STATUS_LABEL } from '../lib/platforms.js';
import { composeProfile, GOALS, GOAL_PRESETS, TONE_PRESETS } from '../lib/prompt.js';
import { MSG } from '../lib/messages.js';
import { analyticsConfigured } from '../lib/analytics-config.js';

// pdfjsLib is provided globally by vendor/pdf.min.js (classic script).
const pdfjsLib = globalThis.pdfjsLib;
const $ = (id) => document.getElementById(id);

let profile = null;
let prefs = null;

// ---- Routing (hash = section) ---------------------------------------------

const SECTIONS = ['profile', 'context', 'voice', 'ai', 'networks', 'history', 'settings'];

function route() {
  const name = SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'profile';
  document.querySelectorAll('.navtabs a').forEach((a) => {
    const on = a.dataset.section === name;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('.section').forEach((s) => s.classList.toggle('is-active', s.dataset.section === name));
  if (name === 'history') renderHistory();
  if (name === 'networks') renderPlatforms();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

// ---- Autosave ----------------------------------------------------------------

let saveTimer = null;
function saveProfile(patch, { quiet = false } = {}) {
  Object.assign(profile, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    profile = await storage.setProfile(profile);
    if (!quiet) toast('Saved');
  }, 450);
  refreshDerived();
}

async function savePrefs(patch) {
  Object.assign(prefs, patch);
  await storage.setPrefs(patch);
  toast('Saved');
  refreshDerived();
}

// ---- Profile: simple fields ------------------------------------------------

function bindFields() {
  document.querySelectorAll('[data-field]').forEach((el) => {
    const key = el.dataset.field;
    el.value = profile[key] || '';
    el.addEventListener('input', () => {
      saveProfile({ [key]: el.value });
      updateCounter(el);
    });
    updateCounter(el);
  });
}

function updateCounter(el) {
  const c = document.querySelector(`.counter[data-for="${el.id}"]`);
  if (c) c.textContent = `${el.value.length} / ${el.maxLength}`;
}

// ---- Expertise tags --------------------------------------------------------

function renderExpertise() {
  const box = $('expertise-chips');
  box.innerHTML = (profile.expertise || []).map((t, i) =>
    `<button type="button" class="chip" data-i="${i}" title="Remove">${esc(t)} <span class="x">✕</span></button>`
  ).join('');
  box.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    const next = [...profile.expertise];
    next.splice(Number(chip.dataset.i), 1);
    saveProfile({ expertise: next });
    renderExpertise();
  }));
}

$('expertise-input').addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && !e.target.value && profile.expertise.length) {
    saveProfile({ expertise: profile.expertise.slice(0, -1) });
    renderExpertise();
    return;
  }
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  addTags(e.target.value);
  e.target.value = '';
});
$('expertise-input').addEventListener('blur', (e) => { addTags(e.target.value); e.target.value = ''; });
$('expertise-box').addEventListener('click', () => $('expertise-input').focus());

function addTags(raw) {
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return;
  const set = new Map((profile.expertise || []).map((t) => [t.toLowerCase(), t]));
  items.forEach((t) => { if (!set.has(t.toLowerCase())) set.set(t.toLowerCase(), t.slice(0, 40)); });
  saveProfile({ expertise: [...set.values()].slice(0, 15) });
  renderExpertise();
}

// ---- Multi-select chips (goals, tone) ---------------------------------------

function renderToggleChips(containerId, presets, field) {
  const box = $(containerId);
  const selected = new Set(profile[field] || []);
  box.innerHTML = Object.entries(presets).map(([id, label]) =>
    `<button type="button" class="chip" data-id="${id}" aria-pressed="${selected.has(id)}">${esc(label)}</button>`
  ).join('');
  box.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(on));
    const next = [...box.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.id);
    saveProfile({ [field]: next });
  }));
}

function bindEmoji() {
  const seg = $('emoji-seg');
  const set = (v) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  set(profile.emoji || 'match');
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    set(b.dataset.value);
    saveProfile({ emoji: b.dataset.value });
  }));
}

// ---- Context files -----------------------------------------------------------

const dropzone = $('dropzone');
const fileInput = $('file-input');
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  addFiles([...(e.dataTransfer.files || [])]);
});
fileInput.addEventListener('change', () => { addFiles([...(fileInput.files || [])]); fileInput.value = ''; });

async function addFiles(list) {
  for (const file of list) {
    if ((profile.files || []).length >= LIMITS.FILES) {
      setFileHint('err', `You can keep up to ${LIMITS.FILES} files. Remove one first.`);
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isText = /^text\//.test(file.type) || /\.(txt|md|markdown)$/i.test(file.name);
    if (!isPdf && !isText) { setFileHint('err', `${file.name}: only PDF, TXT or Markdown files.`); continue; }
    setFileHint('busy', `Reading ${file.name}…`);
    try {
      let text = isPdf ? await extractPdf(file) : await file.text();
      text = text.trim().replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
      if (!text) throw new Error('no text found (is it a scanned image?)');
      const truncated = text.length > LIMITS.FILE_CHARS;
      const entry = {
        id: uid(),
        name: file.name,
        kind: guessKind(file.name, text),
        text: text.slice(0, LIMITS.FILE_CHARS),
        enabled: true,
        addedAt: new Date().toISOString(),
      };
      profile.files = [...(profile.files || []), entry];
      profile = await storage.setProfile(profile);
      setFileHint('ok', `✓ ${file.name} · ${kchars(entry.text)} extracted${truncated ? ' (trimmed)' : ''}`);
    } catch (err) {
      setFileHint('err', `Could not read ${file.name}: ${err.message}`);
    }
  }
  renderFiles();
  refreshDerived();
}

async function extractPdf(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js');
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return text;
}

function guessKind(name, text) {
  const s = (name + ' ' + text.slice(0, 400)).toLowerCase();
  if (/resume|résumé|curr[ií]cul|\bcv\b|experience|experiência/.test(s)) return 'resume';
  if (/portfolio|portfólio|case stud|projects?/.test(s)) return 'portfolio';
  return 'notes';
}

function renderFiles() {
  const files = profile.files || [];
  $('files-count').textContent = files.length ? `${files.length} / ${LIMITS.FILES}` : '';
  const list = $('files-list');
  if (!files.length) { list.innerHTML = ''; return; }
  list.innerHTML = files.map((f) => {
    const ext = (f.name.split('.').pop() || 'txt').slice(0, 4);
    return `
    <li class="file${f.enabled ? '' : ' off'}" data-id="${f.id}">
      <div class="file-icon ${ext === 'pdf' ? 'pdf' : ''}">${esc(ext)}</div>
      <div>
        <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="file-meta">
          <select data-act="kind" aria-label="File type">
            ${[['resume', 'Résumé / CV'], ['portfolio', 'Portfolio'], ['notes', 'Notes about me'], ['other', 'Reference']].map(([v, l]) =>
              `<option value="${v}"${f.kind === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          <span>${kchars(f.text)}</span>
          <button class="btn btn-tertiary sm" data-act="preview" type="button">Preview</button>
        </div>
      </div>
      <div class="file-actions">
        <label class="switch" title="Use in prompts"><input type="checkbox" data-act="toggle"${f.enabled ? ' checked' : ''} /><span></span></label>
        <button class="btn btn-tertiary sm" data-act="remove" type="button" aria-label="Remove ${esc(f.name)}">Remove</button>
      </div>
    </li>`;
  }).join('');

  list.querySelectorAll('.file').forEach((row) => {
    const id = row.dataset.id;
    const update = (patch) => {
      profile.files = profile.files.map((f) => (f.id === id ? { ...f, ...patch } : f));
      saveProfile({ files: profile.files });
    };
    row.querySelector('[data-act="kind"]').addEventListener('change', (e) => update({ kind: e.target.value }));
    row.querySelector('[data-act="toggle"]').addEventListener('change', (e) => {
      update({ enabled: e.target.checked });
      row.classList.toggle('off', !e.target.checked);
    });
    row.querySelector('[data-act="remove"]').addEventListener('click', () => {
      saveProfile({ files: profile.files.filter((f) => f.id !== id) });
      renderFiles();
    });
    row.querySelector('[data-act="preview"]').addEventListener('click', (e) => {
      const open = row.querySelector('.file-preview');
      if (open) { open.remove(); e.target.textContent = 'Preview'; return; }
      const pre = document.createElement('div');
      pre.className = 'file-preview';
      pre.textContent = profile.files.find((f) => f.id === id)?.text.slice(0, 3000) || '';
      row.appendChild(pre);
      e.target.textContent = 'Hide';
    });
  });
}

function setFileHint(kind, msg) {
  const el = $('file-status');
  el.className = `filehint ${kind}`;
  el.textContent = msg;
}

// ---- Links -------------------------------------------------------------------

$('add-link').addEventListener('click', () => {
  if ((profile.links || []).length >= LIMITS.LINKS) return toast(`Up to ${LIMITS.LINKS} links`, true);
  profile.links = [...(profile.links || []), { id: uid(), label: '', url: '', note: '' }];
  renderLinks();
  $('links-list').querySelector('.link-row:last-child input')?.focus();
});

function renderLinks() {
  const links = profile.links || [];
  const box = $('links-list');
  if (!links.length) {
    box.innerHTML = '<div class="empty">No links yet. Add your website, GitHub, a project or an article.</div>';
    return;
  }
  box.innerHTML = links.map((l) => `
    <div class="link-row" data-id="${l.id}">
      <input class="input" data-k="label" maxlength="60" placeholder="Label (e.g. Notidem — open-source extension)" value="${esc(l.label)}" />
      <input class="input url" data-k="url" type="url" maxlength="300" placeholder="https://…" value="${esc(l.url)}" />
      <button class="btn btn-tertiary sm" data-k="remove" type="button" aria-label="Remove link">✕</button>
      <input class="input note" data-k="note" maxlength="200" placeholder="Why it matters (optional) — e.g. 4k users, built with React" value="${esc(l.note)}" />
    </div>`).join('');
  box.querySelectorAll('.link-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
      profile.links = profile.links.map((l) => (l.id === id ? { ...l, [input.dataset.k]: input.value.trim() } : l));
      saveProfile({ links: profile.links });
    }));
    row.querySelector('[data-k="remove"]').addEventListener('click', () => {
      saveProfile({ links: profile.links.filter((l) => l.id !== id) });
      renderLinks();
    });
  });
}

// ---- AI providers ------------------------------------------------------------

function renderProviders(keys) {
  const box = $('providers');
  box.innerHTML = PROVIDER_ORDER.map((id) => {
    const p = PROVIDERS[id];
    const isDefault = prefs.provider === id;
    return `
      <div class="provider${isDefault ? ' is-default' : ''}" data-id="${id}">
        <input type="radio" name="provider" value="${id}" id="prov-${id}"${isDefault ? ' checked' : ''} aria-label="Use ${p.label} by default" />
        <div class="provider-top">
          <label class="provider-name" for="prov-${id}">${p.label}</label>
          <span class="provider-model">${p.modelLabel}</span>
          ${isDefault ? '<span class="badge live">Default</span>' : ''}
          <span class="badge ${keys[id] ? 'info' : 'soon'}" data-keybadge>${keys[id] ? 'Key saved' : 'No key'}</span>
        </div>
        <div class="provider-key">
          <input class="input" type="password" id="key-${id}" placeholder="${p.keyPlaceholder}" autocomplete="off" spellcheck="false" value="${esc(keys[id] || '')}" />
          <button class="btn btn-tertiary sm eye" type="button" data-target="key-${id}">Show</button>
          <a class="btn btn-tertiary sm" href="${p.keyUrl}" target="_blank" rel="noopener">Get key ↗</a>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener('change', async () => {
    await savePrefs({ provider: r.value });
    renderProviders(await currentKeyInputs());
  }));
  box.querySelectorAll('.eye').forEach((btn) => btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  }));
}

async function currentKeyInputs() {
  const keys = {};
  PROVIDER_ORDER.forEach((id) => { keys[id] = $(`key-${id}`)?.value.trim() || ''; });
  return keys;
}

$('save-keys').addEventListener('click', async () => {
  const keys = await currentKeyInputs();
  await storage.setApiKeys(keys);
  // If the default provider has no key but another one does, switch to it.
  if (!keys[prefs.provider]) {
    const firstWithKey = PROVIDER_ORDER.find((id) => keys[id]);
    if (firstWithKey) {
      prefs.provider = firstWithKey;
      await storage.setPrefs({ provider: firstWithKey });
    }
  }
  renderProviders(keys);
  toast('Keys saved & encrypted on this device');
  refreshDerived();
});

$('forget-keys').addEventListener('click', async () => {
  if (!confirm('Remove all saved API keys from this browser? You can paste them again anytime.')) return;
  await storage.clearApiKeys();
  renderProviders({});
  toast('Keys removed from this device');
  refreshDerived();
});

// ---- Platforms + votes --------------------------------------------------------

async function renderPlatforms() {
  const interest = await storage.getInterest();
  const box = $('platforms');
  box.innerHTML = PLATFORM_ORDER.map((id) => {
    const p = PLATFORMS[id];
    const votes = interest[id]?.count || 0;
    const foot = p.status === 'soon'
      ? `<button class="btn btn-secondary sm vote" type="button" data-id="${id}" title="Sends 1 anonymous click">${votes ? 'Vote again' : 'I want this'}</button>
         ${votes ? `<span class="voted">✓ You voted${votes > 1 ? ` ×${votes}` : ''}</span>` : ''}`
      : `<span class="muted small">${p.status === 'beta' ? 'Works today — layout may change.' : 'Fully supported.'}</span>`;
    return `
      <div class="platform">
        <span class="glyph" style="background:${p.color}">${esc(p.glyph)}</span>
        <div>
          <div class="platform-name">${esc(p.name)}</div>
          <span class="badge ${p.status}">${STATUS_LABEL[p.status]}</span>
        </div>
        <div class="platform-blurb">${esc(p.blurb)}</div>
        <div class="platform-foot">${foot}</div>
      </div>`;
  }).join('');
  box.querySelectorAll('.vote').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    await chrome.runtime.sendMessage({ type: MSG.VOTE_PLATFORM, payload: { platform: btn.dataset.id, surface: 'options' } });
    toast(`Thanks! Vote for ${PLATFORMS[btn.dataset.id].name} counted`);
    renderPlatforms();
  }));
  $('vote-note').textContent = analyticsConfigured()
    ? 'A vote sends one anonymous click (network name only) so we can count interest. Nothing else is sent.'
    : 'Votes are saved in this browser. Anonymous vote counting is not enabled in this build, so nothing is sent.';
}

// ---- History -------------------------------------------------------------------

let historyFilter = 'all';
// Drafts made with Quick draft on a site that isn't a known network.
const WEB = { name: 'Web', color: '#56687a', glyph: 'N' };
$('history-search').addEventListener('input', () => renderHistory());

$('clear-history').addEventListener('click', async () => {
  if (!confirm('Clear all saved drafts?')) return;
  await storage.clearHistory();
  renderHistory();
  refreshDerived();
});

$('export-history').addEventListener('click', async () => {
  download(`notidem-history-${today()}.json`, JSON.stringify(await storage.getHistory(), null, 2));
});

async function renderHistory() {
  const all = await storage.getHistory();
  const used = [...new Set(all.map((h) => h.platform || 'linkedin'))];
  const filterBox = $('history-filter');
  filterBox.innerHTML = ['all', ...used].map((id) =>
    `<button type="button" class="chip" data-id="${id}" aria-pressed="${historyFilter === id}">${id === 'all' ? 'All' : esc((PLATFORMS[id] || WEB).name)}</button>`
  ).join('');
  filterBox.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { historyFilter = c.dataset.id; renderHistory(); }));

  const q = $('history-search').value.trim().toLowerCase();
  const items = all.filter((h) =>
    (historyFilter === 'all' || (h.platform || 'linkedin') === historyFilter) &&
    (!q || [h.comment, h.postAuthor, h.postTitle].some((s) => (s || '').toLowerCase().includes(q)))
  );
  $('history-count').textContent = `${items.length} of ${all.length} draft${all.length === 1 ? '' : 's'}`;

  const list = $('history-list');
  if (!items.length) {
    list.innerHTML = `<div class="card empty">${all.length ? 'Nothing matches your search.' : 'No drafts yet. Use Notidem on LinkedIn or X and hit <strong>Insert</strong> or <strong>Copy</strong> — drafts are saved here.'}</div>`;
    return;
  }
  list.innerHTML = items.map((it) => {
    const p = PLATFORMS[it.platform || 'linkedin'] || WEB;
    return `
    <article class="card hentry" data-id="${it.id}">
      <div class="hentry-top">
        <span class="glyph sm" style="background:${p.color}" title="${esc(p.name)}">${esc(p.glyph)}</span>
        <div class="hentry-who">
          <div class="hentry-author">${it.kind === 'message' ? 'Message to ' : 'Reply to '}${esc(it.postAuthor || 'someone')}</div>
          <div class="hentry-date">${esc(p.name)} · ${fmtDate(it.savedAt)}</div>
        </div>
      </div>
      ${it.postTitle && it.kind !== 'message' ? `<div class="hentry-title">${esc(it.postTitle)}…</div>` : ''}
      <div class="hentry-body">${esc(it.comment)}</div>
      <div class="hentry-foot">
        <button class="btn btn-tertiary sm copy" type="button">Copy</button>
        ${safeUrl(it.postUrl) ? `<a class="btn btn-tertiary sm" href="${esc(safeUrl(it.postUrl))}" target="_blank" rel="noopener">Open ↗</a>` : ''}
        <button class="btn btn-tertiary sm del" type="button">Remove</button>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('.hentry').forEach((row) => {
    const item = items.find((x) => String(x.id) === row.dataset.id);
    row.querySelector('.copy').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(item.comment);
      e.target.textContent = 'Copied!';
      setTimeout(() => (e.target.textContent = 'Copy'), 1600);
    });
    row.querySelector('.del').addEventListener('click', async () => {
      await storage.removeHistoryEntry(item.id);
      renderHistory();
      refreshDerived();
    });
  });
}

// ---- Settings ------------------------------------------------------------------

function bindSettings() {
  $('language').value = prefs.language || 'English';
  $('language').addEventListener('change', (e) => savePrefs({ language: e.target.value }));

  $('default-goal').innerHTML = Object.entries(GOALS).map(([id, g]) => `<option value="${id}">${esc(g.label)}</option>`).join('');
  $('default-goal').value = prefs.defaultGoal || 'insight';
  $('default-goal').addEventListener('change', (e) => savePrefs({ defaultGoal: e.target.value }));

  $('default-length').value = prefs.defaultLength || 'medium';
  $('default-length').addEventListener('change', (e) => savePrefs({ defaultLength: e.target.value }));

  $('share-usage').checked = Boolean(prefs.shareUsage);
  $('share-usage').addEventListener('change', (e) => savePrefs({ shareUsage: e.target.checked }));
  $('analytics-state').textContent = analyticsConfigured()
    ? ''
    : 'Analytics is not enabled in this build: nothing is sent even when this is on.';
}

$('export-profile').addEventListener('click', () => {
  const data = { app: 'notidem', type: 'profile', version: 2, exportedAt: new Date().toISOString(), profile };
  download(`notidem-profile-${today()}.json`, JSON.stringify(data, null, 2));
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'notidem' || !data.profile) throw new Error('not a Notidem profile export');
    if (!confirm('Replace your current profile, voice, links and files with this backup?')) return;
    profile = await storage.setProfile({ ...data.profile, version: 2 });
    hydrateProfileUI();
    toast('Profile imported');
  } catch (err) {
    toast(`Import failed: ${err.message}`, true);
  }
});

$('reset-all').addEventListener('click', async () => {
  if (!confirm('Delete your profile, files, keys, preferences, votes and history? This cannot be undone.')) return;
  await storage.clearAll();
  await hydrate();
  toast('All data cleared');
});

// ---- Derived UI: identity card, strength, preview ------------------------------

const STRENGTH_ITEMS = [
  { ok: (p) => p.name?.trim(), label: 'Add your name', href: '#profile', w: 10 },
  { ok: (p) => p.headline?.trim(), label: 'Add a headline', href: '#profile', w: 10 },
  { ok: (p) => (p.bio || '').trim().length >= 80, label: 'Write an About (80+ chars)', href: '#profile', w: 20 },
  { ok: (p) => (p.expertise || []).length >= 3, label: 'Add 3+ topics of expertise', href: '#profile', w: 10 },
  { ok: (p) => (p.goals || []).length || p.goalsNote?.trim(), label: 'Pick your goals', href: '#profile', w: 10 },
  { ok: (p) => (p.toneTags || []).length || p.tone?.trim(), label: 'Describe your voice', href: '#voice', w: 10 },
  { ok: (p) => p.samples?.trim(), label: 'Paste a writing sample', href: '#voice', w: 10 },
  { ok: (p) => (p.files || []).some((f) => f.enabled), label: 'Upload your résumé or a context file', href: '#context', w: 10 },
  { ok: (p) => (p.links || []).some((l) => l.url), label: 'Add a portfolio link', href: '#context', w: 10 },
];

async function refreshDerived() {
  const p = profile;
  $('id-name').textContent = p.name?.trim() || 'Your name';
  $('id-headline').textContent = p.headline?.trim() || 'Add a headline so drafts know who you are';
  $('avatar').textContent = initials(p.name) || 'N';

  const score = STRENGTH_ITEMS.reduce((s, it) => s + (it.ok(p) ? it.w : 0), 0);
  $('strength-bar').style.width = `${score}%`;
  $('strength-level').textContent = score >= 90 ? 'All-Star' : score >= 70 ? 'Advanced' : score >= 40 ? 'Intermediate' : 'Beginner';
  $('next-steps').innerHTML = STRENGTH_ITEMS.filter((it) => !it.ok(p)).slice(0, 3)
    .map((it) => `<li><a href="${it.href}">${it.label}</a></li>`).join('');

  const ctx = composeProfile(p);
  $('preview').textContent = ctx || 'Nothing yet. Fill in your profile and Notidem will show here exactly what is sent with each draft.';
  $('preview-size').textContent = ctx ? `${ctx.length.toLocaleString()} chars` : '';

  const keys = await storage.getApiKeys();
  const hasKey = Boolean(keys[prefs.provider]);
  $('side-provider').textContent = `${PROVIDERS[prefs.provider]?.label || '—'}${hasKey ? '' : ' (no key)'}`;
  $('side-language').textContent = prefs.language === 'auto' ? 'Auto' : prefs.language;
  $('side-drafts').textContent = String((await storage.getHistory()).length);

  // Red dots on the nav for what still blocks drafting.
  setDot('profile', !ctx);
  setDot('ai', !hasKey);
}

function setDot(section, on) {
  const a = document.querySelector(`.navtabs a[data-section="${section}"]`);
  const dot = a.querySelector('.dot');
  if (on && !dot) a.insertAdjacentHTML('beforeend', '<i class="dot" aria-label="Needs attention"></i>');
  if (!on && dot) dot.remove();
}

// ---- Hydrate -------------------------------------------------------------------

function hydrateProfileUI() {
  bindFieldsOnce();
  document.querySelectorAll('[data-field]').forEach((el) => { el.value = profile[el.dataset.field] || ''; updateCounter(el); });
  renderExpertise();
  renderToggleChips('goal-chips', GOAL_PRESETS, 'goals');
  renderToggleChips('tone-chips', TONE_PRESETS, 'toneTags');
  bindEmoji();
  renderFiles();
  renderLinks();
  refreshDerived();
}

let fieldsBound = false;
function bindFieldsOnce() {
  if (fieldsBound) return;
  fieldsBound = true;
  bindFields();
}

let settingsBound = false;
async function hydrate() {
  [profile, prefs] = await Promise.all([storage.getProfile(), storage.getPrefs()]);
  const keys = await storage.getApiKeys();
  hydrateProfileUI();
  renderProviders(keys);
  if (!settingsBound) { bindSettings(); settingsBound = true; }
  else {
    $('language').value = prefs.language;
    $('default-goal').value = prefs.defaultGoal;
    $('default-length').value = prefs.defaultLength;
    $('share-usage').checked = Boolean(prefs.shareUsage);
  }
  $('version').textContent = `v${chrome.runtime.getManifest().version}`;
  route();
}

// ---- Utils ---------------------------------------------------------------------

let toastTimer = null;
function toast(msg, isErr = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeUrl(u) {
  return /^https:\/\//i.test(u || '') ? u : '';
}
function initials(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
function kchars(s) {
  return `${((s || '').length / 1000).toFixed(1)}k chars`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function today() { return new Date().toISOString().slice(0, 10); }
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

hydrate();
