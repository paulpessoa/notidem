// src/lib/prompt.js
// Builds the prompt sent to any provider. Pure functions, no I/O.

const MAX_PROFILE_CHARS = 2500;
const MAX_POST_CHARS = 2000;

// Pre-configured options the user can pick in the panel. Each maps to a short
// instruction the model can act on. Kept here so UI and prompt never drift.
export const GOALS = {
  insight:   'Add a genuine, specific insight or a different angle on the topic.',
  experience:'Share one brief, relevant personal experience that connects to the post.',
  question:  'Ask one thoughtful, open question that moves the conversation forward.',
  support:   'Show genuine, specific agreement and build on one concrete point the author made.',
  contrarian:'Respectfully offer a nuanced counter-point or a tension worth considering.',
};

export const LENGTHS = {
  short:  'Keep it to 1 sentence — punchy and to the point.',
  medium: 'Keep it to 2-3 sentences.',
  long:   'Keep it to 3-4 sentences, but never longer.',
};

// Goals available when replying inside a direct-message conversation.
export const MESSAGE_GOALS = {
  reply:    'Reply naturally to move the conversation forward, matching its tone.',
  thank:    'Warmly thank or acknowledge what they said, then add one genuine line.',
  schedule: 'Propose a concrete, low-pressure next step (a call, a time, a resource).',
  answer:   'Directly answer the question they asked, clearly and helpfully.',
  decline:  'Politely and respectfully decline or set a boundary, without burning the relationship.',
};

/**
 * Combine manual text + resume text into a single profile blob.
 */
export function composeProfile(profile) {
  if (!profile) return '';
  const parts = [];
  if (profile.manualText?.trim()) parts.push(profile.manualText.trim());
  if (profile.pdfText?.trim()) {
    parts.push(`[From the user's resume / CV]:\n${profile.pdfText.trim()}`);
  }
  return parts.join('\n\n').slice(0, MAX_PROFILE_CHARS);
}

export function buildSystemPrompt({ profile, tone, language, goal, length, customInstruction }) {
  const profileBlock = profile || '(No profile provided.)';
  const toneBlock =
    tone?.trim() ||
    'Professional, warm, and specific. Sound like a real person, not a brand account.';

  const goalLine = GOALS[goal] || GOALS.insight;
  const lengthLine = LENGTHS[length] || LENGTHS.medium;

  const lines = [
    'You are helping a user write a reply to SOMEONE ELSE\'S LinkedIn post.',
    'There are two distinct people involved:',
    '  1. THE USER (described below) — this is who is writing the comment.',
    '  2. THE POST AUTHOR — a different person who wrote the post being replied to.',
    'The comment must be addressed TO the post author, reacting to THEIR post.',
    'Never write as if the user is talking to themselves or describing themselves.',
    'Use the user\'s background ONLY as quiet context for their perspective and voice.',
    'Draw on it for credibility when it is truly relevant — e.g. mention a relevant',
    'domain or experience in passing — but never paste or list the resume back.',
    '',
    '# Who the user is (the commenter — for voice/perspective only)',
    profileBlock,
    '',
    '# Desired voice and tone',
    toneBlock,
    '',
    '# What this comment should do',
    `- Primary goal: ${goalLine}`,
    `- Length: ${lengthLine}`,
    `- Write the comment in ${language || 'English'}.`,
  ];

  if (customInstruction?.trim()) {
    lines.push('', '# Extra instruction from the user (highest priority)', customInstruction.trim());
  }

  lines.push(
    '',
    '# Hard rules',
    '- React to the SPECIFIC content of the post. Reference a concrete point from it.',
    '- The comment is directed at the post author, not at the user.',
    '- Do NOT list or describe the user\'s own skills/resume unless the post explicitly asks.',
    '- Sound human and authentic. Vary sentence rhythm. No corporate filler.',
    '- Do NOT open with "Great post", "Love this", "So insightful", "This resonates", or similar.',
    '- No emojis unless the tone explicitly calls for them. No hashtags unless they add real value.',
    '- Output ONLY the comment text. No preamble, no quotation marks, no explanation.',
  );

  return lines.join('\n');
}

export function buildUserPrompt({ postText, postAuthor }) {
  const author = postAuthor ? postAuthor : 'someone';
  const clean = (postText || '').slice(0, MAX_POST_CHARS).trim();
  return [
    `Below is a LinkedIn post written by ${author}. The user wants to reply to it.`,
    '',
    'POST CONTENT (written by the other person, NOT by the user):',
    '"""',
    clean,
    '"""',
    '',
    `Write one comment the user would post in reply to ${author}. React to what the post actually says.`,
    'Begin your output with the first word of the comment itself.',
    'Do NOT write any preamble, framing, disclaimers, or notes such as "Since the post content is not available" or "Here is a comment". Output the comment and nothing else.',
  ].join('\n');
}

// ---- Messaging prompts ------------------------------------------------------

export function buildMessageSystemPrompt({ profile, tone, language, goal, length, customInstruction }) {
  const profileBlock = profile || '(No profile provided.)';
  const toneBlock =
    tone?.trim() ||
    'Warm, human, and concise. Sound like a real person typing to someone they respect.';

  const goalLine = MESSAGE_GOALS[goal] || MESSAGE_GOALS.reply;
  const lengthLine = LENGTHS[length] || LENGTHS.medium;

  const lines = [
    'You are helping THE USER write their next reply in a private LinkedIn direct-message conversation.',
    'You are given the recent conversation transcript. Lines starting with "You:" were written by the user;',
    'other lines are from the person they are talking to.',
    'Write ONLY the user\'s next message — the natural continuation of the thread.',
    '',
    '# Who the user is (for voice and credibility — do not recite it back)',
    profileBlock,
    '',
    '# Desired voice and tone',
    toneBlock,
    '',
    '# What this reply should do',
    `- Primary goal: ${goalLine}`,
    `- Length: ${lengthLine}`,
    `- Write the reply in ${language || 'English'}.`,
  ];

  if (customInstruction?.trim()) {
    lines.push('', '# Extra instruction from the user (highest priority)', customInstruction.trim());
  }

  lines.push(
    '',
    '# Hard rules',
    '- Respond to the most recent message in the thread; stay on topic.',
    '- Sound human and specific. No corporate filler, no "I hope this message finds you well".',
    '- Never sound like a mass-sent template. This is a one-to-one, genuine reply.',
    '- Do not invent facts, commitments, dates, or numbers the user has not implied.',
    '- No emojis unless the conversation already uses them. No hashtags.',
    '- Output ONLY the message text. No preamble, no quotation marks, no signature, no explanation.',
  );

  return lines.join('\n');
}

export function buildMessageUserPrompt({ transcript, otherName }) {
  const who = otherName || 'the other person';
  return [
    `Here is the recent conversation between the user and ${who}:`,
    '"""',
    (transcript || '').slice(0, 3000).trim(),
    '"""',
    '',
    `Write the user's next message in reply to ${who}. Output only that message.`,
  ].join('\n');
}
