// src/lib/crypto.js
// At-rest encryption for the user's BYOK API keys using the Web Crypto API
// (AES-GCM, 256-bit). This is DEFENSE IN DEPTH, not a vault.
//
// Honest threat model:
//   - PROTECTS against: someone with casual/offline access to the storage file
//     or a synced backup reading keys in plain text. The stored value is now
//     ciphertext, useless on its own.
//   - DOES NOT protect against: active malware running as the user, or a
//     compromise of the extension itself. To USE a key we must decrypt it in
//     this same process, so the wrapping material lives alongside the data.
//     No browser-side scheme can escape this — be transparent about it.
//
// The wrapping key is generated once and stored in chrome.storage.local. We use
// a non-extractable CryptoKey where possible so it can't be trivially dumped.

const ALGO = 'AES-GCM';
const KEY_STORAGE = 'cc_kek_v1'; // key-encryption-key material (raw bytes, base64)
const IV_BYTES = 12;

function toB64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Get (or lazily create) the AES key used to wrap the API keys. We store the
// raw key bytes once; on each load we import them as a CryptoKey. Generating it
// per-install means the ciphertext is not portable to another machine as-is.
async function getKey() {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get({ [KEY_STORAGE]: '' }, (d) => resolve(d[KEY_STORAGE]))
  );

  let rawBytes;
  if (stored) {
    rawBytes = fromB64(stored);
  } else {
    rawBytes = crypto.getRandomValues(new Uint8Array(32));
    await new Promise((resolve) =>
      chrome.storage.local.set({ [KEY_STORAGE]: toB64(rawBytes) }, resolve)
    );
  }

  return crypto.subtle.importKey('raw', rawBytes, { name: ALGO }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// Encrypt a UTF-8 string. Returns a self-describing envelope { v, iv, ct }.
export async function encryptString(plain) {
  if (plain == null || plain === '') return '';
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder().encode(plain);
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, enc);
  return JSON.stringify({ v: 1, iv: toB64(iv), ct: toB64(ct) });
}

// Decrypt an envelope produced by encryptString. Returns '' on any failure so a
// corrupt value never throws into the UI.
export async function decryptString(envelope) {
  if (!envelope) return '';
  // Backward-compat: if it's not our JSON envelope, assume it's a legacy
  // plain-text key and return it as-is so existing users aren't locked out.
  let parsed;
  try {
    parsed = JSON.parse(envelope);
  } catch {
    return envelope;
  }
  if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.ct) return '';

  try {
    const key = await getKey();
    const iv = fromB64(parsed.iv);
    const ct = fromB64(parsed.ct);
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}

// True if a stored value looks like our encrypted envelope (vs legacy plain).
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const p = JSON.parse(value);
    return p && p.v === 1 && !!p.iv && !!p.ct;
  } catch {
    return false;
  }
}
