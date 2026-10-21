// src/background.js  (ES module service worker)
// Responsibilities:
//   - Receive GENERATE requests, build the prompt, call the chosen provider.
//   - Persist history entries and "coming soon" votes.
//   - Forward anonymous usage events to analytics (only when enabled).
//   - Open the options page on request.
//
// SECURITY: All network calls and all API-key handling happen HERE, in the
// isolated service worker — never in the content script. This means the API key
// is never injected into the host page's context, so no page script (or
// third-party script running on linkedin.com / x.com) can ever read it. The
// content script only ever sends post text and receives a finished draft.

import { MSG } from './lib/messages.js';
import { storage } from './lib/storage.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildMessageSystemPrompt,
  buildMessageUserPrompt,
  composeProfile,
  cleanOutput,
  platformStyle,
  GOALS,
  MESSAGE_GOALS,
} from './lib/prompt.js';
import { generateComment } from './providers/clients.js';
import { PROVIDERS } from './providers/registry.js';
import { track } from './lib/analytics.js';

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
  track(reason === 'install' ? 'install' : 'update', {}).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MSG.GENERATE:
      handleGenerate('comment', message.payload).then(sendResponse);
      return true; // async

    case MSG.GENERATE_MESSAGE:
      handleGenerate('message', message.payload).then(sendResponse);
      return true; // async

    case MSG.SAVE_HISTORY:
      storage.addHistoryEntry(message.payload).then((entry) => {
        track('draft_used', { platform: entry.platform, mode: entry.kind, surface: message.payload?.surface });
        sendResponse({ ok: true, entry });
      });
      return true;

    case MSG.OPEN_OPTIONS: {
      const section = message.payload?.section;
      if (section) chrome.tabs.create({ url: chrome.runtime.getURL(`src/ui/options.html#${section}`) });
      else chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }

    case MSG.GET_PREFS:
      storage.getPrefs().then(sendResponse);
      return true;

    case MSG.GET_STATUS:
      getStatus().then(sendResponse);
      return true;

    case MSG.VOTE_PLATFORM:
      handleVote(message.payload).then(sendResponse);
      return true;

    case MSG.TRACK:
      track(message.payload?.name, message.payload?.params).then(sendResponse);
      return true;

    default:
      return false;
  }
});

async function getStatus() {
  const [profileRaw, apiKeys, prefs] = await Promise.all([
    storage.getProfile(),
    storage.getApiKeys(),
    storage.getPrefs(),
  ]);
  const provider = prefs.provider || 'groq';
  const labels = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.label]));
  return {
    hasProfile: Boolean(composeProfile(profileRaw)),
    hasKey: Boolean(apiKeys[provider]),
    provider,
    providerLabel: PROVIDERS[provider]?.label || provider,
    language: prefs.language,
    defaultGoal: prefs.defaultGoal,
    defaultLength: prefs.defaultLength,
    goals: labels(GOALS),
    messageGoals: labels(MESSAGE_GOALS),
  };
}

async function handleVote({ platform, surface } = {}) {
  if (!platform) return { ok: false };
  const entry = await storage.recordInterest(platform);
  // The vote button is explicitly labelled as sending one anonymous click.
  const res = await track('platform_interest', { platform, surface }, { explicit: true });
  return { ok: true, count: entry.count, sent: res.sent };
}

async function handleGenerate(mode, payload = {}) {
  const { platform = 'linkedin', goal, length, customInstruction } = payload;
  try {
    const isMsg = mode === 'message';
    const primary = isMsg ? payload.transcript : payload.postText;

    // Refuse to generate without real source text. Inventing a reply from a
    // placeholder is what caused generic, role-reversed replies. Better to fail
    // loudly so the user can open/expand the post or select its text.
    if (!primary || primary.trim().length < 12) {
      throw new Error(isMsg
        ? 'No conversation detected. Open a chat thread so its messages are visible, then try again.'
        : 'No post text was detected. Open or expand the post so its text is visible (or select it), then try again.');
    }

    const [profileRaw, apiKeys, prefs] = await Promise.all([
      storage.getProfile(),
      storage.getApiKeys(),
      storage.getPrefs(),
    ]);

    const profile = composeProfile(profileRaw);
    if (!profile) {
      throw new Error('Your profile is empty. Open Settings and add a few details about yourself first.');
    }

    const provider = payload.provider || prefs.provider || 'groq';
    const apiKey = apiKeys[provider];
    if (!apiKey) {
      throw new Error('No API key set for the selected provider. Add one in Settings.');
    }

    const common = {
      platform,
      profile,
      profileRaw,
      language: prefs.language,
      length: length || prefs.defaultLength,
      customInstruction,
    };
    const system = isMsg
      ? buildMessageSystemPrompt({ ...common, goal: goal || 'reply' })
      : buildSystemPrompt({ ...common, goal: goal || prefs.defaultGoal });
    const user = isMsg
      ? buildMessageUserPrompt({ transcript: payload.transcript, otherName: payload.otherName })
      : buildUserPrompt({ platform, postText: payload.postText, postAuthor: payload.postAuthor });

    const comment = cleanOutput(await generateComment({ provider, apiKey, system, user }));
    track('generate', { platform, mode, goal, length, provider, surface: payload.surface });
    return {
      ok: true,
      comment,
      provider,
      providerLabel: PROVIDERS[provider]?.label || provider,
      language: prefs.language === 'auto' ? 'Auto' : prefs.language,
      maxChars: platformStyle(platform).maxChars || 0,
    };
  } catch (err) {
    track('generate_error', { platform, mode });
    return { ok: false, error: err.message || 'Something went wrong.' };
  }
}
