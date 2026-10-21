// src/lib/messages.js
// Message type constants shared across background, content, and popup.
// (content scripts can't import modules, so src/content/core.js keeps a copy.)

export const MSG = {
  GENERATE: 'GENERATE_COMMENT',         // -> background; payload: { platform, postText, postAuthor, goal, length, customInstruction }
  GENERATE_MESSAGE: 'GENERATE_MESSAGE', // -> background; payload: { platform, transcript, otherName, goal, length, customInstruction }
  SAVE_HISTORY: 'SAVE_HISTORY',         // -> background; payload: history entry
  GET_PAGE_POST: 'GET_PAGE_POST',       // -> content;    returns { postText, postAuthor, postUrl, platform }
  OPEN_OPTIONS: 'OPEN_OPTIONS',         // -> background; payload?: { section }
  GET_PREFS: 'GET_PREFS',               // -> background; returns prefs object
  GET_STATUS: 'GET_STATUS',             // -> background; returns { hasProfile, hasKey, provider, goals, messageGoals, ... }
  VOTE_PLATFORM: 'VOTE_PLATFORM',       // -> background; payload: { platform, surface }
  TRACK: 'TRACK',                       // -> background; payload: { name, params }
};
