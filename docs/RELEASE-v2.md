# Notidem 2.0 release notes

## What is in 2.0

- LinkedIn-style redesign (system font, white cards, `#0a66c2`, dark mode) across popup, settings and the in-page panel (Shadow DOM, follows the host's dark theme, never posts).
- Networks: LinkedIn live (comments and messages), X / Twitter beta (replies, 280-char counter). Instagram, Facebook, Reddit, YouTube, Threads, Bluesky, TikTok are "Coming soon" with an "I want this" vote.
- Quick draft in the popup, on any site, using `activeTab` + `scripting` to read the selection only on click.
- Context: profile, up to 8 files (PDF/TXT/MD), portfolio links, "What the AI sees", strength meter. Voice editor. History search/filter/export. Profile export/import without keys.
- Gemini model is now `gemini-2.5-flash`. v1 profiles migrate automatically.
- Analytics (GA4 Measurement Protocol) built but disabled: see [`ANALYTICS.md`](ANALYTICS.md).
- New permissions: `activeTab`, `scripting`, content scripts on x.com / twitter.com. CSP `connect-src` adds google-analytics.com (unused while disabled). Removed `web_accessible_resources` and bundled fonts. Package about 448 KB.

## How to release

1. Check out the merged `main` (code PR first, then docs PR).
2. Confirm `version` in `extension/manifest.json` (2.0.0).
3. `bash scripts/build.sh` creates `dist/notidem-v2.0.0.zip` and `docs/notidem-v2.0.zip`.
4. `node scripts/smoke-test.mjs` (needs playwright; link it with `ln -s "$(npm root -g)" scripts/node_modules`).
5. Do the manual QA below.
6. In the Chrome Web Store dashboard, upload the zip and fill the listing using [`STORE-LISTING.md`](STORE-LISTING.md).
7. Tag the release on GitHub and attach the zip; the site's download button points to `docs/notidem-v2.0.zip`.

## Manual QA (do before submitting)

- [ ] LinkedIn, logged in: feed comment, reply to a comment, message reply. Button appears, draft generates, Copy and Insert work, nothing is posted.
- [ ] X, logged in: reply on a post and in a thread. Counter stops at 280.
- [ ] Quick draft on a few unrelated sites (select text, popup, generate, copy).
- [ ] Dark mode on host and in settings.
- [ ] Upgrade path: load v1 profile data, update to 2.0, profile intact.
- [ ] Each of the four AI providers returns a draft with a real key.
- [ ] "Clear all data" and profile export/import.

## Known limitations

- X changes its DOM often. Selectors for LinkedIn and X were tested only against fixtures in the smoke test, not against the live, logged-in sites. A manual check is required, and X is labelled beta for this reason.
- Networks marked "Coming soon" have no in-page button; only Quick draft works there.
- Store screenshots are from v1 and need to be redone.
- Analytics is disabled until a GA4 ID and secret are configured, so votes are only counted locally for now.

## Continuation prompt

Copy and paste this into a new AI session:

```
Continue the Notidem v2.0 release in paulpessoa/notidem.
Read HANDOFF.md and docs/RELEASE-v2.md first.
Branches: code is on claude/extension-modern-redesign-uskpur (base main);
docs are on claude/docs-v2-release (base the code branch). Merge code first, then docs.
Check `git log` on both branches to see what is done.
Rebuild with `bash scripts/build.sh` (outputs dist/notidem-v2.0.0.zip and docs/notidem-v2.0.zip)
and test with `node scripts/smoke-test.mjs` (needs playwright; link global node_modules into scripts/node_modules).
Open items:
1. Manual QA on real, logged-in LinkedIn and X (selectors were only tested against fixtures).
2. New Chrome Web Store screenshots at 1280x800 (current ones are from v1).
3. Enable GA4 when ready, following docs/ANALYTICS.md, then update the privacy docs and the store form.
4. Add in-page support for the most-voted "Coming soon" network.
Commit in small focused commits and push; do not open a PR unless asked.
```
