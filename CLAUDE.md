# CLAUDE.md — Backpay

Build spec for Claude Code. Read this fully before writing any code. Follow the phases in order.

---

## 1. What we're building

**Backpay** is a static web app that takes the messy client conversations a freelance creative already has, and turns them into the money paperwork they hate doing: a quote, a scope, milestone invoices, and the chase email nobody wants to write.

**One-line pitch:** Money admin is objective work with subjective pain. The rules are deterministic — this scope costs this much, this invoice is 40 days late — but doing it feels awful, because it means pricing your own work and asking people for money. Backpay does the mechanical part so the creator only has to approve it.

**The demo moment everything serves:** a chaotic, lowercase, no-punctuation client message goes in; a clean quote, a scope-creep flag, and a drafted chase email come out. Ten seconds. Every build decision should protect that moment.

### Non-negotiable product rules

- **Nothing sends. Nothing charges.** Backpay drafts and displays. The human clicks the real send button in their own email client. This is the trust story — do not build auto-send, even as a stub. This holds *especially* once an inbox is connected (§12): read scopes only, never a send scope, no exceptions.
- **Every extracted field shows its source.** If the AI decided the rate is €2000, the user can see the exact sentence in the thread that said so. This is the core trust mechanism and the signature UI element (see §6).
- **The user can edit everything.** AI output is a first draft, always. Every generated field is an editable input, never read-only text.

### Explicitly out of scope

Do not build these, and do not stub them: real payments, Stripe, bank integration, accounting export, legally binding contracts, multi-user accounts, login.

**Amended 2026-08-27:** email OAuth was on this list and has been taken off it deliberately. Read-only inbox connection is now a planned feature — see §12 for the terms it has to meet. It is still out of scope for Phases 0–6 and nothing about it may be stubbed before Phase 6 ships.

---

## 2. Constraints

- **Hosting: GitHub Pages.** Static only. No server, no serverless functions, no database.
- **Free.** Nothing in the stack may require a paid plan.
- **The repo is public and the user is watching commits.** Commit hygiene matters (see §9).
- **No secrets in the repo. Ever.** Not in code, not in `.env`, not in a commit that gets reverted later.

### How we call the AI without a backend

Bring-your-own-key. The user pastes their own Anthropic API key into a settings panel; it lives in `localStorage` on their machine and is sent directly from their browser to the API. This requires the header `anthropic-dangerous-direct-browser-access: true`.

This is an acceptable pattern for a BYOK demo tool. It would not be acceptable if we shipped our own key. Make that distinction visible in the UI copy.

Alongside it, build **Demo Mode**: a toggle that serves canned fixture responses with a short artificial delay, no network call, no key needed. Demo Mode is the default on first load. It exists because hackathon wifi fails and live API calls are the single most likely thing to break on stage.

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite + React + TypeScript | |
| Styling | Tailwind CSS | |
| Routing | **None** | State-based view switching. GitHub Pages 404s on client-side routes. Do not add react-router. |
| State | React state + a `useLocalStorage` hook | |
| Persistence | `localStorage` | |
| PDF | Print stylesheet + `window.print()` | Do not add a PDF library. A well-styled print view is faster and looks better. |
| Deploy | GitHub Actions → GitHub Pages | |

### Model

Use `claude-sonnet-5` for extraction and drafting. Fall back to `claude-haiku-4-5-20251001` if latency in the demo is a problem.

Before your first API call, verify current model IDs against `https://docs.claude.com/en/docs/about-claude/models`. If the ID above is wrong or deprecated, use the current one and note the change in the commit message. Do not guess.

---

## 4. Data model

Define this in `src/types.ts` first, before any UI. Everything else derives from it.

```ts
type Provenance = {
  quote: string;        // exact substring from the source thread
  messageId: string;    // which message it came from
};

type Deliverable = {
  id: string;
  description: string;  // "3 vertical reels, 15s each"
  quantity: number;
  unitPrice: number;    // in cents, always
  source?: Provenance;
};

type Deal = {
  id: string;
  clientName: string;
  projectName: string;
  status: 'draft' | 'quoted' | 'agreed' | 'delivered' | 'closed';
  deliverables: Deliverable[];
  revisionsIncluded: number;
  deadline: string | null;      // ISO date
  usageRights: string | null;   // "social only, 6 months, FI" — often unstated; flag when missing
  paymentTerms: {
    depositPercent: number;     // 0 if none
    netDays: number;            // 14 is the Finnish default
  };
  currency: 'EUR';
  vatRatePercent: number;
  notes: string;
  sourceThread: Message[];
  createdAt: string;
};

type Message = {
  id: string;
  from: 'client' | 'creator';
  sender: string;
  body: string;
  receivedAt: string;
};

type Invoice = {
  id: string;
  dealId: string;
  number: string;               // "2026-001"
  kind: 'deposit' | 'balance' | 'change-order';
  lineItems: Deliverable[];
  issuedAt: string;
  dueAt: string;
  status: 'draft' | 'sent' | 'paid';
  paidAt: string | null;
};

type ScopeFlag = {
  id: string;
  dealId: string;
  messageId: string;
  whatWasAsked: string;
  whyItsOutOfScope: string;
  suggestedPrice: number;       // cents
  status: 'open' | 'billed' | 'dismissed';
};
```

