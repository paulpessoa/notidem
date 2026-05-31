// src/providers/clients.js
// One async function per provider. Each takes (apiKey, system, user, model)
// and returns a plain string comment, or throws an Error with a readable message.

import { PROVIDERS } from './registry.js';

async function parseError(res, fallback) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || data?.message || '';
  } catch {
    /* ignore */
  }
  return new Error(detail || `${fallback} (HTTP ${res.status})`);
}

// ---- OpenAI-compatible (Groq + OpenAI share the same schema) ----------------

async function callOpenAICompatible(url, apiKey, system, user, model) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 320,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw await parseError(res, 'Request failed');
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from the model.');
  return text;
}

// ---- Gemini -----------------------------------------------------------------

async function callGemini(apiKey, system, user, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { maxOutputTokens: 320, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw await parseError(res, 'Request failed');
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from the model.');
  return text;
}

// ---- Claude (Anthropic) -----------------------------------------------------

async function callClaude(apiKey, system, user, model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 320,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw await parseError(res, 'Request failed');
  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from the model.');
  return text;
}

// ---- Dispatcher -------------------------------------------------------------

export async function generateComment({ provider, apiKey, system, user }) {
  const meta = PROVIDERS[provider];
  if (!meta) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error(`No API key set for ${meta.label}.`);

  switch (provider) {
    case 'groq':
      return callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, system, user, meta.model);
    case 'openai':
      return callOpenAICompatible('https://api.openai.com/v1/chat/completions', apiKey, system, user, meta.model);
    case 'gemini':
      return callGemini(apiKey, system, user, meta.model);
    case 'claude':
      return callClaude(apiKey, system, user, meta.model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
