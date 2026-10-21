# Chrome Web Store listing (v2.0)

Ready-to-paste text for the Web Store developer dashboard.

## Name

Notidem — thoughtful replies for LinkedIn & X

## Short description (max 132 characters; same as the manifest)

The opposite of 'idem'. Draft genuine replies on LinkedIn and X in your own voice, with your context. Always reviewed by you.

## Detailed description

Most replies online are "idem", "great post!" or "totally agree". They cost nothing and mean nothing. Notidem helps you write the opposite: specific, thoughtful replies in your own voice, using your own context.

Notidem is a drafting assistant, not an automation tool. It never posts, sends or acts for you. You read every draft, edit it, and send it yourself.

WHAT YOU CAN DO
- LinkedIn: draft comments on posts and replies in messages.
- X / Twitter (beta): draft replies, with a 280-character counter.
- Any website: select text, open the Notidem popup and use Quick draft.
- Choose a goal for each reply: add an insight, share an experience, ask a question, agree and build on it, or respectfully disagree.
- Copy the draft or insert it into the reply box, then review and send it yourself. Ctrl/Cmd+Enter to generate.

YOUR CONTEXT, YOUR VOICE
- Profile: name, headline, about, expertise, goals.
- Context files (PDF, TXT, MD; up to 8, each can be switched on or off) and portfolio links.
- Voice: tone presets, style notes, phrases to avoid, emoji policy, writing samples.
- "What the AI sees" shows exactly which context is sent with each request.

BRING YOUR OWN KEY
- Works with OpenAI, Anthropic, Google Gemini and Groq using your own API key.
- Your key is encrypted on your device and sent only to the provider you choose.
- No Notidem server. We never see your key, your text or your drafts.

PRIVATE BY DESIGN
- Everything is stored locally in your browser. Export or erase it anytime.
- Anonymous usage statistics are off by default.
- Open source (MIT): you can audit the code.

COMING SOON
Instagram, Facebook, Reddit, YouTube, Threads, Bluesky and TikTok. Tell us which one you want with the "I want this" button.

Notidem is independent and not affiliated with or endorsed by LinkedIn, X or any other network. Their names are trademarks of their respective owners.

## What's new in 2.0

- New LinkedIn-style design with dark mode.
- X / Twitter support (beta).
- Quick draft: generate a reply from selected text on any website.
- Richer context: profile, up to 8 files, portfolio links, and a view of exactly what the AI sees.
- Voice editor: tone presets, phrases to avoid, emoji policy, writing samples.
- History search, filter and export; profile export and import (without keys).
- Vote for the next network.
- Gemini now uses gemini-2.5-flash. Existing v1 profiles are migrated automatically.

## Single purpose

Help the user write reply drafts (comments, replies, messages) with an AI provider of their choice, using their own profile as context. The user always reviews and sends the text; the extension never posts on its own.

## Permission justifications

**storage**: Saves the user's settings locally: encrypted API keys, profile, context files and links, voice settings, preferences and draft history.

**activeTab**: Used by Quick draft. When the user clicks the toolbar icon, it lets the extension read the text the user has selected on the current tab, only at that moment and only because the user asked.

**scripting**: Used with activeTab to run a small read-only function in the current tab that returns the selected text. Only runs after the user clicks Generate in the popup.

**Host permissions (api.openai.com, api.anthropic.com, generativelanguage.googleapis.com, api.groq.com)**: Lets the background worker send the generation request directly to the AI provider the user chose, with the user's own key. No other servers are contacted.

**Content scripts on linkedin.com and x.com / twitter.com**: Detect the comment box or composer, add the Notidem button and panel, read the visible post or conversation when the user clicks Generate, and insert the draft the user approves. They run on those sites only.

**Remote code**: No. All code is in the package, and a strict Content Security Policy forbids loading remote code.

## Privacy practices (dashboard form)

Privacy policy URL: the GitHub Pages `privacy.html` of the project site.

Data types (mark only what applies; be consistent with the policy):

| Data type | Collected by the developer? | Notes |
|---|---|---|
| Personally identifiable information | No | Profile data (name, headline) is typed by the user, stored locally, and only sent to the AI provider the user selected, as part of a request the user triggers. Not sent to the developer. |
| Health, financial, authentication information | No | The API key is stored encrypted locally and sent only to its own provider. Not sent to the developer. |
| Personal communications | No | Post or message text is read only on click and sent to the user's AI provider. Not sent to the developer. |
| Website content | No | Same: handled locally and sent only to the user's chosen AI provider. |
| Location, web history | No | |
| User activity | No in this build. Yes if analytics is enabled later | See [`ANALYTICS.md`](ANALYTICS.md). Anonymous events only (network votes; opt-in usage stats). |

Certifications to tick:
- I do not sell or transfer user data to third parties, outside of approved use cases.
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Note for reviewers: the text the user sends to an AI provider is transferred at the user's request, using the user's own key, to complete the single purpose. Say this in the "Test instructions" box and mention that a key is needed to test (offer a test key privately if the review asks).

## Upload checklist

- [ ] Version in `extension/manifest.json` is higher than the published one.
- [ ] `bash scripts/build.sh` ran cleanly; `node scripts/smoke-test.mjs` passes.
- [ ] Upload `dist/notidem-v2.0.0.zip` (or the identical `docs/notidem-v2.0.zip`).
- [ ] Paste the short and detailed descriptions above; set the category (Productivity) and language.
- [ ] Screenshots: the files in the repo's store assets are from v1 and show the old design. Capture new ones at 1280x800 (or 640x400) of the new popup, settings page, and the in-page panel on LinkedIn and X.
- [ ] Icon 128x128 present in the package (it is).
- [ ] Single purpose and permission justifications pasted.
- [ ] Privacy practices form completed; privacy policy URL set.
- [ ] Manual QA on real, logged-in LinkedIn and X done (see [`RELEASE-v2.md`](RELEASE-v2.md)).
- [ ] Submit for review; choose staged or immediate publish.
