# Permissions

Notidem requests the smallest set of permissions it can. Here is why each one exists.

## `storage`

Stores your settings locally: your AI provider keys (encrypted), your profile, context files and links, voice settings, preferences, and your draft history. Without it, the extension could not remember anything between sessions.

## Host permissions: the four AI providers

```
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
https://api.groq.com/*
```

These let the background worker send your generation request directly to whichever provider you chose. Notidem talks to no other servers.

## `activeTab`

Used by the popup's **Quick draft**. When you click the Notidem toolbar icon, Chrome grants temporary access to the current tab only. It lets Notidem read your current text selection on that page, once, because you asked. The access ends when you leave the tab or close it. It is not a standing permission to read any site.

## `scripting`

Used together with `activeTab` to run a tiny read-only function in the current tab that returns the selected text (`window.getSelection()`). It is only called after you click in the popup. Without `activeTab`, `scripting` cannot touch any page.

## Content scripts on LinkedIn and X

```
https://www.linkedin.com/*
https://x.com/*, https://twitter.com/*
https://mobile.x.com/*, https://mobile.twitter.com/*
```

These run the script that detects the comment box or composer, adds the Notidem button, reads the visible text when you click Generate, and inserts the draft you approve. They do not run anywhere else. Other networks marked "Coming soon" have no content script.

## Content Security Policy and `connect-src`

Extension pages may connect only to the four AI providers and to `https://www.google-analytics.com`. The last entry is used only if anonymous analytics is configured in the build; in the current build it is not (the measurement ID and secret are empty), so no request to that host is ever made. See [`PRIVACY.md`](PRIVACY.md) and [`ANALYTICS.md`](ANALYTICS.md).

## What Notidem does NOT request

- No `tabs` permission to read your other tabs.
- No `cookies` or `webRequest` to intercept traffic.
- No broad `<all_urls>` host access.
- No remote code: a strict Content Security Policy blocks loading or executing code from anywhere outside the extension package.
- No analytics, tracking, or telemetry by default. Analytics is disabled in this build; if a future build enables it, it is limited to anonymous network votes plus usage statistics that stay off unless you turn on "Share anonymous usage stats" in Settings. Nothing about your text, drafts, profile, URLs or keys is ever included.
- No `web_accessible_resources`: web pages cannot load files from the extension.