### Money rules

- Store all money as **integer cents**. Never floats.
- Format with `Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' })`.
- VAT: Finland's general rate is **25.5%**. Put it in one constant in `src/config.ts`, make it editable in settings, and label it clearly as a user-checkable assumption. Do not hardcode it in three places.
- The VAT figure shown is a **set-aside estimate**, not tax advice. Say so in the UI, once, quietly.
- Invoice due date default: **net 14** from issue date.

---

## 5. Features, in build order

Build these in sequence. Each one must work end to end before you start the next. Do not build UI shells for later phases.

### Phase 0 — Skeleton

Vite project, Tailwind, types, design tokens, empty shell that deploys to GitHub Pages successfully. **Deploy before writing features.** A working deploy on day one is worth more than a working feature on day two.

### Phase 1 — Thread in, Deal out

- A single large textarea: "Paste the client thread."
- Parse it into `Message[]` (split on blank lines and `From:` / `On ... wrote:` patterns; be forgiving, this is messy input).
- Send to Claude with the extraction prompt (§7), get back a `Deal` as strict JSON.
- Validate the JSON against the schema. If it fails, retry once with the validation error appended. If it fails again, show what came back and let the user fix it by hand. Never crash on bad model output.
- Render the Deal on an editable review screen, every field with its provenance.

### Phase 2 — Quote

- A clean quote view: line items, subtotal, VAT, total, payment terms, deadline, usage rights.
- If `usageRights` is null, show a prominent nudge: unstated usage rights are how creatives get underpaid.
- Print stylesheet so `window.print()` produces something you'd actually send a client.

### Phase 3 — Invoices

- Generate deposit and balance invoices from an agreed Deal.
- Sequential numbering, `YYYY-NNN`, persisted.
- Mark as sent / mark as paid. Manual only.

### Phase 4 — The chase

This is the emotional payoff. Do not rush it.

- Any overdue invoice gets a "Draft a nudge" action.
- A **tone control** with three named steps: `Friendly` → `Firm` → `Formal notice`. Name them in the UI exactly like that.
- Claude drafts the email at that tone, using real numbers (invoice number, amount, days overdue, original agreement date).
- Output is a copyable block plus a `mailto:` link. It does not send.

### Phase 5 — Scope creep

- On a Deal page, "Add a new message from the client."
- Claude compares it against the agreed deliverables and returns zero or more `ScopeFlag`s.
- Each flag offers: draft a change order at the suggested price, or dismiss.

### Phase 6 — Dashboard

- Three numbers: **owed**, **overdue**, **expected in the next 60 days**.
- A list of open deals and their next action.
- VAT set-aside estimate.
- Seed with fixture data so it is never empty in the demo.

### Stretch, only if all six are solid

Rate benchmarking. Multi-currency. Recurring retainers. Leave these alone until Phase 6 ships.

---

## 6. Design direction

The brief is *calm*. The user comes to this app already stressed about money. The interface should feel like someone competent quietly handling it.

**The governing rule: the only loud thing on screen is money you are owed but haven't been paid.** Everything else is quiet. Overdue amounts are the single point of saturation in the entire UI. Do not spend color anywhere else.

### Tokens

Put these in `tailwind.config.js` as named tokens and use the names everywhere. No raw hex in components.

```
paper     #F5F4F7   cool off-white — NOT cream, this is not a stationery app
ink       #1A1B2E   deep indigo-black, all primary text
slate     #6B6C82   secondary text, labels
line      #DEDDE6   hairlines, borders
overdue   #D6265E   the one loud color. Overdue money only.
paid      #2F8F6F   muted, deliberately less exciting than overdue
```

### Type

