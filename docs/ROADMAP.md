# Roadmap

Notidem's direction, roughly in order. Nothing here is a promise of dates — it's the plan.

## Shipped

- AI-drafted **comments** on the LinkedIn feed, with selectable goals, length, and a free-text instruction.
- AI-drafted **message replies** that read the visible conversation and stay in context.
- Bring-your-own-key for OpenAI, Anthropic, Gemini, and Groq.
- At-rest key encryption (AES-GCM), strict CSP, minimal permissions, one-click erase.
- Résumé/profile context so drafts sound like you.

## Next

### Per-context profiles
LinkedIn isn't one audience. The same person is a **candidate** in one chat, a **recruiter** in another, in **sales** in a third, and **networking** in a fourth. Notidem will let you keep distinct profiles and tones per context and switch between them, so a recruiter outreach and a job application don't sound the same.

### Optional hosted AI (opt-in credits)
For people who don't want to manage an API key at all, an optional hosted mode: you sign in, buy credits, and the AI key lives on a server — never in your browser. This also removes the only real key-exposure risk for those users. The bring-your-own-key path stays free and open forever; hosted is a convenience, not a paywall around the core.

### More languages and tone presets
Beyond the current language setting, curated tone presets (warm, concise, formal, playful) and broader language coverage.

## Principles that won't change

- **Human in the loop, always.** Notidem drafts; you decide and send. No auto-posting, no mass outreach.
- **Transparent by default.** The data flow is documented and the source is open.
- **Open core.** The thing that makes Notidem useful is free and auditable.
