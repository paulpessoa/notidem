// src/content/ui-styles.js
// Styles for the in-page UI. They live inside Shadow DOM roots, so the host
// site's CSS can't break them and ours can't leak into the host page.
// System font stack + LinkedIn-like visual language (white cards, #0a66c2,
// pill buttons). Dark theme follows the host page's background.

(() => {
  globalThis.__notidem.css = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.root {
  --blue: #0a66c2; --blue-hover: #004182; --blue-soft: #e8f1fb;
  --ink: #191919; --ink-2: #444; --ink-3: #666; --line: #e0dfdc; --line-2: #ebebeb;
  --surface: #fff; --canvas: #f4f2ee; --green: #1a5b4b; --gold: #e8c66a;
  --red: #b24020; --red-soft: #fdeeea; --ok: #057642;
  --shadow: 0 0 0 1px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.15), 0 12px 32px rgba(0,0,0,.12);
  font: 400 14px/1.45 -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
.root.dark {
  --blue: #71b7fb; --blue-hover: #9ccbfc; --blue-soft: rgba(113,183,251,.14);
  --ink: rgba(255,255,255,.92); --ink-2: rgba(255,255,255,.75); --ink-3: rgba(255,255,255,.6);
  --line: #38434f; --line-2: #2c343d; --surface: #1b1f23; --canvas: #101317;
  --red: #f5987e; --red-soft: rgba(245,152,126,.12); --ok: #7fc15e;
  --shadow: 0 0 0 1px rgba(255,255,255,.08), 0 12px 32px rgba(0,0,0,.6);
}

/* ---- Trigger ---------------------------------------------------------- */
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 0 2px; }
.bar.block { margin-top: 6px; border-top: 1px solid var(--line-2); }
.trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 12px 0 4px;
  font-family: inherit; font-weight: 600; font-size: 13px; line-height: 1;
  color: var(--blue); background: transparent;
  border: 1px solid var(--blue); border-radius: 999px; cursor: pointer;
  transition: background .15s, box-shadow .15s, color .15s;
}
.trigger:hover { background: var(--blue-soft); box-shadow: inset 0 0 0 1px var(--blue); }
.trigger:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.bar.compact { padding: 0 0 0 4px; }
.bar.compact .trigger { height: 28px; font-size: 12.5px; }
.logo {
  display: inline-grid; place-items: center;
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--green); color: var(--gold);
  font: 700 14px/1 Georgia, "Times New Roman", serif;
  flex-shrink: 0;
}
.logo.lg { width: 32px; height: 32px; font-size: 20px; border-radius: 8px; }

/* ---- Panel ------------------------------------------------------------ */
.panel {
  width: min(400px, calc(100vw - 16px));
  max-height: min(640px, calc(100vh - 16px));
  display: flex; flex-direction: column;
  background: var(--surface); border-radius: 12px; box-shadow: var(--shadow);
  overflow: hidden;
  animation: pop .16s cubic-bezier(.22,.61,.36,1);
}
@keyframes pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }

