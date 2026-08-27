# CLAUDE.md — Backpay

Build spec for Claude Code. Read this fully before writing any code. Follow the phases in order.

**This file is the intent. `PROGRESS.md` is the state** — what has shipped, what
was decided along the way, and what is currently broken. Read both before
picking up work. Where this file and the code disagree, it is usually because a
decision was made and recorded in `PROGRESS.md`; check there before "fixing" the
code to match the spec.

> **Restructured 2026-08-27.** The product was repositioned: Backpay is a record
> of what was agreed, and documents are outputs generated from it. §1, §5 and §6
> were rewritten, §3 is new, `Deal` became `ProjectRecord`, VAT was removed
> entirely, and **every section after §2 shifted down by one number**. Code and
> notes written against the old numbering or the name `Deal` are out of date by
> decision, not by accident.

---

## 1. What we're building

**Backpay** is a record of what was agreed on a freelance project, built from the
scattered messages where the agreement actually happened. Quotes, scope
summaries, invoice line items, chase emails and plain "here's what we agreed"
replies are **outputs generated from that record**.

Invoicing is one output among several. It is not the point.

**One-line pitch:** Freelance projects are agreed in scattered messages and never
written down, which is why 67% of freelancers do unpaid work they can't bill for.
Backpay turns the conversation into a record, and the record into whatever you
need to send.

> **Source the 67% before it goes on a slide or in the README.** This spec
> requires every number in the *product* to be traceable (§1, §8, §13.2). Opening
> the pitch with an uncited statistic breaks our own rule in front of the one
> audience most likely to ask where it came from. Find the study and cite it, or
> say "most freelancers" and lose nothing.

**The demo moment everything serves:** a chaotic, lowercase, no-punctuation
client message goes in, and a structured record comes out with every number
traceable to the sentence that produced it. Then a cheerful follow-up arrives two
weeks later adding work nobody agreed to — and the record catches it. Ten seconds
each. Every build decision should protect those two moments.

### Non-negotiable product rules

- **Every session ends in something the user can send or copy.** Never build a
  screen that only stores. If a flow ends in a saved record with no sendable
  artifact, the flow is wrong — go back and add the output before calling the
  phase done. A record nobody can send is a filing cabinet, and freelancers
  already have one of those.
- **Nothing sends. Nothing charges.** Backpay drafts and displays. The human
  clicks the real send button in their own email client. This is the trust story
  — do not build auto-send, even as a stub. This holds *especially* once an inbox
  is connected (§13): read scopes only, never a send scope, no exceptions.
- **Every extracted field shows its source.** If the model decided the rate is
  €2000, the user can see the exact sentence in the thread that said so. This is
  the core trust mechanism and the signature UI element (see §7).
- **The record is a draft, never truth.** Extraction is one way to populate a
  record. Typing it in by hand is another — many creative deals are agreed on a
  call and never appear in writing at all. Every field on a record is creatable
  and editable by hand, whatever its origin, and no UI copy may imply the record
  is authoritative (§8).

### Explicitly out of scope

Do not build these, and do not stub them: real payments, Stripe, bank
integration, accounting export, legally binding contracts, multi-user accounts,
login.

**Time tracking is permanently out of scope.** We do not know how long anything
took and we are not going to start asking. No field, metric or output may depend
on hours worked — no effective hourly rate, no true project cost, no "you earned
€X/hour on this". A number derived from hours we never measured is invention,
which is the one thing this product exists not to do.

**Amended 2026-08-27:** email OAuth was on the out-of-scope list and has been
taken off it deliberately. Read-only inbox connection is now a planned feature —
see §13 for the terms it has to meet. It is still out of scope for Phases 0–6 and
nothing about it may be stubbed before Phase 6 ships.

---

## 2. Constraints

- **Hosting: GitHub Pages.** Static only. No server, no serverless functions, no database.
- **Free.** Nothing in the stack may require a paid plan.
- **The repo is public and the user is watching commits.** Commit hygiene matters (see §10).
- **No secrets in the repo. Ever.** Not in code, not in `.env`, not in a commit that gets reverted later.

### How we call the AI without a backend

Bring-your-own-key. The user pastes their own Anthropic API key into a settings
panel; it lives in `localStorage` on their machine and is sent directly from
their browser to the API. This requires the header
`anthropic-dangerous-direct-browser-access: true`.

