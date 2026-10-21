# Turning on anonymous analytics (GA4)

Analytics is **off** in the current build. The file `extension/src/lib/analytics-config.js` has an empty Measurement ID and API secret, so Notidem sends nothing anywhere. Votes on "Coming soon" networks are only counted locally in each user's browser.

This guide explains, step by step, how to turn it on later so you can see which network people want most.

## What gets sent once enabled

- **Votes** ("I want this" button): one event named `platform_interest` with `platform` (e.g. `instagram`) and `surface` (`popup` or `settings`). The button says it sends 1 anonymous click, so this is sent whenever analytics is configured.
- **Other events** (`install`, `update`, `panel_open`, `generate`, `generate_error`, `draft_used`): only if the user turns on **Share anonymous usage stats** in Settings. Off by default.
- Every event carries only: a random install ID, the extension version, and allow-listed values (`platform`, `mode`, `goal`, `length`, `provider`, `surface`, `status`).
- Never sent: post text, drafts, profile, URLs, names, API keys.

## Step by step

### 1. Create a GA4 property
1. Go to <https://analytics.google.com> and sign in.
2. Admin (gear icon) > **Create** > **Property**. Name it "Notidem", pick your time zone and currency.
3. When asked, choose a business size and objective (any answer is fine).

### 2. Create a web data stream
1. Admin > **Data streams** > **Add stream** > **Web**.
2. Website URL: your project site (for example `paulpessoa.github.io`). Stream name: "Notidem extension".
3. You can leave "Enhanced measurement" on or off; it does not matter for the extension.
4. Open the stream and copy the **Measurement ID**. It looks like `G-XXXXXXXXXX`.

### 3. Create a Measurement Protocol API secret
1. In the same stream screen, scroll to **Measurement Protocol API secrets** > **Create**.
2. Give it a nickname such as "extension" and create it.
3. Copy the **Secret value**.

### 4. Put the values in the code
Open `extension/src/lib/analytics-config.js` and fill in:

```js
export const ANALYTICS = {
  measurementId: 'G-XXXXXXXXXX',
  apiSecret: 'your-secret-value',
  endpoint: 'https://www.google-analytics.com/mp/collect',
};
```

Note: the secret ships inside the extension and is visible to anyone who unzips it. That is normal for Measurement Protocol. The worst case is someone sending fake events, so treat the numbers as indicative, and you can rotate the secret in GA4 at any time.

### 5. Bump the version and build
1. Raise `version` in `extension/manifest.json` (for example `2.1.0`).
2. Run `bash scripts/build.sh`.
3. Run `node scripts/smoke-test.mjs`.

### 6. Update the legal text before publishing
1. `docs/PRIVACY.md` and `docs/privacy.html`: change "disabled in this build" to say that analytics is now active (votes always; usage stats opt-in).
2. `docs/PERMISSIONS.md`: change the `connect-src` note, since the analytics host is now used.
3. Chrome Web Store dashboard > **Privacy practices**: declare the data type **User activity** (anonymous interaction events) as collected, and update the privacy policy URL if it changed. See [`STORE-LISTING.md`](STORE-LISTING.md).
4. Upload the new zip.

## Seeing the votes in GA4

1. Open your property > **Reports** > **Engagement** > **Events**.
2. Click the event **`platform_interest`**. Events can take up to 24 to 48 hours to appear in standard reports.
3. To break votes down by network, register the parameter: Admin > **Custom definitions** > **Create custom dimension**. Scope: **Event**. Dimension name: "Platform". Event parameter: `platform`. Optionally add `surface` the same way.
4. After that, build an exploration (Explore > Free form) with dimension "Platform" and metric "Event count", filtered to `platform_interest`.
5. To check things are working right now, use **Admin > DebugView** or **Reports > Realtime**.

## About the Chrome Web Store's own GA field

The Chrome Web Store developer dashboard has a field for a Google Analytics ID. That only measures visits to your **store listing page**. It cannot see clicks or usage inside the extension. The setup above is what measures in-extension events, and the two are independent.

## Turning it off again

Empty `measurementId` and `apiSecret` in `analytics-config.js`, bump the version, build, and update the privacy text.
