// src/lib/storage.js
// Thin, typed wrapper around chrome.storage.local.
// Keeps all storage keys and shapes in one place.
//
// SECURITY: API keys are encrypted at rest (AES-GCM) via lib/crypto.js and are
// stored ONLY in chrome.storage.local — never chrome.storage.sync — so they are
// never uploaded to Google's sync servers. See lib/crypto.js for the honest
// threat model (defense in depth, not a vault).

import { encryptString, decryptString } from './crypto.js';

const KEYS = {
  PROFILE: 'profile',     // see PROFILE_DEFAULT below (v2 shape)
  KEYS: 'apiKeys',        // { groq, openai, gemini, claude } — values encrypted
  PREFS: 'prefs',         // { provider, language, defaultGoal, defaultLength, shareUsage }
  HISTORY: 'history',     // [{ id, comment, kind, platform, postAuthor, postTitle, postUrl, savedAt }]
  INTEREST: 'interest',   // { [platformId]: { count, lastAt } } — "coming soon" votes
  CLIENT_ID: 'clientId',  // random id for anonymous analytics (only used if enabled)
};

const PROVIDER_IDS = ['groq', 'openai', 'gemini', 'claude'];

// Limits keep the context useful and well within chrome.storage.local's quota.
export const LIMITS = {
  FILES: 8,
  FILE_CHARS: 40000,
  LINKS: 12,
};

// v2 profile. Every field is optional; composeProfile() in prompt.js decides
// what actually goes into a prompt and in which order.
const PROFILE_DEFAULT = {
  version: 2,
  name: '',
  headline: '',     // "Senior frontend engineer at Acme"
  bio: '',          // free-form "About"
  expertise: [],    // ['React', 'Design systems']
  goals: [],        // preset ids, see GOAL_PRESETS in prompt.js
  goalsNote: '',    // free text, e.g. "looking for remote roles in Europe"
  tone: '',         // free-form voice description
  toneTags: [],     // preset ids, see TONE_PRESETS in prompt.js
  avoid: '',        // words/phrases to never use
  samples: '',      // 1-3 things the user actually wrote, to mimic style
  emoji: 'match',   // 'never' | 'match' | 'sometimes'
  links: [],        // [{ id, label, url, note }]
  files: [],        // [{ id, name, kind, text, enabled, addedAt }]
};

const DEFAULTS = {
  [KEYS.PROFILE]: PROFILE_DEFAULT,
  [KEYS.KEYS]: { groq: '', openai: '', gemini: '', claude: '' },
  [KEYS.PREFS]: {
    provider: 'groq',
    language: 'English',
    defaultGoal: 'insight',
    defaultLength: 'medium',
    shareUsage: false,
  },
  [KEYS.HISTORY]: [],
  [KEYS.INTEREST]: {},
  [KEYS.CLIENT_ID]: '',
};

const HISTORY_LIMIT = 200;

// Read the raw stored value and fall back to the default ourselves: passing an
// object of defaults to chrome.storage.get can merge them into the stored
// object, which would hide a v1 profile from migrateProfile().
function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (data) => {
      const v = data[key];
      resolve(v === undefined ? structuredClone(DEFAULTS[key]) : v);
    });
  });
}

function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Profile ----------------------------------------------------------------

// v1 stored { manualText, tone, pdfText, pdfName }. Convert it once, in place,
// so users upgrading from 1.x keep everything they had typed and uploaded.
export function migrateProfile(raw) {
  if (!raw || typeof raw !== 'object') return { ...PROFILE_DEFAULT };
  if (raw.version === 2) return { ...PROFILE_DEFAULT, ...raw };
  const out = { ...PROFILE_DEFAULT };
  out.bio = (raw.manualText || '').trim();
  out.tone = (raw.tone || '').trim();
  if (raw.pdfText && raw.pdfText.trim()) {
    out.files = [{
      id: uid(),
      name: raw.pdfName || 'resume.pdf',
      kind: 'resume',
      text: raw.pdfText.trim().slice(0, LIMITS.FILE_CHARS),
      enabled: true,
      addedAt: new Date().toISOString(),
    }];
  }
  return out;
}

async function getProfile() {
  const raw = await get(KEYS.PROFILE);
  const profile = migrateProfile(raw);
  if (raw && raw.version !== 2 && (raw.manualText || raw.pdfText || raw.tone)) {
    await set(KEYS.PROFILE, profile);
  }
  return profile;
}

async function setProfile(patch) {
  const current = await getProfile();
  const next = { ...current, ...patch, version: 2 };
  await set(KEYS.PROFILE, next);
  return next;
}

// ---- API keys ---------------------------------------------------------------
// Encrypted at rest. We decrypt on read and encrypt on write so the rest of the
// app keeps using plain { provider: key } objects transparently.

async function getApiKeys() {
  const stored = await get(KEYS.KEYS);
  const out = {};
  for (const id of PROVIDER_IDS) {
    out[id] = stored[id] ? await decryptString(stored[id]) : '';
  }
  return out;
}

async function setApiKeys(keys) {
  const enc = {};
  for (const id of PROVIDER_IDS) {
    const v = (keys[id] || '').trim();
    enc[id] = v ? await encryptString(v) : '';
  }
  return set(KEYS.KEYS, enc);
}

// Remove ONLY the stored API keys (and leave profile/prefs/history intact).
async function clearApiKeys() {
  return set(KEYS.KEYS, { groq: '', openai: '', gemini: '', claude: '' });
}

// ---- Prefs ------------------------------------------------------------------

async function getPrefs() {
  return { ...DEFAULTS[KEYS.PREFS], ...(await get(KEYS.PREFS)) };
}
async function setPrefs(patch) {
  const current = await getPrefs();
  return set(KEYS.PREFS, { ...current, ...patch });
}

// ---- History ----------------------------------------------------------------

async function getHistory() { return get(KEYS.HISTORY); }

async function addHistoryEntry(entry) {
  const history = await getHistory();
  const withId = { platform: 'linkedin', ...entry, id: Date.now() };
  const next = [withId, ...history].slice(0, HISTORY_LIMIT);
  await set(KEYS.HISTORY, next);
  return withId;
}

async function removeHistoryEntry(id) {
  const history = await getHistory();
  return set(KEYS.HISTORY, history.filter((e) => e.id !== id));
}

async function clearHistory() { return set(KEYS.HISTORY, []); }

// ---- "Coming soon" interest votes ------------------------------------------

async function getInterest() { return get(KEYS.INTEREST); }

async function recordInterest(platformId) {
  const all = await getInterest();
  const prev = all[platformId] || { count: 0, lastAt: '' };
  all[platformId] = { count: prev.count + 1, lastAt: new Date().toISOString() };
  await set(KEYS.INTEREST, all);
  return all[platformId];
}

// ---- Anonymous client id ----------------------------------------------------

async function getClientId() {
  let id = await get(KEYS.CLIENT_ID);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : uid();
    await set(KEYS.CLIENT_ID, id);
  }
  return id;
}

// Clears everything, including the encryption key material, so no recoverable
// trace of the API keys remains.
async function clearAll() {
  return new Promise((resolve) => chrome.storage.local.clear(resolve));
}

export const storage = {
  KEYS,
  getProfile, setProfile,
  getApiKeys, setApiKeys, clearApiKeys,
  getPrefs, setPrefs,
  getHistory, addHistoryEntry, removeHistoryEntry, clearHistory,
  getInterest, recordInterest,
  getClientId,
  clearAll,
};