This is an acceptable pattern for a BYOK demo tool. It would not be acceptable if
we shipped our own key. Make that distinction visible in the UI copy.

Alongside it, build **Demo Mode**: a toggle that serves canned fixture responses
with a short artificial delay, no network call, no key needed. Demo Mode is the
default on first load. It exists because hackathon wifi fails and live API calls
are the single most likely thing to break on stage.

---

## 3. Privacy

The user is pasting their private business correspondence into this app. That is
a large amount of trust for a tool they met ninety seconds ago, and the only
thing that earns it is being able to say something simple and true about where
the text goes.

### The rules

- **Records live in `localStorage` and nowhere else.** No server, no database, no
  sync, no backup, no export-to-cloud.
- **No analytics. No telemetry. No error reporting service. No third-party
  scripts.** Not Plausible, not Sentry, not a font CDN (see §7 — the fonts are
  self-hosted for exactly this reason). The only outbound request the app ever
  makes is to the Anthropic API, with the user's own key. If a second hostname
  appears in the network tab, something is wrong.
- **The user's API key goes to Anthropic and nowhere else.** It is never logged,
  never included in a record, never rendered into an output document.

### What Settings must say

In plain language, unhedged, in roughly these words:

> Your thread text is sent to Anthropic to be read, using your own API key. It
> goes nowhere else. There is no Backpay server. Everything you create stays in
> this browser, and nothing about how you use this app is recorded or sent
> anywhere.

No "we may". No "certain data". No "in accordance with our policy". If a sentence
needs a lawyer to be true, either the sentence is wrong or the product is.

### Redaction

A toggle in Settings, **off by default**, that replaces detected client names and
email addresses with placeholders (`[Client]`, `[EMAIL_1]`) before the thread is
sent, and restores them locally in whatever comes back.

Say plainly that it is best-effort pattern matching, not a guarantee, and that it
will miss things. Do not call it anonymisation.

**One placeholder per spelling, cased to match.** The hero thread says
"From: Nina" and signs off "nina". Matching case-insensitively but restoring
both to "Nina" would rewrite the user's own words, and the restored quote would
no longer be a verbatim substring of the message it cites — so `Nina` becomes
`[Client]` and `nina` becomes `[client]`, each mapping back to exactly what it
replaced. Only client-side names are redacted: the user's own name is their own,
and the parser labels an unnamed creator "You", which would turn every "you" and
"you'd" in the thread into a placeholder.

**This interacts with provenance, and the interaction is load-bearing.** The model
returns verbatim quotes, and §8 requires every quote be verified as a real
substring before it is shown. With redaction on, the model has only ever seen the
redacted text, so its quotes are substrings of the *redacted* thread. The order
is fixed:

1. Redact, keeping the placeholder → original map **in memory only**.
2. Send the redacted text.
3. **Verify every returned quote against the redacted text that was actually
   sent** — not against the original. This step is what makes provenance honest
   and it must not move.
4. Restore placeholders in the verified output, including inside the quotes.
5. Highlight against the original thread in the review column.

Get that order wrong and every provenance line silently fails verification
whenever redaction is on, which will look like the model misbehaving rather than
a bug in our own pipeline. Off by default partly for this reason: it is the
riskier path, so it should be a deliberate choice.

---

## 4. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite + React + TypeScript | |
| Styling | Tailwind CSS **v4** | No `tailwind.config.js`. Tokens live in an `@theme` block in `src/index.css` — see §7. |
| Routing | **None** | State-based view switching. GitHub Pages 404s on client-side routes. Do not add react-router. |
| State | React state + a `useLocalStorage` hook | |
| Persistence | `localStorage` | Only. See §3. |
| Fonts | Self-hosted woff2 in `src/fonts/` | Not a CDN — §3 forbids third-party requests. `src/`, not `public/`, so Vite fingerprints them and rewrites the URLs under `base`. |
| PDF | Print stylesheet + `window.print()` | Do not add a PDF library. A well-styled print view is faster and looks better. |
| Deploy | GitHub Actions → GitHub Pages | |
| Lint | oxlint | Ships with the Vite template. `npm run lint`. |
| Checks | `npm run check` | Smoke test over parse → validate → totals. Runs esbuild via `npx`, adds no dependency. |

### Model

Use `claude-sonnet-5` for extraction and drafting. Fall back to
`claude-haiku-4-5-20251001` if latency in the demo is a problem.

