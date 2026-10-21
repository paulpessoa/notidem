// src/lib/prompt.js
// Builds the prompt sent to any provider. Pure functions, no I/O.

const MAX_PROFILE_CHARS = 6000;
const MAX_POST_CHARS = 2000;
const MAX_TRANSCRIPT_CHARS = 3000;

// Pre-configured options the user can pick in the panel. Each maps to a short
// instruction the model can act on. Kept here so UI and prompt never drift.
export const GOALS = {
  insight:    { label: 'Add an insight',        text: 'Add a genuine, specific insight or a different angle on the topic.' },
  experience: { label: 'Share an experience',   text: 'Share one brief, relevant personal experience that connects to the post.' },
  question:   { label: 'Ask a question',        text: 'Ask one thoughtful, open question that moves the conversation forward.' },
  support:    { label: 'Agree & build on it',   text: 'Show genuine, specific agreement and build on one concrete point the author made.' },
  contrarian: { label: 'Respectful counter-point', text: 'Respectfully offer a nuanced counter-point or a tension worth considering.' },
  congrats:   { label: 'Congratulate',          text: 'Congratulate the author warmly and specifically, naming what is impressive about it.' },
};

// Goals available when replying inside a direct-message conversation.
export const MESSAGE_GOALS = {
  reply:    { label: 'Reply in context',   text: 'Reply naturally to move the conversation forward, matching its tone.' },
  thank:    { label: 'Thank / acknowledge', text: 'Warmly thank or acknowledge what they said, then add one genuine line.' },
  schedule: { label: 'Propose a next step', text: 'Propose a concrete, low-pressure next step (a call, a time, a resource).' },
  answer:   { label: 'Answer their question', text: 'Directly answer the question they asked, clearly and helpfully.' },
  decline:  { label: 'Politely decline',    text: 'Politely and respectfully decline or set a boundary, without burning the relationship.' },
};

export const LENGTHS = {
  short:  'Keep it to 1 sentence — punchy and to the point.',
  medium: 'Keep it to 2-3 sentences.',
  long:   'Keep it to 3-4 sentences, but never longer.',
};

// What the user wants out of being active on social media. Steers which part
// of their background is worth surfacing.
export const GOAL_PRESETS = {
  hired:     'Get hired / find a new role',
  clients:   'Attract clients or leads',
  audience:  'Grow an audience as a thought leader',
  network:   'Build relationships with peers',
  hire:      'Recruit talent',
  learn:     'Learn and exchange ideas',
};

export const TONE_PRESETS = {
  direct:    'Direct',
  warm:      'Warm',
  witty:     'Witty',
  technical: 'Technical',
  formal:    'Formal',
  casual:    'Casual',
  curious:   'Curious',
  humble:    'Humble',
};

// Per-network writing conventions. Short on purpose: the model already knows
// these platforms, it just needs to be reminded which one it is writing for.
export const PLATFORM_STYLE = {
  linkedin:  { name: 'LinkedIn',  rule: 'Professional network. Thoughtful, credible, human. Line breaks are fine; no hashtag spam.' },
  x:         { name: 'X (Twitter)', rule: 'Conversational and concise. HARD LIMIT: 280 characters including spaces. No hashtags unless essential.', maxChars: 280 },
  instagram: { name: 'Instagram', rule: 'Friendly and visual-first. Short, warm, can use one fitting emoji if the tone allows.' },
  facebook:  { name: 'Facebook',  rule: 'Friendly, personal, community-minded. Plain language.' },
  reddit:    { name: 'Reddit',    rule: 'Substance over polish. No self-promotion, no marketing voice, no emojis. Be specific and genuinely useful.' },
  youtube:   { name: 'YouTube',   rule: 'Reference something specific from the video. Casual and appreciative, never generic.' },
  threads:   { name: 'Threads',   rule: 'Casual and conversational. HARD LIMIT: 500 characters.', maxChars: 500 },
  bluesky:   { name: 'Bluesky',   rule: 'Casual, thoughtful, community-minded. HARD LIMIT: 300 characters.', maxChars: 300 },
  tiktok:    { name: 'TikTok',    rule: 'Very short, playful and authentic. HARD LIMIT: 150 characters.', maxChars: 150 },
  generic:   { name: 'social media', rule: 'Natural, specific and human.' },
};

export function platformStyle(id) {
  return PLATFORM_STYLE[id] || PLATFORM_STYLE.generic;
}

const FILE_KIND_LABEL = {
  resume: 'Resume / CV',
  portfolio: 'Portfolio / case studies',
  notes: 'Notes about me',
  other: 'Reference document',
};

/**
 * Turn the structured profile into one context block, most important first,
 * within a fixed character budget. Files get whatever budget is left, shared
 * fairly between the enabled ones.
 */
