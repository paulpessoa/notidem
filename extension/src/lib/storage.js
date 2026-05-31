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
  PROFILE: 'profile',     // { manualText, tone, pdfText, pdfName }
  KEYS: 'apiKeys',        // { groq, openai, gemini, claude } — values encrypted
  PREFS: 'prefs',         // { provider, language }
  HISTORY: 'history',     // [{ id, comment, postAuthor, postTitle, postUrl, provider, savedAt }]
};

const PROVIDER_IDS = ['groq', 'openai', 'gemini', 'claude'];

const DEFAULTS = {
  [KEYS.PROFILE]: { manualText: '', tone: '', pdfText: '', pdfName: '' },
  [KEYS.KEYS]: { groq: '', openai: '', gemini: '', claude: '' },
  [KEYS.PREFS]: { provider: 'groq', language: 'English', defaultGoal: 'insight', defaultLength: 'medium' },
  [KEYS.HISTORY]: [],
};

const HISTORY_LIMIT = 100;

function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: DEFAULTS[key] }, (data) => resolve(data[key]));
  });
}

function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function getProfile() { return get(KEYS.PROFILE); }
async function setProfile(patch) {
  const current = await getProfile();
  return set(KEYS.PROFILE, { ...current, ...patch });
}

// API keys: encrypted at rest. We decrypt on read and encrypt on write so the
// rest of the app keeps using plain { provider: key } objects transparently.
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

async function getPrefs() { return get(KEYS.PREFS); }
async function setPrefs(patch) {
  const current = await getPrefs();
  return set(KEYS.PREFS, { ...current, ...patch });
}

async function getHistory() { return get(KEYS.HISTORY); }

async function addHistoryEntry(entry) {
  const history = await getHistory();
  const withId = { ...entry, id: Date.now() };
  const next = [withId, ...history].slice(0, HISTORY_LIMIT);
  await set(KEYS.HISTORY, next);
  return withId;
}

async function removeHistoryEntry(id) {
  const history = await getHistory();
  return set(KEYS.HISTORY, history.filter((e) => e.id !== id));
}

async function clearHistory() { return set(KEYS.HISTORY, []); }

// Clears everything, including the encryption key material, so no recoverable
// trace of the API keys remains.
async function clearAll() {
  return new Promise((resolve) => chrome.storage.local.clear(resolve));
}

// Remove ONLY the stored API keys (and leave profile/prefs/history intact).
// Useful for a "forget my keys" button.
async function clearApiKeys() {
  return set(KEYS.KEYS, { groq: '', openai: '', gemini: '', claude: '' });
}

export const storage = {
  KEYS,
  getProfile, setProfile,
  getApiKeys, setApiKeys,
  getPrefs, setPrefs,
  getHistory, addHistoryEntry, removeHistoryEntry, clearHistory,
  clearApiKeys,
  clearAll,
};
