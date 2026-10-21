// Smoke test: loads the unpacked extension in headless Chromium, fakes
// LinkedIn and X pages (fixtures/), mocks the Groq API, and drives the UI.
// Usage: node scripts/smoke-test.mjs   (needs the `playwright` package)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(here, '../extension');
// Playwright only routes service-worker fetches with this flag.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = await import('playwright');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'notidem-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'nt-')), {
  headless: true,
  channel: process.env.CHROMIUM ? undefined : 'chromium',
  executablePath: process.env.CHROMIUM || undefined,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'],
  viewport: { width: 1280, height: 800 },
});
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const ok = (m) => console.log('ok  -', m);

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
ok(`extension loaded (${extId})`);

// Mock the AI provider. Service-worker fetches go through the context router.
let lastPrompt = null;
await ctx.route('https://api.groq.com/**', async (route) => {
  lastPrompt = JSON.parse(route.request().postData());
  await route.fulfill({ json: { choices: [{ message: { content: '"Deleting unowned flaky tests is the underrated move here."' } }] } });
});
const fixture = (name) => async (route) => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(here, 'fixtures', name)) });
await ctx.route('https://www.linkedin.com/**', fixture('linkedin.html'));
await ctx.route('https://x.com/**', fixture('x.html'));

const errors = [];
ctx.on('weberror', (e) => errors.push(String(e.error())));

// ---- Options page: profile + key ---------------------------------------
const opt = await ctx.newPage();
opt.on('pageerror', (e) => errors.push('options: ' + e.message));
await opt.goto(`chrome-extension://${extId}/src/ui/options.html#profile`);
await opt.fill('#name', 'Paul Pessoa');
await opt.fill('#headline', 'Senior Frontend Engineer · React, TypeScript, AI');
await opt.fill('#bio', 'Frontend developer with 8+ years building SaaS products in React and TypeScript. Open-source author of Notidem.');
await opt.fill('#expertise-input', 'React, TypeScript, Design systems');
await opt.press('#expertise-input', 'Enter');
await opt.click('#goal-chips .chip[data-id="network"]');
await opt.waitForTimeout(700);
await opt.screenshot({ path: path.join(SHOTS, 'options-profile.png') });
const level = await opt.textContent('#strength-level');
ok(`profile saved, strength = ${level}`);