Before your first API call, verify current model IDs against
`https://docs.claude.com/en/docs/about-claude/models`. If the ID above is wrong or
deprecated, use the current one and note the change in the commit message. Do not
guess.

**Verified 2026-08-27:** both IDs above are current. Re-check if months pass.

---

## 5. Data model

Define this in `src/types.ts` first, before any UI. Everything else derives from
it.

**The product noun is "record". The TypeScript type is `ProjectRecord`.** Do not
rename it to `Record` to match the prose: `Record<K, V>` is a TypeScript built-in
utility type, and declaring our own would shadow it in every file that imports
ours — `Partial<Record<K, V>>` is already used in `src/types.ts`. The UI, the
copy and the commit messages say "record"; the type says `ProjectRecord`.

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
  priceSource?: Provenance;
};

type ProjectRecord = {
  id: string;
  origin: 'extracted' | 'manual';
  clientId: string | null;
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
  notes: string;
  sourceThread: Message[];      // [] on a record started blank
  fieldSources?: RecordFieldSources;
  absorbedWork: AbsorbedItem[];
  createdAt: string;
};

type Message = {
  id: string;
  from: 'client' | 'creator';
  sender: string;
  body: string;
  receivedAt: string;
  external?: ExternalRef;       // set when imported rather than pasted (§13)
};

type Invoice = {
  id: string;
  recordId: string;
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
  recordId: string;
  messageId: string;
  whatWasAsked: string;
  differenceFromRecord: string; // factual, neutral, private — see §8
  suggestedPrice: number | null;    // cents. null when nothing in the record supports one.
  priceBasis: string | null;        // which line it was derived from. null with suggestedPrice.
  estimatedValue: number | null;    // cents. What it is worth if absorbed rather than billed.
  status: 'open' | 'billed' | 'absorbed' | 'dismissed';
};

type AbsorbedItem = {
  id: string;
  recordId: string;
  description: string;
  estimatedValue: number;       // cents. Frozen from the flag at the moment of absorbing.
  absorbedAt: string;           // ISO date
  note: string;                 // why, in the user's own words. Never leaves the app.
};
```

### Everything is hand-creatable

Extraction is one way to populate a record, not the only one. Every field above
must be creatable and editable by hand, and there is a **"start a blank record"**
path from the first screen that never touches the API (§6, Phase 1). A record
with `sourceThread: []` and `origin: 'manual'` is a completely valid record and
must render, edit, print and export identically to an extracted one — with no
provenance lines, because there is no thread, and no apology about it either.

### Notes on specific fields

| Field | Why it exists |
|---|---|
| `ProjectRecord.origin` | An extracted record is a draft to be checked; a hand-typed one is the user's own words. The copy on the review screen differs, and deriving this from `sourceThread.length` breaks the moment someone pastes a thread into a manual record. |
| `ProjectRecord.absorbedWork` | Work done and never billed is the thing this product is actually about. It has to be stored, not merely counted, or Phase 5's absorbed total has nothing behind it. |
| `ProjectRecord.fieldSources` | §7 requires provenance on *every* extracted field, but `source` only exists on `Deliverable`. This holds a quote per scalar field. |
| `Deliverable.priceSource` | A deliverable and its price are almost never in the same sentence — the hero thread says "3 reels…" in one paragraph and "budget-ish 2k" three later. §1's demo moment is about tracing the *price* specifically. |
| `ProjectRecord.clientId` | Added ahead of §13 so records already in `localStorage` never need migrating. Null until the user confirms which client it is. Phase 5 groups by `clientName`, not this. |
| `Message.external` | Marks a message as imported rather than pasted, so it can be labelled and never double-imported (§13.3). |
| `ScopeFlag.differenceFromRecord` | Renamed from `whyItsOutOfScope`. The old name asks the model to justify a verdict; the new one asks it to state a difference. Field names shape output, and §8 requires neutrality. |
| `ScopeFlag.suggestedPrice` / `priceBasis` | Nullable, because §8 forbids generating a monetary figure the user cannot trace. A change-order price is derived from a rate already in the record, and `priceBasis` names which one. Nothing comparable in the record means `null`, an empty input, and the user's own number. |
| `ScopeFlag.estimatedValue` | Defaults to `suggestedPrice` and is editable downward. People often absorb at a goodwill value below what they'd have charged, and forcing the two to be equal would inflate Phase 5's absorbed total. |

§13 adds `Client`, `ClientInsight`, `Theme`, `LearnedNumber`, `InsightBasis` and
`ExternalRef`. None of those features are built yet.

### Money rules

- Store all money as **integer cents**. Never floats.
- Format with `Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' })`.
- **No VAT.** Removed 2026-08-27 — the feature, the line on the document, the
  settings field, `ProjectRecord.vatRatePercent`, and `VAT_RATE_PERCENT` in
  `src/config.ts`. The primary audience invoices through a laskutuspalvelu that
  handles VAT automatically, so a VAT figure here is noise at best and a second,
  disagreeing number at worst. Amounts in Backpay are the amounts agreed in the
  conversation. Documents say so once, quietly: *"Amounts are as agreed. Backpay
  does not calculate VAT."*
