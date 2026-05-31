# Notidem: the opposite of "idem"

Most replies on LinkedIn cost nothing and mean nothing. "Idem." "Great post!" "Totally agree." We've all sent them, usually out of guilt or habit, and they do roughly nothing for the relationship on the other side.

I wanted the opposite. A reply that's actually mine — specific to the post, grounded in who I am, the kind of thing that makes someone reply back. So I built an open-source Chrome extension to help me write those, and named it after the thing it refuses to be: **Notidem**.

## What it is

Notidem drafts genuine LinkedIn comments and message replies with AI, in your own voice. You open a post or a conversation, pick what you want the reply to do — add an insight, share an experience, ask a question, propose a next step — and it gives you a draft built from the context in front of you and a short profile you set up once.

Then you read it, edit it, and post it yourself. That last part matters, and it's the whole philosophy: **Notidem drafts; you decide.** It never posts, sends, or acts on your behalf. There is a human in the loop at every step, by design.

## Why "in your own voice" is the point

The easy version of this product writes for you. The useful version writes *as* you. Notidem treats your profile and résumé as quiet context — enough to color the tone and lend credibility when it's relevant — without ever pasting your CV back into a comment. The goal isn't to sound impressive. It's to sound like you, on a good day, with time to think.

## Helping people connect from their essence

LinkedIn rewards volume, and volume rewards templates. But relationships don't grow from templates — they grow from specific, human responses to specific, human things. The bet behind Notidem is that if you lower the friction of writing a *genuine* reply, people will leave more of them, and their networks will be warmer for it.

That's also why the roadmap goes toward **per-context profiles**: the same person is a candidate in one conversation, a recruiter in another, in sales in a third. Each of those has a different voice and a different intent, and Notidem will let you keep them distinct — mirroring how LinkedIn's audiences actually work.

## The hard part: building on a platform you don't control

The interesting engineering wasn't the AI. It was surviving LinkedIn.

**The editor moved underneath me.** LinkedIn's comment box has changed rich-text engines more than once — ProseMirror, then back to Quill — with no announcement. Each engine keeps an internal document model, and the visible DOM is downstream of it. The naive approach (write your text into the box) corrupts that model: the next keystroke triggers a re-render against a state that disagrees with the DOM, and the box can crash or silently drop your text. The fix is to never write the DOM directly — instead, dispatch a synthetic paste event so the text flows through the editor's own model. Notidem detects which engine is in play and inserts safely.

**The text wasn't where I looked.** At one point detection broke completely — every post read as empty. The cause: LinkedIn hydrates the feed with React, and the post text isn't in the obvious container until it's painted; some of it sits in hidden hydration templates. Chasing class names was a losing game because they get renamed without notice. The robust answer was to stop trusting class names and instead climb up from the comment box, grab the largest block of *actually visible* text, and ignore anything hidden or inside the comments section. As a guaranteed fallback, if detection ever fails, you can just select the text with your mouse and Notidem uses that.

**The lesson:** when you build against a platform, its DOM is not an API. It's weather. You design for it to change, lean on the most stable signals you can find (structure and visibility, not class names), and always leave the user an escape hatch.

## Privacy, honestly

Notidem uses your own AI provider key, and I wanted to be straight about how it's protected rather than sell security theater.

The key never touches the LinkedIn page — all of it is handled in the extension's isolated background worker, so no page script can read it. It's encrypted at rest, stored only locally (never synced to the cloud), and never logged. No Notidem server sits between you and the AI provider; we never see your key, your text, or your drafts.

The honest limit: no browser extension can fully protect a key from malware already running on your machine, because to *use* a key it has to be decrypted in the browser. So the advice is simple — use a scoped key with a low spend limit, and remove it when you're done. For people who'd rather not handle a key at all, an optional hosted mode is on the roadmap, where the key lives on a server and never in the browser.

## Compliance

Notidem is deliberately the opposite of the mass-outreach tools LinkedIn's systems flag. It reads only what's already on your screen, drafts text you must review, and automates nothing. Under LGPD/GDPR, the data is processed locally and transiently, under your consent, with no backend collecting anything — and you can erase everything with one click.

## It's open source

The whole thing is open and auditable, MIT-licensed. You can read every line, check the data-flow diagram in the repo, and see exactly where your data goes (and doesn't). If you want to try it before it clears the Chrome Web Store review, there's a packaged build in the releases.

If you've ever typed "idem" and felt a little bad about it — this is for you.
