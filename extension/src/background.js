// src/background.js  (ES module service worker)
// Responsibilities:
//   - Receive GENERATE requests, build the prompt, call the chosen provider.
//   - Persist history entries.
//   - Open the options page on request.
//
// SECURITY: All network calls and all API-key handling happen HERE, in the
// isolated service worker — never in the content script. This means the API key
// is never injected into the LinkedIn page's context, so no page script (or
// third-party script running on linkedin.com) can ever read it. The content
// script only ever sends post text and receives a finished comment string.

import { MSG } from './lib/messages.js';
import { storage } from './lib/storage.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildMessageSystemPrompt,
  buildMessageUserPrompt,
  composeProfile,
} from './lib/prompt.js';
import { generateComment } from './providers/clients.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MSG.GENERATE:
      handleGenerate(message.payload).then(sendResponse);
      return true; // async

    case MSG.GENERATE_MESSAGE:
      handleGenerateMessage(message.payload).then(sendResponse);
      return true; // async

    case MSG.SAVE_HISTORY:
      storage.addHistoryEntry(message.payload).then((entry) =>
        sendResponse({ ok: true, entry })
      );
      return true;

    case MSG.OPEN_OPTIONS:
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;

    case MSG.GET_PREFS:
      storage.getPrefs().then(sendResponse);
      return true;

    default:
      return false;
  }
});

async function handleGenerate({ postText, postAuthor, goal, length, customInstruction }) {
  try {
    // Refuse to generate without real post text. Inventing a comment from a
    // placeholder is what caused generic, role-reversed replies. Better to fail
    // loudly so the user can open/expand the post.
    if (!postText || !postText.trim() || postText.trim().length < 12) {
      throw new Error('No post text was detected. Open or expand the post so its text is visible, then try again.');
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

    const provider = prefs.provider || 'groq';
    const apiKey = apiKeys[provider];
    if (!apiKey) {
      throw new Error(`No API key set for the selected provider. Add one in Settings.`);
    }

    const system = buildSystemPrompt({
      profile,
      tone: profileRaw.tone,
      language: prefs.language,
      goal: goal || prefs.defaultGoal,
      length: length || prefs.defaultLength,
      customInstruction,
    });
    const user = buildUserPrompt({ postText, postAuthor });

    const comment = await generateComment({ provider, apiKey, system, user });
    return { ok: true, comment, provider, language: prefs.language };
  } catch (err) {
    return { ok: false, error: err.message || 'Something went wrong.' };
  }
}

async function handleGenerateMessage({ transcript, otherName, goal, length, customInstruction }) {
  try {
    if (!transcript || !transcript.trim() || transcript.trim().length < 12) {
      throw new Error('No conversation detected. Open a chat thread so its messages are visible, then try again.');
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

    const provider = prefs.provider || 'groq';
    const apiKey = apiKeys[provider];
    if (!apiKey) {
      throw new Error('No API key set for the selected provider. Add one in Settings.');
    }

    const system = buildMessageSystemPrompt({
      profile,
      tone: profileRaw.tone,
      language: prefs.language,
      goal: goal || 'reply',
      length: length || prefs.defaultLength,
      customInstruction,
    });
    const user = buildMessageUserPrompt({ transcript, otherName });

    const comment = await generateComment({ provider, apiKey, system, user });
    return { ok: true, comment, provider, language: prefs.language };
  } catch (err) {
    return { ok: false, error: err.message || 'Something went wrong.' };
  }
}