- Invoice due date default: **net 14** from issue date.
- **No number may depend on hours worked.** See §1.

---

## 6. Features, in build order

Build these in sequence. Each one must work end to end before you start the next.
Do not build UI shells for later phases.

**Every phase from 1 onward must end in something sendable** (§1). A phase that
leaves the user with a saved record and nothing to copy is not done, however good
the record is.

### Phase 0 — Skeleton

Vite project, Tailwind, types, design tokens, empty shell that deploys to GitHub
Pages successfully. **Deploy before writing features.** A working deploy on day
one is worth more than a working feature on day two.

### Phase 1 — Thread in, record out

- A single large textarea: "Paste the client thread."
- Parse it into `Message[]` (split on blank lines and `From:` / `On ... wrote:`
  patterns; be forgiving, this is messy input).
- Send to Claude with the extraction prompt (§8), get back a `ProjectRecord` as
  strict JSON.
- Validate it. If it fails, retry once with the validation error appended. If it
  fails again, show what came back and let the user fix it by hand. Never crash
  on bad model output.
- Render the record on an editable review screen, every field with its
  provenance.
- **Start a blank record.** A second, equal path from the first screen: no
  thread, no API call, every field typed in. Many creative deals are agreed on a
  call. This is not a fallback for when extraction fails — it is a first-class
  way in, and the empty state offers both.
- **Full field editing** on both paths, including adding and deleting
  deliverables.
- **Ends sendable:** a plain-text "what we agreed" summary, generated from the
  record by template with no API call, with a copy button. Phase 3 makes the
  outputs good; Phase 1 may not ship without at least this one, because §1 says
  so and Phase 1 would otherwise be two whole phases of a screen that only
  stores.

### Phase 2 — Scope defense

- On a record: "Add a message from the client."
- Claude compares it against the record and returns zero or more `ScopeFlag`s
  describing the differences, factually (§8).
- **Three actions per flag, with equal visual weight, side by side:**
  - **Bill it** — draft a change order at the suggested price.
  - **Absorb it** — log an `AbsorbedItem` with an estimated value, editable.
  - **Dismiss it** — not a real difference; the flag goes away.
- **Absorb is a first-class action, not a secondary link.** Same button size,
  same prominence, same row. Most scope creep gets absorbed — a UI that only
  makes billing easy is lying about what actually happens, and it makes the user
  feel they failed every time they choose the normal option. The absorbed total
  is also the number that makes Phase 5 worth reading.
- **Ends sendable:** the change order draft when they bill it; the updated
  summary from Phase 1 in every case.

### Phase 3 — Outputs

Everything the record can become. All copyable, all printable, no PDF library —
a print stylesheet and `window.print()`.

- **Quote** — line items, subtotal, total, payment terms, deadline, usage rights.
  If `usageRights` is null, a prominent nudge: unstated usage rights are how
  creatives get underpaid, and the gap is stated on the document itself, not just
  on screen.
- **Scope summary** — what was agreed, what was added, what was billed, what was
  absorbed and at what value.
- **Invoice line items** — deposit and balance, sequential `YYYY-NNN` numbering
  persisted, mark sent / mark paid, manual only. Phase 4 needs real invoices with
  real due dates, so these are actual `Invoice` objects, not a rendered table.
- **"Here's what we agreed"** — a plain, neutral reply the user can send when a
  client misremembers. It restates the record and quotes the thread. No
  accusation, no tone, no "as you can clearly see". This is the output the whole
  product exists to make possible; give it the same care as the quote.

### Phase 4 — The chase

This is the emotional payoff. Do not rush it.

- Any overdue invoice gets a "Draft a nudge" action.
- A **tone control** with three named steps: `Friendly` → `Firm` →
  `Formal notice`. Name them in the UI exactly like that.
