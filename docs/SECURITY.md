# Security

This document describes Notidem's security model honestly — including its limits.

## Where the API key lives, and who can reach it

| Layer | Protection |
|---|---|
| Another extension reading your storage | Not possible. `chrome.storage.local` is isolated per extension by the browser. |
| The LinkedIn page (or third-party scripts on it) | Cannot reach the key. All key handling happens in the isolated background worker; the key is never injected into the page. |
| Casual/offline access to the storage file or a backup | The key is encrypted at rest (AES-GCM), so it is not readable as plain text. |
| Malware already running as your user | Not solvable by any browser extension. To *use* a key, it must be decrypted in the browser, so an active attacker on your machine can reach it. |

## The seven layers

1. **Key never touches the page.** Network calls and key use happen only in the background service worker.
2. **Encrypted at rest** with AES-GCM via the Web Crypto API.
3. **Local only** — stored in `chrome.storage.local`, never `chrome.storage.sync`, so it is never uploaded to the cloud.
4. **Never logged** — the key is never written to the console or any log.
5. **Strict Content Security Policy** in the manifest blocks remote code execution.
6. **Minimal permissions** — only `storage` plus the four AI provider hosts.
7. **One-click erase** — "Forget my keys" and "Clear all data".

## Honest limitation

No browser extension can fully protect a secret against malware that is already running as your user. Encryption at rest is defense in depth: it stops casual disk/backup reads, not an active local attacker. For maximum safety:

- Use a **scoped key** with a **low spend limit**.
- **Remove the key** when you are done.
- Prefer the upcoming optional hosted mode (key on a server, never in the browser) if you want to avoid handling a key at all.

## Reporting a vulnerability

Please open a private security advisory on the repository, or an issue marked as security-sensitive, rather than disclosing publicly. Describe the issue, the impact, and steps to reproduce.
