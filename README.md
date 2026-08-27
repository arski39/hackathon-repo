# Backpay

Freelance projects are agreed in scattered messages and never written down.
Backpay turns the conversation into a record of what was agreed, and the record
into whatever you need to send.

Paste the thread, or type it in if the whole thing was agreed on a call. You get
back a structured record where every number points at the sentence it came from.
From there it becomes a quote, a scope summary, invoice line items, a chase
email, or a plain "here's what we agreed" reply for when a client misremembers.

Invoicing is one output among several. It is not the point.

**Live:** https://YOUR-USERNAME.github.io/backpay/

## Nothing sends. Nothing charges.

Backpay drafts and displays. It has no send button, no payment integration, and
no access to your email or bank. When something is ready, you copy it and send it
yourself from your own client. That's deliberate and it is not going to change.

Everything the model produces is a draft, never truth. Every field is editable,
and every extracted value shows the exact sentence in the thread it came from, so
you can check that nobody invented a price.

## Where your text goes

Your thread text is sent to Anthropic to be read, using your own API key. It goes
nowhere else. There is no Backpay server. Everything you create stays in this
browser, and nothing about how you use this app is recorded or sent anywhere.

No analytics, no telemetry, no error reporting, no third-party scripts — the
fonts are self-hosted rather than loaded from a CDN for exactly this reason. The
only outbound request the app makes is to `api.anthropic.com`.

There is also a **redaction toggle**, off by default, which swaps client names
and email addresses for placeholders before the thread is sent and puts them back
locally. It is best-effort pattern matching, not anonymisation: a client
mentioned only by a nickname will go through untouched.

## Running it locally

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173/backpay/
npm run build    # type-check and produce dist/
npm run lint
npm run check    # parse -> validate -> totals -> redaction round trip
```

## Demo Mode

Demo Mode is on by default and needs no API key. It serves canned fixture
responses with a short artificial delay and makes no network call at all. It's
the safe path for a demo on bad wifi, and it's how you try the app without
signing up for anything.

## Bring your own key

To run it against the real model, paste your own Anthropic API key into the
settings panel.

**The honest caveat:** Backpay is a static site with no backend, so your key is
stored in your browser's `localStorage` and sent directly from your browser to
`api.anthropic.com` (using the `anthropic-dangerous-direct-browser-access`
header). It never reaches a server of ours, because there isn't one. But it does
live in your browser, where any script running on this origin could read it. Use
a key scoped to a low spend limit, and revoke it when you're done.

This pattern is acceptable because the key is *yours* and you chose to paste it.
It would not be acceptable if we shipped a key of our own.

## Deliberately not built

No real payments, no Stripe, no bank integration, no accounting export, no
legally binding contracts, no accounts, no login. Not stubbed — absent.

**No time tracking, ever.** We don't know how long anything took, so there is no
effective hourly rate and no true project cost. A number derived from hours
nobody measured is invention, which is the one thing this tool exists not to do.

**No VAT.** Most Finnish freelancers invoice through a laskutuspalvelu that
handles it automatically, so a VAT figure here would be noise at best and a
second, disagreeing number at worst. Amounts are the amounts you agreed.

Chase emails are drafts, not legal notices.

## Deploying your own

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes
to GitHub Pages.

One thing you must do by hand the first time, because it cannot be set from code:
**Settings → Pages → Source: GitHub Actions.** Until you do, the deploy job
fails.

If you fork this under a different repo name, change `base` in
[`vite.config.ts`](vite.config.ts) to match, or every asset will 404.

## Stack

Vite + React + TypeScript, Tailwind CSS v4, `localStorage` for persistence, a
print stylesheet for PDFs. No router — GitHub Pages 404s on client-side routes,
so views switch on state.