- **Friendly is the default and the hero.** The screen opens on Friendly with the
  draft already written. Most late invoices are a few days late and one polite
  nudge away from being paid; designing the screen around the confrontation makes
  the common case feel like an escalation.
- Firm and Formal notice are one step away and clearly available — not hidden,
  not behind a warning. **Formal notice is the rare case.** Do not lay the screen
  out as though it is the destination.
- Claude drafts at that tone using real numbers (invoice number, amount, days
  overdue, original agreement date).
- Output is a copyable block plus a `mailto:` link. It does not send.

### Phase 5 — One insight card

**One card. Not a dashboard.** No grid of numbers, no charts, no "at a glance"
row. One thing worth knowing, stated in a sentence.

- **Computed live from stored records on read.** Never hardcoded, never cached,
  never seeded with a plausible-looking figure to make the demo land.
- **Permitted metrics** — pick the one with the most data behind it:
  - scope overrun rate per client
  - average days to pay per client
  - total absorbed value
  - count of records with unpriced usage rights
- Nothing else. In particular nothing derived from hours (§1).
- Grouped by `clientName`, not `clientId` — clients are not a built feature until
  §13.
- **Insufficient data says so, plainly.** "Not enough history yet — this starts
  working at three finished projects." Never a placeholder number, never a
  greyed-out fake, never a zero pretending to be a measurement. The
  three-data-point floor in §13.2 applies here, and it applies before any of §13
  is built.
- The rows behind the number are one click away. A statistic the user cannot
  trace is exactly the kind of confident invention this product exists to avoid.
- **Ends sendable:** the card is glanceable, but the absorbed total and the scope
  summary it draws on are already copyable from Phase 3.

### Phase 6 — Retroactive import

- Paste several past threads in one go, separated clearly. One record per thread.
- This is the onboarding story: a new user has a year of history and zero
  records, and typing them in one at a time is not going to happen.
- It is also what makes Phase 5 honest. An insight card computed from one project
  is a rounding error with a confident voice.
- Each record still lands on the review screen and is still fully editable. Bulk
  import is not bulk trust.
- No inbox connection here. That is §13, and it comes after this.

### Beyond Phase 6

§13 — client memory, themes, and read-only inbox connection. Nothing from it may
be started, or stubbed, before Phase 6 ships.

---

## 7. Design direction

The brief is *calm*. The user comes to this app already stressed about money. The
interface should feel like someone competent quietly handling it.

**The governing rule: the only loud thing on screen is value the user hasn't
recorded** — money that is overdue, and work that was done but never billed.
Those are the two points of saturation in the entire UI. Everything else is
quiet. Do not spend color anywhere else.

### Tokens

Define these as named tokens and use the names everywhere. **No raw hex in
components.**

They live in an `@theme` block in `src/index.css`, not `tailwind.config.js` — §4
specifies Tailwind v4, which replaced the JS config file. The rule is unchanged,
only the location.

```
paper     #F5F4F7   cool off-white — NOT cream, this is not a stationery app
ink       #1A1B2E   deep indigo-black, all primary text
slate     #6B6C82   secondary text, labels
line      #DEDDE6   hairlines, borders
overdue   #D6265E   the one loud color. Unrecorded value only: money that is
                    overdue, and scope that was delivered but never billed.
                    Nothing else, ever.
paid      #2F8F6F   muted, deliberately less exciting than overdue
```

The token is still named `overdue` although its meaning is now wider than its
name, because it is referenced by name in shipped components. If it is renamed,
the name is `unrecorded` — but do that deliberately, in its own commit, not as a
side effect of another change.

### Type

- **Display:** Bricolage Grotesque. Headings and the insight card's number. Used
  with restraint.
- **Body/UI:** Inter.
- **Money and dates:** IBM Plex Mono with `font-variant-numeric: tabular-nums`.
  Every euro figure in the app is mono. This is functional (columns align) and it
  reads as a ledger.

**Self-host them.** The woff2 files live in `src/fonts/` and are declared with
`@font-face` at the top of `src/index.css`, with the `unicode-range` values
Google ships, so a Finnish page never downloads the latin-ext subsets. Bricolage
and Inter are variable fonts — one file per subset covers every weight. §3 forbids third-party requests, and the Google Fonts CDN
is one — it hands Google the visitor's IP and the page they are on with every
load. Both options are free; only one of them is consistent with §3.

