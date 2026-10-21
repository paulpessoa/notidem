# Roadmap

Notidem's direction, roughly in order. Nothing here is a promise of dates — it's the plan.

## Shipped

### v2.0
- LinkedIn-style redesign with dark mode, for the popup, settings and in-page panel.
- **X / Twitter (beta):** in-page replies with a 280-character counter.
- **Quick draft** in the popup, on any site, reading your selection only when you click.
- Richer context: profile, up to 8 context files (PDF/TXT/MD), portfolio links, "What the AI sees" and a context-strength meter.
- Voice editor: tone presets, style, phrases to avoid, emoji policy, writing samples.
- History search/filter/export, profile export/import (without keys), "Auto" language.
- "Coming soon" networks with an "I want this" vote button (Instagram, Facebook, Reddit, YouTube, Threads, Bluesky, TikTok).
- Optional anonymous analytics (GA4), built but disabled until configured. See [`ANALYTICS.md`](ANALYTICS.md).

### v1.x
- AI-drafted comments and message replies on LinkedIn, with goals, length and free-text instruction.
- Bring-your-own-key for OpenAI, Anthropic, Gemini and Groq.
- At-rest key encryption (AES-GCM), strict CSP, minimal permissions, one-click erase.

## Next

### In-page button for the most-voted networks
Votes decide the order. The network with the most "I want this" clicks gets a full in-page button next, moving from "Coming soon" to beta.

### Per-context profiles
The same person is a **candidate** in one chat, a **recruiter** in another, in **sales** in a third. Notidem will let you keep distinct profiles and voices per context and switch between them.

### Optional hosted AI (opt-in credits)
For people who don't want to manage an API key, an optional hosted mode where the key lives on a server, never in your browser. The bring-your-own-key path stays free and open forever; hosted is a convenience, not a paywall around the core.

## Principles that won't change

- **Human in the loop, always.** Notidem drafts; you decide and send. No auto-posting, no mass outreach.
- **Transparent by default.** The data flow is documented and the source is open.
- **Open core.** The thing that makes Notidem useful is free and auditable.
