// src/lib/analytics-config.js
// Google Analytics 4 (Measurement Protocol) settings.
//
// DISABLED BY DEFAULT. While both values are empty, Notidem sends nothing
// anywhere: votes and usage are only counted locally (see Settings > Platforms).
//
// To turn it on (step by step in docs/ANALYTICS.md):
//   1. GA4 > Admin > Data streams > (your stream) > copy the Measurement ID (G-XXXXXXX).
//   2. Same screen > Measurement Protocol API secrets > Create > copy the secret.
//   3. Paste both below, bump the version in manifest.json, run scripts/build.sh.
//   4. Update the privacy policy and the Chrome Web Store "Privacy practices" form.

export const ANALYTICS = {
  measurementId: '',
  apiSecret: '',
  endpoint: 'https://www.google-analytics.com/mp/collect',
};

export function analyticsConfigured() {
  return Boolean(ANALYTICS.measurementId && ANALYTICS.apiSecret);
}