### Signature element: provenance lines

On the record review screen, the layout is two columns: the raw messy thread on
the left, the clean structured record on the right.

Hovering or focusing any extracted field on the right highlights the exact source
sentence on the left, and draws a hairline connecting them. Keyboard accessible,
not hover-only.

This is the one memorable thing in the product. It is also the trust mechanism —
it's how the user believes the model didn't invent the price. Spend your effort
here and keep everything around it disciplined.

A hand-built record has no thread, so it has no lines. That screen is a single
column and says nothing about it.

### What to avoid

Do not produce the current AI-design default: warm cream background,
high-contrast serif display, terracotta accent. Also avoid near-black with a
single acid-green accent, and the hairline-ruled broadsheet look. The tokens
above already steer away from all three — stay on them.

### Copy

Plain, active, specific. Buttons say what happens: "Draft the nudge", not
"Generate". The action keeps its name through the flow. Empty states are
invitations, not apologies: *"Nothing recorded yet. Paste a client thread — or
start a blank record, if it was agreed on a call."*

Nothing in the UI may imply the record is authoritative (§8).

### Quality floor

Responsive to mobile. Visible keyboard focus rings. `prefers-reduced-motion`
respected. Don't announce any of this, just do it.

---

## 8. Prompting rules

All prompts live in `src/prompts/`, one file per task, exported as template
functions. Never inline a prompt in a component.

### For every extraction call

- Give Claude the **exact JSON schema** and instruct: return only JSON, no prose,
  no markdown fences.
- Strip ` ```json ` fences defensively anyway before parsing.
- Require a `source` object on every field that came from the thread, containing
  the **verbatim substring**. If Claude can't find a supporting substring, it must
  return `null` for that field rather than inventing one. This rule is what makes
  provenance lines honest.
- A quote the model returns is **not trusted until verified**. Check that it is a
  real substring of the message it cites — of the text that was actually sent,
  which is the redacted text when redaction is on (§3). Drop it and tell the user
  if it isn't. Without that check the provenance lines are decoration.
- Instruct it to leave `usageRights` and `deadline` as `null` when unstated
  rather than guessing. Missing information is a feature — we surface the gap.
- Ask for money as `unitPriceCents`, never `unitPrice`. Naming the unit in the
  field is what stops a silent euros/cents error.
- **Never let a lump sum be multiplied by a quantity.** If one budget covers a
  bundle ("3 reels … budget-ish 2k"), the line gets `quantity: 1` with the count
  in the description, so `quantity × unitPrice` equals the stated budget exactly.
  Do not divide the lump by the count either — that invents a per-unit precision
  the client never gave, and rounds badly. This shipped as a bug once and would
  have opened the demo by showing the AI tripling a price.
- Set `max_tokens: 4096`.

### The output is a draft, never truth

Extraction produces a first pass at what the messages say. It is not a finding,
not a confirmation, and not a contract.

- **Rewrite any UI copy that implies otherwise.** Not "Your agreement", not
  "Confirmed", not a green check mark, not a completeness percentage. The
  register is *"Here's what we read"* and *"Check this"*.
- The screen's job is to make disagreeing easy. Every field is an input, focused
  and edited without a mode switch.
- **Never generate a monetary figure the user cannot trace or edit.** Every number
  the model produces either quotes the sentence it came from (`source`,
  `priceSource`) or names the line in the record it was derived from
  (`priceBasis`). If it can do neither it returns `null`, the field renders empty,
  and the user types their own.

### For scope flags

- **Neutral and factual.** State the difference between what was asked and what
  the record says, then stop. *"The record lists 3 reels. This message asks for
  5."* Not *"the client is trying to get two extra reels for free."*
- **Never characterise the client's intent.** Not scope creep, not pushing, not
  testing boundaries, not "as usual". We don't know what they meant and the model
  certainly doesn't.
- **Never imply the user should push back.** Bill it, absorb it and dismiss it are
  three equal options (§6, Phase 2). Copy that leans toward billing makes
  absorbing feel like a failure, and absorbing is what usually happens.
- **Flags are private.** They are notes to the user about their own project and
  are never rendered into anything a client receives. The change order restates
  the work and the price; it never restates the flag.
- Price a change order from a rate already in the record and say which one
  (`priceBasis`). Nothing comparable in the record means `suggestedPrice: null`.

### For the chase email

- Pass the real invoice data. Never let the model invent a number.
- The three tones are distinct in *strategy*, not just adjectives:
  - **Friendly** — assumes it slipped through, gives them an easy out, no
    consequence mentioned. This is the default and the one that gets used.
  - **Firm** — states the days overdue plainly, restates the agreed terms, asks
    for a specific payment date.
  - **Formal notice** — references the agreement, states the amount and the
    deadline, notes that late payment interest applies. Neutral and unemotional.
- Never threaten legal action. Never claim a specific statutory interest rate —
  say "late payment interest as per the agreed terms" and leave the number to the
  user.

---

## 9. Repo and deployment

### Setup

Already done. The repo root **is** `backpay/` — this file, `PROGRESS.md`, `src/`
and `.github/` all sit at that level, so the workflow YAML below needs no
`working-directory` override and the repo name matches `base: '/backpay/'`.

```bash
npm install
npm run dev      # http://localhost:5173/backpay/
npm run build    # tsc -b && vite build
npm run lint
npm run check    # parse → validate → totals
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