- **Display:** Bricolage Grotesque (Google Fonts). Headings and the three dashboard numbers. Used with restraint.
- **Body/UI:** Inter (Google Fonts).
- **Money and dates:** IBM Plex Mono with `font-variant-numeric: tabular-nums`. Every euro figure in the app is mono. This is functional (columns align) and it reads as a ledger.

Self-host or use the Google Fonts CDN — both are free and both work on Pages.

### Signature element: provenance lines

On the Deal review screen, the layout is two columns: the raw messy thread on the left, the clean structured Deal on the right.

Hovering or focusing any extracted field on the right highlights the exact source sentence on the left, and draws a hairline connecting them. Keyboard accessible, not hover-only.

This is the one memorable thing in the product. It is also the trust mechanism — it's how the user believes the AI didn't invent the price. Spend your effort here and keep everything around it disciplined.

### What to avoid

Do not produce the current AI-design default: warm cream background, high-contrast serif display, terracotta accent. Also avoid near-black with a single acid-green accent, and the hairline-ruled broadsheet look. The tokens above already steer away from all three — stay on them.

### Copy

Plain, active, specific. Buttons say what happens: "Draft the nudge", not "Generate". The action keeps its name through the flow. Empty states are invitations, not apologies: an empty dashboard says "Paste your first client thread to see what you're owed."

### Quality floor

Responsive to mobile. Visible keyboard focus rings. `prefers-reduced-motion` respected. Don't announce any of this, just do it.

---

## 7. Prompting rules

All prompts live in `src/prompts/`, one file per task, exported as template functions. Never inline a prompt in a component.

For every extraction call:

- Give Claude the **exact JSON schema** and instruct: return only JSON, no prose, no markdown fences.
- Strip ` ```json ` fences defensively anyway before parsing.
- Require a `source` object on every field that came from the thread, containing the **verbatim substring**. If Claude can't find a supporting substring, it must return `null` for that field rather than inventing one. This rule is what makes provenance lines honest.
- Instruct it to leave `usageRights` and `deadline` as `null` when unstated rather than guessing. Missing information is a feature — we surface the gap to the user.
- Set `max_tokens: 4096`.

For the chase email:

- Pass the real invoice data. Never let the model invent a number.
- The three tones are distinct in *strategy*, not just adjectives:
  - **Friendly** — assumes it slipped through, gives them an easy out, no consequence mentioned.
  - **Firm** — states the days overdue plainly, restates the agreed terms, asks for a specific payment date.
  - **Formal notice** — references the agreement, states the amount and the deadline, notes that late payment interest applies. Neutral and unemotional.
- Never threaten legal action. Never claim a specific statutory interest rate — say "late payment interest as per the agreed terms" and leave the number to the user.

---

## 8. Repo and deployment

### Setup

```bash
npm create vite@latest backpay -- --template react-ts
cd backpay
npm install
npm install -D tailwindcss @tailwindcss/vite
```

### `vite.config.ts`

The base path must match the repo name or every asset 404s on Pages:

```ts
export default defineConfig({
  base: '/backpay/',
  plugins: [react(), tailwindcss()],
});
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

After the first push, the user must enable Pages: **Settings → Pages → Source: GitHub Actions**. Tell them this in the README; it cannot be done from code.

### `.gitignore`

Must include `node_modules`, `dist`, `.env`, `.env.*`, `.DS_Store`.

### README.md

Write it for someone landing on the repo cold. Include: what it is, the live link, how to run it locally, how BYOK works and the honest security caveat, how Demo Mode works, and what's deliberately not built.

---

## 9. Working process

