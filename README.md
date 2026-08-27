# Backpay

Backpay takes the messy client conversations a freelance creative already has,
and turns them into the money paperwork they hate doing: a quote, a scope,
milestone invoices, and the chase email nobody wants to write.

Money admin is objective work with subjective pain. The rules are deterministic
— this scope costs this much, this invoice is 40 days late — but doing it feels
awful, because it means pricing your own work and asking people for money.
Backpay does the mechanical part so you only have to approve it.

**Live:** https://YOUR-USERNAME.github.io/backpay/

## Nothing sends. Nothing charges.

Backpay drafts and displays. It has no send button, no payment integration, and
no access to your email or bank. When an invoice or a chase email is ready, you
copy it and send it yourself from your own client. That's deliberate and it is
not going to change.

Everything the AI produces is a first draft. Every generated field is editable,
and every extracted value shows the exact sentence in the thread it came from,
so you can check that nobody invented a price.

## Running it locally

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173/backpay/
npm run build    # type-check and produce dist/
npm run lint
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
legally binding contracts, no email OAuth, no accounts, no login. Not stubbed —
absent.

The VAT figure Backpay shows is a set-aside estimate to help you park money, not
tax advice. The chase emails are drafts, not legal notices.

## Deploying your own

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes
to GitHub Pages.

One thing you must do by hand the first time, because it cannot be set from
code: **Settings → Pages → Source: GitHub Actions.** Until you do, the deploy job
fails.

If you fork this under a different repo name, change `base` in
[`vite.config.ts`](vite.config.ts) to match, or every asset will 404.

## Stack

Vite + React + TypeScript, Tailwind CSS v4, `localStorage` for persistence, a
print stylesheet for PDFs. No router — GitHub Pages 404s on client-side routes,
so views switch on state.
