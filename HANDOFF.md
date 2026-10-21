# Notidem v2.0 — handoff / continuation

This file exists so the v2.0 work can be resumed by anyone (or any AI session)
if it stops midway. It is updated as the work progresses.

## Goal

Ship Notidem **v2.0.0**:

1. Full visual redesign, LinkedIn-like (system font, white cards, blue #0a66c2, pill buttons, dark mode).
2. Multi-platform: LinkedIn (live), X / Twitter (beta), and a "Coming soon" vote button for
   Instagram, Facebook, Reddit, YouTube, Threads, Bluesky and TikTok.
3. Vote clicks are counted locally and can be sent to Google Analytics 4 (Measurement Protocol)
   once a Measurement ID + API secret are configured (disabled by default).
4. Richer context: name, headline, bio, expertise, goals, voice (tone presets, phrases to avoid,
   writing samples, emoji policy), portfolio links, and multiple context files (PDF/TXT/MD).
5. A ready-to-upload zip for the Chrome Web Store.

## Branches / PRs

| Branch | Content | Base |
|---|---|---|
| `claude/extension-modern-redesign-uskpur` | Extension code v2.0 + build script + zip | `main` |
| `claude/docs-v2-release` | README, privacy, permissions, analytics guide, store listing, landing page | `claude/extension-modern-redesign-uskpur` |

Merge the code PR first, then the docs PR.

## Continuation prompt

See the "Continuation prompt" section at the bottom of `docs/RELEASE-v2.md` (docs branch), or copy this:

```
Continue the Notidem v2.0 release in paulpessoa/notidem. Read HANDOFF.md and docs/RELEASE-v2.md first.
Code lives on branch claude/extension-modern-redesign-uskpur, docs on claude/docs-v2-release.
Check `git log` on both branches to see what is done, run `bash scripts/build.sh` to rebuild the zip,
run `node scripts/smoke-test.mjs` to test the extension in headless Chromium, then finish any
unchecked item in the checklist of HANDOFF.md, commit in small focused commits and push.
```

## Checklist

- [x] lib layer: storage v2 (profile model + migration), prompt (platform-aware), platforms catalog, analytics
- [x] background worker: unified GENERATE, status, votes, tracking
- [x] content scripts: core + LinkedIn adapter + X adapter, shadow-DOM panel
- [x] options page redesign
- [x] popup redesign (quick draft works on any site)
- [x] manifest 2.0.0, build script, zip
- [x] smoke tests in headless Chromium
- [x] docs PR
