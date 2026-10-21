# Privacy Policy

_Last updated: October 2026_

Notidem is built so that your data stays with you. This document explains exactly what is processed, where, and why.

## Summary

- There is **no Notidem server**. We do not run a backend that receives your data.
- Your API key, your profile, and your draft history are stored **only on your device**, in the browser's local storage.
- When you click Generate, the text you are replying to is sent **directly to the AI provider you chose** (OpenAI, Anthropic, Gemini, or Groq), using your own key, over HTTPS.
- We never see, collect, transmit, or store your key, your text, your drafts, your profile, or your LinkedIn / X data.
- Anonymous usage statistics are **disabled in this build**. See [Anonymous usage statistics](#anonymous-usage-statistics).

## What data is involved

| Data | Where it lives | When it leaves your device | To whom |
|---|---|---|---|
| AI provider API key | Local storage, encrypted (AES-GCM) | Only inside the request to the provider | The provider you chose |
| Profile (name, headline, about, expertise, goals, voice settings, writing samples) | Local storage | Only as context inside a generation request | The provider you chose |
| Context files (PDF, TXT, MD; up to 8) and portfolio links | Local storage; only the enabled ones are used | Only as context inside a generation request (links are sent as text, never fetched) | The provider you chose |
| Post text or conversation transcript (LinkedIn, X) | Read transiently from the page | Only inside a generation request | The provider you chose |
| Quick draft: your text selection on any site | Read once, when you click in the popup (`activeTab`) | Only inside a generation request | The provider you chose |
| Draft history | Local storage | Never | No one |

## Anonymous usage statistics

Disabled in this build. The extension ships with no analytics measurement ID or secret, so it sends nothing to any analytics service. If a future version enables it, this is how it works:

- **Network votes.** The "I want this" button on a "Coming soon" network sends one event, `platform_interest`, with the network name and where you clicked (popup or settings). The button is labelled as sending 1 anonymous click.
- **Usage statistics, opt-in only.** Other events (install, update, panel opened, draft generated, generation error, draft used) are sent only if you turn on **Share anonymous usage stats** in Settings. It is off by default and you can turn it off at any time.
- **What is in an event:** a random install ID (not linked to you, your browser profile or your accounts), the extension version, and a few allow-listed values such as network, mode, goal, length, provider and status.
- **What is never sent:** post text, drafts, your profile or files, URLs, names, API keys.
- **Provider:** Google Analytics 4 (Measurement Protocol). Google's own privacy terms apply to that data.
- Votes are also counted locally in your browser regardless.

## Legal basis (LGPD / GDPR)

Notidem processes personal data locally and transiently for one purpose: to help you draft a reply you have asked for.

- **Lawful basis:** your consent, exercised explicitly each time you click Generate.
- **Controller:** you. There is no Notidem-operated controller, because no Notidem server receives the data.
- **Processor:** the AI provider you select acts as a processor for that single request, under their own terms and privacy policy.
- **Data minimization:** Notidem reads only the text visible on the screen for the reply you are writing, and only when you ask it to.
- **Retention:** local only, under your control. Draft history is capped and can be cleared at any time.

## Your rights

Because all data is local and under your control, you can exercise your rights directly:

- **Access / portability:** your data is in your browser's local storage.
- **Erasure:** use "Forget my keys" to remove keys, or "Clear all data" to remove everything (profile, context files, keys, preferences, history, and the encryption material). You can also export your profile (without keys) and import it elsewhere.
- **Withdraw consent:** stop using Generate, turn off "Share anonymous usage stats", or remove the extension.

## Third-party providers

When you generate a draft, your text is sent to the AI provider you configured. Each provider has its own privacy policy and data-handling terms, which govern that request. Review the policy of whichever provider you use.

## Contact

For privacy questions, open an issue on the project repository.
