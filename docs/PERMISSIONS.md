# Permissions

Notidem requests the smallest set of permissions it can. Here is why each one exists.

## `storage`

Stores your settings locally: your AI provider key (encrypted), your profile, your tone and language preferences, and your draft history. Without it, the extension could not remember anything between sessions.

## Host permissions: the four AI providers

```
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
https://api.groq.com/*
```

These let the background worker send your generation request directly to whichever provider you chose. Notidem talks to no other servers.

## Content script on `https://www.linkedin.com/*`

Runs the script that detects the comment box or message composer, adds the Notidem button, reads the visible text when you click Generate, and inserts the draft you approve. It does not run anywhere except LinkedIn.

## What Notidem does NOT request

- No `tabs` permission to read your other tabs.
- No `cookies` or `webRequest` to intercept traffic.
- No broad `<all_urls>` host access.
- No remote code: a strict Content Security Policy blocks loading or executing code from anywhere outside the extension package.
- No analytics, tracking, or telemetry.
