// src/content/platforms/x.js
// X / Twitter adapter (beta). X renders its composer with Draft.js: the
// editable node is [data-testid="tweetTextarea_0"] (role="textbox"). Post text
// lives in article[data-testid="tweet"] [data-testid="tweetText"].
// X's class names are obfuscated and change constantly, so we rely only on
// data-testid / role attributes, which are what X's own tests use.

(() => {
  const N = globalThis.__notidem;
  const { isVisible } = N.util;

  function findEditors() {
    const set = new Set();
    document
      .querySelectorAll('[data-testid^="tweetTextarea_"][contenteditable="true"], [data-testid^="tweetTextarea_"] [contenteditable="true"]')
      .forEach((el) => set.add(el));
    return [...set];
  }

  // The tweet the user is replying to: inside the reply dialog it's the article
  // in the same dialog; on a /status/ page it's the last tweet rendered above
  // the inline composer.
  function findTargetTweet(editor) {
    const dialog = editor.closest('[role="dialog"]');
    if (dialog) {
      const inDialog = [...dialog.querySelectorAll('article[data-testid="tweet"]')];
      if (inDialog.length) return inDialog[inDialog.length - 1];
    }
    const top = editor.getBoundingClientRect().top;
    let best = null;
    document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
      if (!isVisible(a)) return;
      if (a.getBoundingClientRect().top < top) best = a;
    });
    return best;
  }

  // Put the button in the composer's icon row (media, GIF, emoji…), next to
  // X's own tools. The toolbar is a sibling of the editor, so walk up to find it.
  function inlineHost(editor) {
    let el = editor.parentElement;
    for (let i = 0; el && i < 14; i++, el = el.parentElement) {
      const tb = el.querySelector('[data-testid="toolBar"]');
      if (tb) return tb.querySelector('[data-testid="ScrollSnap-List"]') || tb.firstElementChild || tb;
    }
    return null;
  }

  function extract(editor) {
    const tweet = findTargetTweet(editor);
    if (!tweet) return { postText: '', postAuthor: '', postUrl: location.href };
    const text = tweet.querySelector('[data-testid="tweetText"]');
    const user = tweet.querySelector('[data-testid="User-Name"]');
    const lines = ((user && user.innerText) || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const handle = lines.find((l) => l.startsWith('@')) || '';
    const name = lines[0] || '';
    const link = tweet.querySelector('a[href*="/status/"]');
    return {
      postText: ((text && text.innerText) || '').trim().slice(0, 1500),
      postAuthor: name && handle && name !== handle ? `${name} (${handle})` : (name || handle),
      postUrl: (link && link.href ? link.href.split('?')[0] : location.href),
    };
  }

  N.register({
    id: 'x',
    name: 'X',
    trigger: 'floating',
    maxChars: 280,
    matches: (host) => ['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'].includes(host),
    findEditors,
    // Only replies for now: a composer with no tweet above it is a new post.
    detectMode: (editor) => (findTargetTweet(editor) ? 'comment' : null),
    inlineHost,
    extract,
    scrapeTop() {
      const a = document.querySelector('article[data-testid="tweet"]');
      const t = a && a.querySelector('[data-testid="tweetText"]');
      const u = a && a.querySelector('[data-testid="User-Name"]');
      return {
        postText: ((t && t.innerText) || '').trim(),
        postAuthor: ((u && u.innerText) || '').split('\n')[0] || '',
        postUrl: location.href,
      };
    },
  });
})();