await opt.goto(`chrome-extension://${extId}/src/ui/options.html#context`);
await opt.setInputFiles('#file-input', { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# About me\nI led the migration of a 200-screen app to a shared design system.') });
await opt.waitForSelector('.file');
await opt.click('#add-link');
await opt.fill('.link-row [data-k="label"]', 'Notidem');
await opt.fill('.link-row [data-k="url"]', 'https://github.com/paulpessoa/notidem');
await opt.waitForTimeout(700);
await opt.screenshot({ path: path.join(SHOTS, 'options-context.png') });
ok('context file + link added');

await opt.goto(`chrome-extension://${extId}/src/ui/options.html#ai`);
await opt.fill('#key-groq', 'gsk_test_123');
await opt.click('#save-keys');
await opt.waitForTimeout(300);
await opt.screenshot({ path: path.join(SHOTS, 'options-ai.png') });

await opt.goto(`chrome-extension://${extId}/src/ui/options.html#networks`);
await opt.click('.vote[data-id="instagram"]');
await opt.waitForSelector('.voted');
await opt.screenshot({ path: path.join(SHOTS, 'options-networks.png') });
ok('instagram vote recorded');
const preview = await opt.textContent('#preview');
if (!preview.includes('Paul Pessoa') || !preview.includes('design system')) fail('preview missing profile/file text');
else ok('"What the AI sees" preview includes profile + file');

// ---- LinkedIn fixture ----------------------------------------------------
const li = await ctx.newPage();
li.on('pageerror', (e) => errors.push('linkedin: ' + e.message));
await li.goto('https://www.linkedin.com/feed/');
const trig = li.locator('.notidem-host >> .trigger');
await trig.waitFor({ timeout: 5000 });
ok('LinkedIn trigger injected');
await trig.click();
const panel = li.locator('.notidem-host >> .panel');
await panel.waitFor();
const ctxText = await li.locator('.notidem-host >> .ctx-meta').textContent();
if (!ctxText.includes('Jane Doe')) fail('author not detected: ' + ctxText); else ok('post author detected');
await li.locator('.notidem-host >> .chip[data-value="question"]').click();
await li.locator('.notidem-host >> .generate').click();
await li.locator('.notidem-host >> .textarea').waitFor({ timeout: 8000 }).catch(async (e) => {
  console.error('panel output:', await li.locator('.notidem-host >> .out').textContent());
  throw e;
});
const draft = await li.locator('.notidem-host >> .textarea').inputValue();
if (draft.startsWith('"')) fail('quotes not stripped'); else ok('draft generated: ' + draft);
const sys = lastPrompt.messages[0].content;
if (!sys.includes('Ask one thoughtful') || !sys.includes('Paul Pessoa') || !sys.includes('Platform: LinkedIn')) fail('system prompt missing goal/profile/platform');
else ok('prompt has goal, profile and platform');
await li.waitForTimeout(400);
await li.screenshot({ path: path.join(SHOTS, 'linkedin-panel.png') });
await li.locator('.notidem-host >> .insert').click();
await li.waitForTimeout(200);
const inEditor = await li.textContent('.ql-editor');
if (!inEditor.includes('Deleting unowned')) fail('insert failed'); else ok('draft inserted into LinkedIn editor');

// ---- X fixture -------------------------------------------------------------
const x = await ctx.newPage();
x.on('pageerror', (e) => errors.push('x: ' + e.message));
await x.goto('https://x.com/samlee/status/123');
const xt = x.locator('.notidem-host >> .trigger');
await xt.waitFor({ timeout: 5000 });
ok('X trigger injected in toolbar');
await xt.click();
await x.locator('.notidem-host >> .generate').click();
await x.locator('.notidem-host >> .textarea').waitFor({ timeout: 5000 });
const counter = await x.locator('.notidem-host >> .counter').textContent();
if (!counter.includes('/ 280')) fail('X counter missing: ' + counter); else ok('X 280 counter: ' + counter);
if (!lastPrompt.messages[0].content.includes('280 characters')) fail('X prompt lacks limit'); else ok('X prompt has 280 limit');
const dark = await x.locator('.notidem-host >> .root.dark').count();
if (!dark) fail('dark theme not detected on X'); else ok('dark theme follows host page');
await x.waitForTimeout(400);
await x.screenshot({ path: path.join(SHOTS, 'x-panel.png') });

// ---- Popup -----------------------------------------------------------------
const pop = await ctx.newPage();
pop.on('pageerror', (e) => errors.push('popup: ' + e.message));
await pop.setViewportSize({ width: 380, height: 640 });
await pop.goto(`chrome-extension://${extId}/src/ui/popup.html`);
await pop.fill('#source', 'Just shipped our first open-source library after two years of internal use. Lessons in thread.');
await pop.click('#generate');
await pop.waitForSelector('#output textarea', { timeout: 5000 });
await pop.waitForTimeout(400);
await pop.screenshot({ path: path.join(SHOTS, 'popup.png') });
ok('popup quick draft works');

// ---- History -----------------------------------------------------------------
await opt.goto(`chrome-extension://${extId}/src/ui/options.html#history`);
await opt.waitForSelector('.hentry');
await opt.screenshot({ path: path.join(SHOTS, 'options-history.png') });
ok(`history entries: ${await opt.locator('.hentry').count()}`);

// ---- v1 -> v2 migration -------------------------------------------------------
await opt.evaluate(() => new Promise((r) => chrome.storage.local.set({ profile: { manualText: 'Old bio', tone: 'Dry', pdfText: 'CV text here', pdfName: 'cv.pdf' } }, r)));
await opt.goto(`chrome-extension://${extId}/src/ui/options.html#context`);
await opt.reload(); // same-document hash change would not re-read storage
await opt.waitForSelector('.file');
const migrated = await opt.evaluate(() => new Promise((r) => chrome.storage.local.get('profile', (d) => r(d.profile))));
if (migrated.version !== 2 || migrated.bio !== 'Old bio' || migrated.files[0].name !== 'cv.pdf') fail('migration wrong');
else ok('v1 profile migrated to v2');

if (errors.length) fail('page errors:\n' + errors.join('\n')); else ok('no page errors');
console.log('screenshots in', SHOTS);
await ctx.close();
