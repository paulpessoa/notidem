// src/providers/registry.js
// Single source of truth for provider metadata, shared by UI and background.

export const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq',
    emoji: '\u26a1',
    model: 'llama-3.3-70b-versatile',
    modelLabel: 'Llama 3.3 70B \u00b7 free tier available',
    keyPlaceholder: 'gsk_\u2026',
    keyUrl: 'https://console.groq.com/keys',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    emoji: '\ud83e\udd16',
    model: 'gpt-4o-mini',
    modelLabel: 'GPT-4o mini',
    keyPlaceholder: 'sk-\u2026',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    emoji: '\ud83d\udc8e',
    model: 'gemini-1.5-flash',
    modelLabel: 'Gemini 1.5 Flash',
    keyPlaceholder: 'AIza\u2026',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    emoji: '\ud83d\udfe0',
    model: 'claude-haiku-4-5',
    modelLabel: 'Claude Haiku 4.5',
    keyPlaceholder: 'sk-ant-\u2026',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
};

export const PROVIDER_ORDER = ['groq', 'openai', 'gemini', 'claude'];

export function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS.groq;
}
