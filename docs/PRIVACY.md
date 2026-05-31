# Privacy Policy

_Last updated: 2026_

Notidem is built so that your data stays with you. This document explains exactly what is processed, where, and why.

## Summary

- There is **no Notidem server**. We do not run a backend that receives your data.
- Your API key, your profile, and your draft history are stored **only on your device**, in the browser's local storage.
- When you click Generate, the text you are replying to is sent **directly to the AI provider you chose** (OpenAI, Anthropic, Gemini, or Groq), using your own key, over HTTPS.
- We never see, collect, transmit, or store your key, your text, your drafts, or your LinkedIn data.

## What data is involved

| Data | Where it lives | When it leaves your device | To whom |
|---|---|---|---|
| AI provider API key | Local storage, encrypted (AES-GCM) | Only inside the request to the provider | The provider you chose |
| Your profile / résumé text | Local storage | Only as context inside a generation request | The provider you chose |
| Post text or conversation transcript | Read transiently from the page | Only inside a generation request | The provider you chose |
| Draft history | Local storage | Never | No one |

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
- **Erasure:** use "Forget my keys" to remove keys, or "Clear all data" to remove everything (profile, keys, preferences, history, and the encryption material).
- **Withdraw consent:** stop using Generate, or remove the extension.

## Third-party providers

When you generate a draft, your text is sent to the AI provider you configured. Each provider has its own privacy policy and data-handling terms, which govern that request. Review the policy of whichever provider you use.

## Contact

For privacy questions, open an issue on the project repository.
