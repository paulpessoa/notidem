// src/lib/analytics.js
// Anonymous, privacy-first event tracking via the GA4 Measurement Protocol.
// Runs ONLY in the background worker.
//
// What is sent (when enabled): an event name, a random install id, the
// extension version and small enum parameters (platform id, goal id, ui
// surface). NEVER post text, drafts, profile data, URLs, names or API keys.
//
// When is it sent:
//   - "Coming soon" votes: the click itself is an explicit, labelled action
//     ("Vote — sends 1 anonymous click"), so it is sent whenever GA is configured.
//   - Every other event: only if the user turned on "Share anonymous usage
//     stats" in Settings (off by default).

import { ANALYTICS, analyticsConfigured } from './analytics-config.js';
import { storage } from './storage.js';

// Only these keys/values ever leave the device. Anything else is dropped.
const ALLOWED_PARAMS = ['platform', 'mode', 'goal', 'length', 'provider', 'surface', 'status'];

function sanitize(params) {
  const out = {};
  for (const k of ALLOWED_PARAMS) {
    const v = params?.[k];
    if (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v)) out[k] = v;
  }
  return out;
}

export async function track(name, params = {}, { explicit = false } = {}) {
  try {
    if (!analyticsConfigured()) return { sent: false, reason: 'not_configured' };
    if (!explicit) {
      const prefs = await storage.getPrefs();
      if (!prefs.shareUsage) return { sent: false, reason: 'opted_out' };
    }
    const clientId = await storage.getClientId();
    const url = `${ANALYTICS.endpoint}?measurement_id=${encodeURIComponent(ANALYTICS.measurementId)}&api_secret=${encodeURIComponent(ANALYTICS.apiSecret)}`;
    const body = {
      client_id: clientId,
      non_personalized_ads: true,
      events: [{
        name: String(name).replace(/[^a-z0-9_]/gi, '_').slice(0, 40),
        params: {
          ...sanitize(params),
          version: chrome.runtime.getManifest().version,
          engagement_time_msec: 1,
        },
      }],
    };
    // no-cors: we never need to read the response, so no host permission is required.
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(body) });
    return { sent: true };
  } catch {
    return { sent: false, reason: 'network' };
  }
}

export { analyticsConfigured };
