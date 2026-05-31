// src/lib/messages.js
// Message type constants shared across background, content, and popup.

export const MSG = {
  GENERATE: 'GENERATE_COMMENT',     // -> background; payload: { postText, postAuthor }
  GENERATE_MESSAGE: 'GENERATE_MESSAGE', // -> background; payload: { transcript, otherName }
  SAVE_HISTORY: 'SAVE_HISTORY',     // -> background; payload: history entry
  GET_PAGE_POST: 'GET_PAGE_POST',   // -> content;    returns { postText, postAuthor, postUrl }
  OPEN_OPTIONS: 'OPEN_OPTIONS',     // -> background
  GET_PREFS: 'GET_PREFS',           // -> background; returns prefs object
};