After the first push, the user must enable Pages: **Settings → Pages → Source:
GitHub Actions**. Tell them this in the README; it cannot be done from code.

### `.gitignore`

Must include `node_modules`, `dist`, `.env`, `.env.*`, `.DS_Store`.

### README.md

Write it for someone landing on the repo cold. Include: what it is, the live
link, how to run it locally, how BYOK works and the honest security caveat, what
§3 promises about where text goes, how Demo Mode works, and what's deliberately
not built.

---

## 10. Working process

The user is following this repo commit by commit. Work in visible increments.

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **One commit per completed task**, not per phase. Small and legible beats large
  and tidy.
- **Push after every commit.** A green Actions run is the signal that a phase
  landed.
- **Update `PROGRESS.md` at the end of each phase** with: what shipped, what you
  decided and why, what's still broken. This is the file the user reads to follow
  along.
- If you hit a real fork in the road (a dependency doesn't work on Pages, an
  approach is a dead end), stop and ask rather than picking silently.

### Definition of done for a phase

1. Feature works end to end in Demo Mode.
2. Feature works end to end with a real API key.
3. Deployed and verified on the live Pages URL, not just localhost.
4. The phase ends in something the user can send or copy (§1).
5. `PROGRESS.md` updated.

---

## 11. Fixtures

Build these early, in `src/fixtures/`. The demo depends on them more than on any
feature.

**The hero thread.** A realistically awful client message. Lowercase, no
punctuation, vague budget, unstated deadline, no usage rights mentioned.
Something like: a client asking for "like 3 reels + some stills for the launch,
budget-ish 2k, need it by the 12th?" Write it so the audience laughs in
recognition.

**The scope-creep follow-up.** A second message, sent cheerfully two weeks later,
casually adding two more deliverables as though they were always included. It has
to be genuinely ambiguous — a message that is obviously a con doesn't need a tool
to catch it, and it makes "absorb it" look like a mistake.

**A history to compute from.** Several records across a few clients in different
states, including at least one 40-days-overdue invoice and at least one absorbed
item. Enough that Phase 5's card clears the three-data-point floor honestly
rather than by being handed a number.

Keep every fixture anonymous and invented. No real client names.

### The demo these have to support

Two acts and a short beat:

- **Act 1** — messy thread in, record out, provenance visible. The moment is
  clicking a price and watching the sentence light up.
- **Act 2** — the follow-up message goes in, a scope flag comes out, and all
  three actions are on screen at once with equal weight. The moment is that
  "absorb it" is a real button.
- **Beat** — one insight card, computed from the fixture records in front of the
  audience. Short. It is a closing line, not a third act.

**Do not build demo choreography into the app.** No scripted sequence, no "start
demo" button, no timed reveals, no branching on a demo flag beyond Demo Mode's
canned API responses. Fixtures only — the demo is a person clicking through the
real product. Anything else is a thing that breaks on stage and, worse, a thing
the audience can tell is on rails.

---

## 12. Guardrails

- Never commit an API key, in any form, at any point.
- Never add an auto-send or auto-charge path.
- Never build a screen that only stores (§1).
- Never add analytics, telemetry, error reporting, or any third-party script or
  asset host (§3).
- Never send un-redacted text when redaction is on, and never verify a quote
  against text that wasn't the text sent (§3).
- Never persist the placeholder → original redaction map.
- Never present the chase email as a legal document, or a change order as a
  binding contract.