.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-bottom: 1px solid var(--line-2); }
.brand { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.title { font-weight: 600; font-size: 15px; color: var(--ink); }
.sub { font-size: 12px; color: var(--ink-3); display: flex; align-items: center; gap: 6px; }
.pill {
  display: inline-flex; align-items: center; height: 18px; padding: 0 7px;
  border-radius: 999px; font-size: 11px; font-weight: 600;
  background: var(--blue-soft); color: var(--blue);
}
.pill.beta { background: #fff4d6; color: #8a5a00; }
.root.dark .pill.beta { background: rgba(232,198,106,.16); color: var(--gold); }
.icon-btn {
  width: 32px; height: 32px; border-radius: 50%; border: 0; background: transparent;
  color: var(--ink-3); cursor: pointer; display: grid; place-items: center; font-size: 16px;
}
.icon-btn:hover { background: var(--line-2); color: var(--ink); }
.icon-btn svg { width: 18px; height: 18px; }

.body { padding: 12px 16px 4px; overflow: auto; }

.setup {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px; margin-bottom: 12px; border-radius: 8px;
  background: var(--blue-soft); color: var(--ink-2); font-size: 13px;
}
.setup strong { color: var(--ink); }
.link { background: none; border: 0; padding: 0; color: var(--blue); font: inherit; font-weight: 600; cursor: pointer; }
.link:hover { text-decoration: underline; }

.ctx { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; background: var(--canvas); }
.ctx-meta { font-size: 12px; color: var(--ink-3); margin-bottom: 4px; }
.ctx-meta strong { color: var(--ink); font-weight: 600; }
.ctx-text {
  font-size: 13px; color: var(--ink-2); white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.ctx.open .ctx-text { -webkit-line-clamp: unset; max-height: 180px; overflow: auto; }
.ctx-empty { font-style: italic; color: var(--ink-3); }
.ctx-toggle { margin-top: 4px; font-size: 12px; }

.label { font-size: 12px; font-weight: 600; color: var(--ink-3); margin: 0 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.chip {
  height: 30px; padding: 0 12px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-weight: 600; font-size: 13px; line-height: 1;
  color: var(--ink-2); background: var(--surface); border: 1px solid var(--line);
  transition: background .12s, border-color .12s, color .12s;
}
.chip:hover { background: var(--line-2); border-color: var(--ink-3); }
.chip[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: #fff; }

.row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
.seg { display: inline-flex; padding: 2px; border-radius: 999px; background: var(--line-2); }
.seg button {
  height: 26px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent;
  font-family: inherit; font-weight: 600; font-size: 12.5px; line-height: 1; color: var(--ink-3); cursor: pointer;
}
.seg button[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.15); }

.input, .textarea {
  width: 100%; font: inherit; font-size: 14px; color: var(--ink);
  background: var(--surface); border: 1px solid var(--ink-3); border-radius: 8px;
  padding: 8px 10px; outline: none; transition: box-shadow .12s, border-color .12s;
}
.input::placeholder, .textarea::placeholder { color: var(--ink-3); }
.input:focus, .textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue); }
.input { margin-bottom: 12px; }
.textarea { min-height: 120px; resize: vertical; line-height: 1.5; animation: rise .18s ease; }
@keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.out { min-height: 64px; }
.hint { font-size: 13px; color: var(--ink-3); text-align: center; padding: 12px 8px; }
.kbd { font-family: inherit; font-weight: 600; font-size: 11px; line-height: 1; padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--ink-3); }
.loading { display: grid; gap: 8px; padding: 6px 0; }
.sk { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--line-2), var(--line), var(--line-2)); background-size: 200% 100%; animation: sk 1.1s linear infinite; }
.sk:nth-child(2) { width: 92%; } .sk:nth-child(3) { width: 70%; }
@keyframes sk { to { background-position: -200% 0; } }
.error { font-size: 13px; color: var(--red); background: var(--red-soft); border-radius: 8px; padding: 10px 12px; }
.counter { text-align: right; font-size: 12px; color: var(--ink-3); min-height: 18px; padding-top: 4px; }
.counter.over { color: var(--red); font-weight: 600; }

.foot { display: flex; gap: 8px; align-items: center; padding: 8px 16px 12px; }
.btn {
  height: 32px; padding: 0 16px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-weight: 600; font-size: 14px; line-height: 1;
  border: 1px solid transparent; transition: background .12s, box-shadow .12s, color .12s;
  display: inline-flex; align-items: center; gap: 6px;
}
.btn:disabled { opacity: .45; cursor: default; }
.btn.primary { background: var(--blue); color: #fff; }
.root.dark .btn.primary { color: #000; }
.btn.primary:not(:disabled):hover { background: var(--blue-hover); }
.btn.ghost { background: transparent; color: var(--ink-2); border-color: var(--ink-3); }
.btn.ghost:not(:disabled):hover { background: var(--line-2); box-shadow: inset 0 0 0 1px var(--ink-3); color: var(--ink); }
.btn.push { margin-left: auto; }
.status { padding: 0 16px 12px; font-size: 12px; color: var(--ink-3); min-height: 16px; }
.status.ok { color: var(--ok); }
[hidden] { display: none !important; }
`;
})();
