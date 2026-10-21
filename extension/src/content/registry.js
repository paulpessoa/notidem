// src/content/registry.js
// Loaded first. Content scripts can't use ES modules, so platform adapters
// register themselves on a shared namespace that core.js reads afterwards.
// (All content-script files of one extension share the same isolated world.)
//
// Adapter contract:
//   id, name           'linkedin', 'LinkedIn'
//   matches(host)      true when this adapter handles the current site
//   trigger            'inline' (button bar appended under the editor) or
//                      'floating' (small button pinned to the focused editor)
//   maxChars           0 or the platform's hard character limit
//   findEditors()      contenteditable nodes we can draft into
//   detectMode(ed)     'comment' | 'message' | null (null = ignore editor)
//   inlineHost(ed)     element to append the inline bar to (inline only)
//   extract(ed, mode)  { postText, postAuthor, postUrl } or
//                      { transcript, otherName, conversationUrl }
//   scrapeTop()        best-effort post context for the toolbar popup

(() => {
  if (globalThis.__notidem) return;
  const adapters = [];
  globalThis.__notidem = {
    adapters,
    register(adapter) { adapters.push(adapter); },
    pick(host) { return adapters.find((a) => a.matches(host)) || null; },
    util: {
      isVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      },
      pickText(scope, selectors) {
        if (!scope || !scope.querySelector) return '';
        for (const sel of selectors) {
          const el = scope.querySelector(sel);
          const txt = el && el.innerText ? el.innerText.trim() : '';
          if (txt) return txt;
        }
        return '';
      },
      pickHref(scope, selectors) {
        if (!scope || !scope.querySelector) return '';
        for (const sel of selectors) {
          const el = scope.querySelector(sel);
          if (el && el.href) return el.href.split('?')[0];
        }
        return '';
      },
      placeholderOf(el) {
        return (
          el.getAttribute('aria-label') ||
          el.getAttribute('data-placeholder') ||
          el.getAttribute('aria-placeholder') ||
          ''
        ).toLowerCase();
      },
    },
  };
})();