The user is following this repo commit by commit. Work in visible increments.

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **One commit per completed task**, not per phase. Small and legible beats large and tidy.
- **Push after every commit.** A green Actions run is the signal that a phase landed.
- **Update `PROGRESS.md` at the end of each phase** with: what shipped, what you decided and why, what's still broken. This is the file the user reads to follow along.
- If you hit a real fork in the road (a dependency doesn't work on Pages, an approach is a dead end), stop and ask rather than picking silently.

### Definition of done for a phase

1. Feature works end to end in Demo Mode.
2. Feature works end to end with a real API key.
3. Deployed and verified on the live Pages URL, not just localhost.
4. `PROGRESS.md` updated.

---

## 10. Fixtures

Build these early, in `src/fixtures/`. The demo depends on them more than on any feature.

**The hero thread.** A realistically awful client message. Lowercase, no punctuation, vague budget, unstated deadline, no usage rights mentioned. Something like: a client asking for "like 3 reels + some stills for the launch, budget-ish 2k, need it by the 12th?" Write it so the audience laughs in recognition.

**The scope-creep follow-up.** A second message, sent cheerfully two weeks later, casually adding two more deliverables as though they were always included.

**A seeded dashboard.** Four or five deals in different states, including at least one 40-days-overdue invoice, so the dashboard has a real shape and the overdue number is the one loud thing on screen.

Keep every fixture anonymous and invented. No real client names.

---

## 11. Guardrails

- Never commit an API key, in any form, at any point.
- Never add an auto-send or auto-charge path.
- Never present the VAT estimate as tax advice, or the chase email as a legal document.
- Never let a generated number appear without the user being able to trace or edit it.
- If model output fails validation twice, surface the raw output to the user. Don't paper over it with a fake fallback.

---

## 12. Client memory, themes, and inbox connection

Added 2026-08-27. **None of this is built before Phase 6 ships.** The data model
lands early (see below) so nothing has to be migrated out of `localStorage`
later; the features come after the six phases are solid.

### 12.1 What this is for

Backpay currently forgets everything between deals. The point of this section is
that it stops forgetting:

- **Client memory.** How long this client actually takes to pay, how often they
  add scope after agreeing, what you have historically charged them. A client
  who always pays on day 40 should make `Firm` the default tone on the chase,
  not `Friendly`.
- **Themes.** The same deliverable recurs across clients — "15s vertical reel"
  shows up in nine deals at seven different prices. Surfacing that is a rate
  card built from your own history, which is the honest version of §5's rate
  benchmarking stretch goal. It is your data, not someone else's benchmark.
- **Extraction gets better.** Known client context goes into the extraction
  prompt, so the next thread from the same client reads more accurately.

### 12.2 Derived, never asserted

Client insights and themes are **computed from deals and invoices on read**, not
stored as fields that can drift. If the number of days-to-pay is wrong, the fix
is in the invoice data, not in a cached summary. Only identity is persisted:
name, email addresses, notes.

The provenance rule from §1 extends here without exception. A learned claim
("Nina pays around day 38") must name the invoices it was computed from, the
same way an extracted price names its sentence. A statistic the user cannot
trace back to specific rows is exactly the kind of confident-sounding invention
this product exists to avoid. **Never show a learned number derived from fewer
than three data points** — say "not enough history yet" instead. Two invoices is
an anecdote wearing a median's clothes.

### 12.3 Inbox connection — the terms

Read-only Gmail connection via Google Identity Services, using the token model.
It has to meet all of these:

- **Read scopes only.** `gmail.readonly`. A send scope is never requested, not
  even to "make the chase easier". The whole trust story is that the human
  sends. Asking for inbox access and send access in the same consent screen
  destroys it.
- **Static-compatible.** The GIS token model needs no client secret and no
  backend, which keeps §2 intact. The OAuth **client ID is not a secret** and
  may be committed; nothing else about this may be.
- **Nothing leaves the browser.** Message bodies go to `localStorage` and to
  Anthropic for extraction, exactly like a pasted thread does today. No third
  destination appears without the user being told in the UI.
- **Import is explicit and reviewable.** Backpay never silently ingests a whole
  mailbox. The user picks threads to import, sees what was pulled, and can
  delete it. Imported messages are marked as imported.
- **Disconnect actually disconnects.** One control that revokes the token and
  deletes what was imported. Not a flag that hides it.
- **The pasted-thread path never goes away.** Inbox connection is an
  alternative input, never a requirement. Demo Mode must still work with no
  Google account at all — the demo cannot depend on an OAuth consent screen.

### 12.4 Known unknowns — resolve before building

- `gmail.readonly` is a **Restricted** scope. Google's own documentation is
  inconsistent about whether the annual CASA security assessment applies to an
  app that never stores or transmits scope data server-side: the scopes page
  conditions it on server storage, the verification page states it flatly. That
  ambiguity is the difference between free and not, so **ask Google directly
  before building**, and record the answer here.
- Unverified apps show a full-screen warning and are capped to a test-user list.
  Acceptable for personal use and demos, not for public launch.
- No refresh tokens in the token model: access tokens are short-lived and the
  user re-consents each session. Design for that rather than fighting it.

If verification turns out to cost money, this feature stops and we talk. §2 says
free, and §2 has not been amended.

### 12.5 Guardrails specific to this section

- Never request a Gmail send or modify scope.
- Never persist an OAuth access token to `localStorage`. Memory only.
- Never show a learned statistic without the rows behind it.
- Never let inbox connection become a prerequisite for any Phase 0–6 feature.