- Never let a generated number appear without the user being able to trace or
  edit it.
- Never show a hardcoded, cached, or placeholder figure on the insight card. Say
  "not enough history yet" instead.
- Never add a field, metric, or output that depends on hours worked (§1).
- Never characterise a client's intent in a scope flag (§8).
- If model output fails validation twice, surface the raw output to the user.
  Don't paper over it with a fake fallback.

---

## 13. Client memory, themes, and inbox connection

Added 2026-08-27. **None of this is built before Phase 6 ships.** The data model
lands early (see §5) so nothing has to be migrated out of `localStorage` later;
the features come after the seven phases are solid.

### 13.1 What this is for

Backpay currently forgets everything between records. The point of this section is
that it stops forgetting:

- **Client memory.** How long this client actually takes to pay, how often they
  add scope after agreeing, what you have historically charged them. A client who
  always pays on day 40 should make `Firm` the default tone on the chase, not
  `Friendly`.
- **Themes.** The same deliverable recurs across clients — "15s vertical reel"
  shows up in nine records at seven different prices. Surfacing that is a rate
  card built from your own history. It is your data, not someone else's
  benchmark, which is the only kind of rate guidance worth showing.
- **Extraction gets better.** Known client context goes into the extraction
  prompt, so the next thread from the same client reads more accurately.

Phase 5's single insight card is the honest, small version of this. If that card
turns out not to be worth reading, none of §13 is either.

### 13.2 Derived, never asserted

Client insights and themes are **computed from records and invoices on read**, not
stored as fields that can drift. If days-to-pay is wrong, the fix is in the
invoice data, not in a cached summary. Only identity is persisted: name, email
addresses, notes.

The provenance rule from §1 extends here without exception. A learned claim
("Nina pays around day 38") must name the invoices it was computed from, the same
way an extracted price names its sentence. A statistic the user cannot trace back
to specific rows is exactly the kind of confident-sounding invention this product
exists to avoid. **Never show a learned number derived from fewer than three data
points** — say "not enough history yet" instead. Two invoices is an anecdote
wearing a median's clothes.

This rule governs Phase 5 as well, and Phase 5 lands long before anything else
here.

### 13.3 Inbox connection — the terms

Read-only Gmail connection via Google Identity Services, using the token model.
It has to meet all of these:

- **Read scopes only.** `gmail.readonly`. A send scope is never requested, not
  even to "make the chase easier". The whole trust story is that the human sends.
  Asking for inbox access and send access in the same consent screen destroys it.
- **Static-compatible.** The GIS token model needs no client secret and no
  backend, which keeps §2 intact. The OAuth **client ID is not a secret** and may
  be committed; nothing else about this may be.
- **Nothing leaves the browser.** Message bodies go to `localStorage` and to
  Anthropic for extraction, exactly like a pasted thread does today. §3 holds
  unchanged — connecting an inbox does not add a third destination, and Google is
  not one either beyond the fetch itself.
- **Import is explicit and reviewable.** Backpay never silently ingests a whole
  mailbox. The user picks threads to import, sees what was pulled, and can delete
  it. Imported messages are marked as imported.
- **Disconnect actually disconnects.** One control that revokes the token and
  deletes what was imported. Not a flag that hides it.
- **The pasted-thread path never goes away.** Inbox connection is an alternative
  input, never a requirement. Demo Mode must still work with no Google account at
  all — the demo cannot depend on an OAuth consent screen.

### 13.4 Known unknowns — resolve before building

- `gmail.readonly` is a **Restricted** scope. Google's own documentation is
  inconsistent about whether the annual CASA security assessment applies to an app
  that never stores or transmits scope data server-side: the scopes page
  conditions it on server storage, the verification page states it flatly. That
  ambiguity is the difference between free and not, so **ask Google directly
  before building**, and record the answer here.
- Unverified apps show a full-screen warning and are capped to a test-user list.
  Acceptable for personal use and demos, not for public launch.
- No refresh tokens in the token model: access tokens are short-lived and the user
  re-consents each session. Design for that rather than fighting it.

If verification turns out to cost money, this feature stops and we talk. §2 says
free, and §2 has not been amended.

### 13.5 Guardrails specific to this section

- Never request a Gmail send or modify scope.
- Never persist an OAuth access token to `localStorage`. Memory only.
- Never show a learned statistic without the rows behind it.
- Never let inbox connection become a prerequisite for any Phase 0–6 feature.