export function composeProfile(profile) {
  if (!profile) return '';
  const parts = [];
  const line = (label, value) => value && parts.push(`${label}: ${value}`);

  line('Name', profile.name?.trim());
  line('Headline', profile.headline?.trim());
  if (profile.bio?.trim()) parts.push(`About:\n${profile.bio.trim()}`);
  if (profile.expertise?.length) line('Expertise', profile.expertise.join(', '));

  const goals = (profile.goals || []).map((g) => GOAL_PRESETS[g]).filter(Boolean);
  if (goals.length || profile.goalsNote?.trim()) {
    parts.push(`What they want from social media: ${[...goals, profile.goalsNote?.trim()].filter(Boolean).join('; ')}`);
  }

  const links = (profile.links || []).filter((l) => l.url || l.label);
  if (links.length) {
    parts.push('Portfolio and links (mention ONLY when directly relevant, never as self-promotion):\n' +
      links.map((l) => `- ${l.label || l.url}${l.url && l.label ? ` (${l.url})` : ''}${l.note ? ` — ${l.note}` : ''}`).join('\n'));
  }

  let head = parts.join('\n');
  const files = (profile.files || []).filter((f) => f.enabled && f.text?.trim());
  let budget = MAX_PROFILE_CHARS - head.length;
  if (files.length && budget > 300) {
    const share = Math.floor(budget / files.length) - 60;
    const blocks = files.map((f) =>
      `[${FILE_KIND_LABEL[f.kind] || FILE_KIND_LABEL.other}: ${f.name}]\n${f.text.trim().slice(0, share)}`
    );
    head += (head ? '\n\n' : '') + blocks.join('\n\n');
  }
  return head.slice(0, MAX_PROFILE_CHARS);
}

function voiceBlock(profile, fallback) {
  const out = [];
  const tags = (profile?.toneTags || []).map((t) => TONE_PRESETS[t]).filter(Boolean);
  if (tags.length) out.push(`Tone keywords: ${tags.join(', ')}.`);
  if (profile?.tone?.trim()) out.push(profile.tone.trim());
  if (!out.length) out.push(fallback);
  if (profile?.avoid?.trim()) out.push(`Never use these words or phrases: ${profile.avoid.trim()}`);
  if (profile?.samples?.trim()) {
    out.push('Examples of how the user actually writes (mimic rhythm and word choice, do not copy content):\n"""\n' +
      profile.samples.trim().slice(0, 1200) + '\n"""');
  }
  return out.join('\n');
}

function emojiRule(profile, defaultRule) {
  switch (profile?.emoji) {
    case 'never': return '- Never use emojis.';
    case 'sometimes': return '- At most one emoji, and only if it genuinely fits.';
    default: return defaultRule;
  }
}

function languageLine(language, what) {
  if (!language || language === 'auto') {
    return `- Write the ${what} in the same language as the content you are replying to.`;
  }
  return `- Write the ${what} in ${language}.`;
}

export function buildSystemPrompt({ platform, profile, profileRaw, language, goal, length, customInstruction }) {
  const style = platformStyle(platform);
  const profileBlock = profile || '(No profile provided.)';
  const goalLine = (GOALS[goal] || GOALS.insight).text;
  const lengthLine = LENGTHS[length] || LENGTHS.medium;

  const lines = [
    `You are helping a user write a reply to SOMEONE ELSE'S ${style.name} post.`,
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
    voiceBlock(profileRaw, 'Professional, warm, and specific. Sound like a real person, not a brand account.'),
    '',
    `# Platform: ${style.name}`,
    style.rule,
    '',
    '# What this comment should do',
    `- Primary goal: ${goalLine}`,
    `- Length: ${lengthLine}`,
    languageLine(language, 'comment'),
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
    emojiRule(profileRaw, '- No emojis unless the tone explicitly calls for them. No hashtags unless they add real value.'),
    '- Output ONLY the comment text. No preamble, no quotation marks, no explanation.',
  );
  if (style.maxChars) lines.push(`- The whole output MUST be under ${style.maxChars} characters.`);

  return lines.join('\n');
}

export function buildUserPrompt({ platform, postText, postAuthor }) {
  const style = platformStyle(platform);
  const author = postAuthor ? postAuthor : 'someone';
  const clean = (postText || '').slice(0, MAX_POST_CHARS).trim();
  return [
    `Below is a ${style.name} post written by ${author}. The user wants to reply to it.`,
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

export function buildMessageSystemPrompt({ platform, profile, profileRaw, language, goal, length, customInstruction }) {
  const style = platformStyle(platform);
  const profileBlock = profile || '(No profile provided.)';
  const goalLine = (MESSAGE_GOALS[goal] || MESSAGE_GOALS.reply).text;
  const lengthLine = LENGTHS[length] || LENGTHS.medium;

  const lines = [
    `You are helping THE USER write their next reply in a private ${style.name} direct-message conversation.`,
    'You are given the recent conversation transcript. Lines starting with "You:" were written by the user;',
    'other lines are from the person they are talking to.',
    'Write ONLY the user\'s next message — the natural continuation of the thread.',
    '',
    '# Who the user is (for voice and credibility — do not recite it back)',
    profileBlock,
    '',
    '# Desired voice and tone',
    voiceBlock(profileRaw, 'Warm, human, and concise. Sound like a real person typing to someone they respect.'),
    '',
    '# What this reply should do',
    `- Primary goal: ${goalLine}`,
    `- Length: ${lengthLine}`,
    languageLine(language, 'reply'),
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
    emojiRule(profileRaw, '- No emojis unless the conversation already uses them. No hashtags.'),
    '- Output ONLY the message text. No preamble, no quotation marks, no signature, no explanation.',
  );

  return lines.join('\n');
}

export function buildMessageUserPrompt({ transcript, otherName }) {
  const who = otherName || 'the other person';
  return [
    `Here is the recent conversation between the user and ${who}:`,
    '"""',
    (transcript || '').slice(0, MAX_TRANSCRIPT_CHARS).trim(),
    '"""',
    '',
    `Write the user's next message in reply to ${who}. Output only that message.`,
  ].join('\n');
}

// Models sometimes wrap the answer in quotes despite instructions.
export function cleanOutput(text) {
  let t = (text || '').trim();
  if (/^["“].*["”]$/s.test(t)) t = t.slice(1, -1).trim();
  return t;
}
