// src/lib/platforms.js
// Catalog of social networks Notidem knows about. Shared by the background
// worker, the popup and the options page so status labels never drift.
//
// status:
//   'live' — in-page button fully supported
//   'beta' — in-page button works, but the site's DOM changes often
//   'soon' — no in-page button yet; users can vote, and Quick draft in the
//            popup already works on that site with the right writing style.

export const PLATFORMS = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    status: 'live',
    color: '#0a66c2',
    glyph: 'in',
    hosts: ['linkedin.com'],
    blurb: 'Comments on posts and replies in messages.',
  },
  x: {
    id: 'x',
    name: 'X / Twitter',
    status: 'beta',
    color: '#0f1419',
    glyph: 'X',
    hosts: ['x.com', 'twitter.com'],
    blurb: 'Replies to posts, within 280 characters.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    status: 'soon',
    color: '#d62976',
    glyph: 'IG',
    hosts: ['instagram.com'],
    blurb: 'Comments on posts and reels.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    status: 'soon',
    color: '#1877f2',
    glyph: 'f',
    hosts: ['facebook.com'],
    blurb: 'Comments on posts and groups.',
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    status: 'soon',
    color: '#ff4500',
    glyph: 'r/',
    hosts: ['reddit.com'],
    blurb: 'Thoughtful replies in threads.',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    status: 'soon',
    color: '#ff0000',
    glyph: '▶',
    hosts: ['youtube.com'],
    blurb: 'Comments on videos.',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    status: 'soon',
    color: '#101010',
    glyph: '@',
    hosts: ['threads.net', 'threads.com'],
    blurb: 'Replies to threads.',
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    status: 'soon',
    color: '#1185fe',
    glyph: 'bs',
    hosts: ['bsky.app'],
    blurb: 'Replies to posts.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    status: 'soon',
    color: '#010101',
    glyph: '♪',
    hosts: ['tiktok.com'],
    blurb: 'Comments on videos.',
  },
};

export const PLATFORM_ORDER = [
  'linkedin', 'x', 'instagram', 'facebook', 'reddit', 'youtube', 'threads', 'bluesky', 'tiktok',
];

export const STATUS_LABEL = { live: 'Live', beta: 'Beta', soon: 'Coming soon' };

// Map a URL to a known platform id, or '' if it is not a social network we know.
export function platformFromUrl(url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
  for (const id of PLATFORM_ORDER) {
    if (PLATFORMS[id].hosts.some((h) => host === h || host.endsWith('.' + h))) return id;
  }
  return '';
}

export function getPlatform(id) {
  return PLATFORMS[id] || null;
}
