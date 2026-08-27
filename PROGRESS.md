# Progress

## Phase 3 — Outputs (2026-08-27)

One screen, four things the record can become. All copyable, all printable, no
PDF library.

**What shipped**

- **Quote** — the Phase 2 document, now chrome-free (`QuoteSheet`) so printing
  it from anywhere produces the same page, plus a plain-text version to paste
  into an email.
- **Scope summary** — agreed at the start, added since and invoiced, added since
  at no charge.
- **Invoices** — real `Invoice` objects. Deposit, balance and change-order,
  numbered `YYYY-NNN`, marked sent and paid by hand.
- **"What we agreed"** — the reply for when a client misremembers, with the
  sentence from the thread under each line.
- 37 new checks; 146 in total.

**Decisions**

- *Invoice numbers are derived from the stored invoices, not from a counter.* A
  counter is one more piece of state that can drift, and when it drifts the
  numbers it hands out are wrong in a way nobody notices for months. This cannot
  disagree with the invoices because it is computed from them. The trade is that
  deleting an invoice would let a number be reused — nothing deletes one today,
  and if deletion arrives this needs a high-water mark.
- *Line items are snapshots.* An invoice states what was billed on the day it
  was issued. Editing the record afterwards must not rewrite it, so the lines
  are copies with their own ids. Checked.
- *The balance invoice shows the deposit as a deduction.* Silently netting it
  off produces a total the client cannot reconcile, and then they email asking,
  which is the exact thing this product exists to prevent.
- *Only a sent invoice can be overdue.* A draft sitting in the app past its
  notional due date is not late; nobody has asked for the money yet. This is the
  first place the loud color is used for the thing §7 named it after.
- *The scope summary is client-facing.* Absorbed work is named but never priced,
  and dismissed flags do not appear at all — the user decided those were not
  differences, and listing them restarts an argument nobody is having.
- *The reply's whole difficulty is tone.* The same facts read as a correction or
  as an accusation depending on one clause. No "as agreed", no "as you can see",
  no "to be clear", nothing laid out like evidence. It opens by offering to put
  things in one place and closes by inviting a correction, because the user
  still has to work with this person on Monday. A check fails the build if any
  of those phrases reappear.
- *Invoices are not cleared when the record is.* Numbering runs across every
  record, and an orphaned invoice is a much smaller problem than a reused
  number.

**Still open**

- Still not verified on a live Pages URL — the GitHub repo does not exist. It
  now runs locally at `http://localhost:5173/backpay/`.
- Print output still has not been eyeballed. The stylesheet is right by
  construction: the outputs nav and every action row carry `no-print`, and each
  document is a `.print-sheet`.
- Invoices have no edit path once created. Deliberate for now — an invoice you
  can quietly rewrite after sending is worse than one you cannot — but it means
  a typo costs you a fresh number.
- Nothing links a change-order invoice back to the flags it came from, so
  billing the same flags twice is possible if you undo and redo.

**Next:** Phase 4 — the chase, with Friendly as the default and the hero.

---

## Phase 2 — Scope defense (2026-08-27)

Paste a later message from the client; get back a factual list of where it
differs from the record, and three equal answers per difference.

**What shipped**

- `findScopeFlags` prompt, `validateScopeFlags`, `runScopeCheck`, and a
  `ScopeDefense` screen with the follow-up message on the left and the
  differences on the right, quote highlighting included.
- **Bill it / Absorb it / Dismiss it are the same button.** Same size, same
  border, same row. Styling one as primary would be the tool having an opinion
  about which answer is right, and absorbing is what usually happens.
- Change orders (templated, no API call) that restate the work and the price and
  never mention why it was flagged.
- Absorbed work is logged with a value and a private note, and the running
  absorbed total is shown in the app.
- 41 new checks; 109 in total.

**Decisions**

- *Neutrality is checked, not requested.* The prompt asks for factual wording and
  the validator then tests for it. A note that characterises the client is
  replaced with a neutral one and the substitution is disclosed — showing the
  model's wording with a caveat underneath still shows it. A characterisation in
  `whatWasAsked` drops the flag entirely: that field ends up on a change order
  the client reads, and there is no safe way to rewrite editorial into an
  invoice line.
- *No quote, no flag.* `ScopeFlag` gained `source`. `whatWasAsked` has to be
  clean enough for an invoice line, so it cannot double as the provenance quote.
- *A price with no basis is dropped.* §8 forbids a number the user cannot trace,
  and that does not stop applying because the model sounded confident.
- *One editable number per flag.* `suggestedPrice` and `estimatedValue` stay
  separate on the model so the value freezes at the moment of the decision, but
  the screen shows one field. Editing it clears `priceBasis` — a basis that
  described the model's number is a lie once the user types their own.
- *Absorbed work is listed in the summary but never priced there.* What the
  client got is worth writing down; what it was worth is the user's own
  accounting. The private note never appears in any output.
- *The demo returns three flags and no prices.* The hero record prices the reels
  as one 2k lump with no per-unit rate, so nothing in it supports pricing a
  cutdown. Handing the user an empty box is the honest answer, and it is the
  demonstration: the tool would rather show nothing than invent a number.
- *`parseFollowUp` forces every block to the client side.* Letting the parser
  alternate would attribute half a pasted follow-up to the user and then flag
  their own words as a difference.

**A bug the tests found in the tests**

`check('...never prints 0,00 €', !summary.includes('0,00 €'))` had been passing
since Phase 1 and meant nothing. Two reasons at once: `formatEuros` separates
with a non-breaking space, so the literal never matched anything; and `2 000,00 €`
*contains* `0,00 €`, so the assertion would have been useless even with the right
space. Now compared line by line against `formatEuros(0)`.

**Still open**

- Not verified in a browser or against a real key. Same blocker: the GitHub repo
  does not exist, so nothing has run on a live Pages URL.
- The priced path (`priceBasis` populated) is covered by unit checks but never
  appears in Demo Mode, because the hero record has no per-unit rate to derive
  from. It will show up the first time someone uses a record that does.
- Undo restores a flag to `open` and removes the absorbed row, but a flag that
  was billed and then undone leaves no trace. Fine now; revisit if Phase 3's
  invoices start referencing flags.

**Next:** Phase 3 — outputs.

---

## Restructure — Backpay is a record, not an invoicing tool (2026-08-27)

The concept was stress-tested and repositioned before more features landed.
Backpay is now a record of what was agreed on a project, and documents — quotes,
scope summaries, invoice line items, chase emails, a plain "here's what we
agreed" reply — are outputs generated from it. Invoicing is one output among
several rather than the point.

`CLAUDE.md` was rewritten to match: §1 and §6 (phases) rebuilt, §3 (privacy) is
new, VAT gone, time tracking permanently out of scope, and everything after §2
shifted down one number.

**What shipped**

- **`Deal` is `ProjectRecord`.** Not `Record` — `Record<K, V>` is a TypeScript
  built-in and declaring our own would shadow it in every importing file, and
  `Partial<Record<K, V>>` is already used in `types.ts`. The product noun stays
  "record" everywhere a human reads it.
- **VAT removed entirely** — the constant, `vatOf()`, the record field, the
  settings input, the quote's VAT and subtotal rows, and the tax-advice caveat.
  The quote shows one Total.
- **Privacy (§3).** Settings now states plainly where the text goes. Fonts are
  self-hosted; `dist/` contains no third-party host at all.
- **Redaction toggle**, off by default, with the §3 ordering enforced in
  `runExtraction`: verify quotes against the text that was *sent*, then restore.
- **Start a blank record.** A second, equal way in — no thread, no API call. The
  review screen collapses to one column with no provenance chips.
- **A copyable "what we agreed" summary**, so Phase 1 ends in something sendable
  rather than owing that to Phase 3.
- The rest of the §5 model: `origin`, `absorbedWork`, `AbsorbedItem`, and
  `ScopeFlag`'s new shape.

**Decisions, and the things that nearly went wrong**

- *VAT was removed completely, not just the set-aside.* The brief said "including
  the config constant", and a per-record VAT rate would still want a default
  constant. If the narrower reading was meant, it is a small revert.
- *Redaction breaks provenance unless the order is pinned.* The model only ever
  sees redacted text, so its verbatim quotes are substrings of the *redacted*
  thread. Verifying against the original would fail every quote and read as the
  model misbehaving. Order is now: redact → send → verify against what was sent →
  restore → highlight against the original.
- *One placeholder per spelling.* The hero thread says "Nina" in the header and
  "nina" in the sign-off. Matching case-insensitively but restoring both to
  "Nina" rewrites the user's own words, and the restored quote stops being a
  verbatim substring. So `Nina` → `[Client]`, `nina` → `[client]`.
- *Only client-side names are redacted.* `parseThread` labels an unnamed creator
  "You". Redacting that would have turned every "you" and "you'd" in the thread
  into a placeholder — caught by a check, not by reading.
- *A short name must not be redacted out of the middle of a word.* A client
  called "Ali" would otherwise turn "quality" into "qu[Client]ty". Word-boundary
  guards, with a check.
- *Fonts live in `src/fonts/`, not `public/fonts/`* as §4 first said, so Vite
  fingerprints them and rewrites URLs under `base`. Bricolage and Inter are
  variable fonts, so the 14 downloaded files deduplicate to 8.
- *Phase 1 now ships the summary.* §1 says every session ends in something
  sendable; outputs are Phase 3, which would have left two phases of a screen
  that only stores.
- *An unset price prints "price not set", never "0,00 €".* A zero in a document
  the client reads is the user agreeing to free work by accident.

**Still open**

- The **67% statistic in the pitch is uncited.** The spec requires every number
  in the product to be traceable; the pitch should not be the exception. Find the
  study or say "most freelancers".
- Same blocker as every phase so far: **the GitHub repo does not exist**, so
  nothing is verified on a live Pages URL and none of Phases 0–2 can reach step 3
  of §10's definition of done.
- Nobody has opened this in a browser. The build is clean, lint is clean, and 79
  checks pass, but the redaction toggle, the blank-record flow and the print view
  have not been looked at by a human.
- `PROGRESS.md` entries below this one use the old numbering and the name `Deal`.
  Left as written — they are a record of what was decided when.

**Next:** Phase 2 — scope defense.

---

## Phase 2 — Quote ✅ (needs a look on the live URL)

**What shipped**

- A quote document: line items, subtotal, VAT, total, payment terms with the
  deposit worked out in euros, delivery date, revisions, usage rights, notes.
- Print stylesheet. `window.print()` produces the document with the app chrome
  stripped, 18mm margins, and no line item split across a page break — a row
  broken in half looks like a mistake in a document someone is deciding whether
  to pay.
- The usage-rights gap is stated **on the document**, not just nudged on
  screen: "No usage is granted by this quote until the media, term and
  territory are set in writing." A gap the client can see is a gap they can
  answer.
- "Your details" in Settings — name, email, business ID. A quote with no sender
  is not something anyone would actually send.
- Quotes carry a validity date, 30 days out. A quote with no expiry is a price
  the client can hold you to in six months.
- The deal is now persisted, so a refresh mid-edit doesn't throw the work away.

**A bug this phase found in Phase 1**

Writing the totals surfaced a contradiction between two rules in the extraction
prompt. Rule 5 said to put a lump budget on the line it most clearly refers to;
rule 7 said "3 reels" means one line with quantity 3. Together they produced
3 × €2000 = **€6000** for a client who said "budget-ish 2k" — the demo would
have opened by showing the AI tripling the price, which is precisely the
failure the provenance lines exist to disprove.

Fixed at the prompt: when a lump sum covers a bundle, quantity is 1 and the
count goes in the description, so quantity × unitPrice equals the stated budget
exactly. Explicitly *not* fixed by dividing 2000 by 3 — that invents a per-unit
precision the client never gave and rounds badly (€666,67 × 3 = €2000,01).
`npm run check` now asserts the subtotal equals the stated budget, so this
cannot come back silently.

**Decisions**

- *Deposit is computed on the gross total, not the subtotal.* It's the number
  that actually leaves the client's account.
- *Dates spell the month out.* 09/12 is two different days depending on which
  side of the Atlantic the client is on.
- *VAT stays a line on the quote, with the caveat once and quietly at the
  foot.* §4 wants it labelled a user-checkable assumption; a client-facing
  document still needs the line.
- *No PDF library.* §3 said print stylesheet, and it is genuinely the better
  output.

**Still open**

- Not verified on the live Pages URL or with a real API key — same blocker as
  Phases 0 and 1: the GitHub repo does not exist yet.
- Print output has not been eyeballed. The CSS is right by construction but
  nobody has actually hit Ctrl+P.
- Quotes have no number yet. Sequential numbering arrives with invoices in
  Phase 3.

**Next:** Phase 3 — Invoices.

---

## Spec amendment — client memory and inbox connection (2026-08-27)

Not a phase. A decision, recorded so the repo stops contradicting itself.

**What changed**

- §1's out-of-scope list had "email OAuth" on it. It has been removed
  deliberately, on the spec owner's call. Read-only Gmail connection is now a
  planned feature.
- New §12 sets the terms it has to meet: read scopes only, never a send scope;
  no backend; nothing leaves the browser; import is explicit and reversible;
  the pasted-thread path and Demo Mode never depend on it.
- `types.ts` gains `Client`, `ClientInsight`, `Theme`, `LearnedNumber`,
  `InsightBasis` and `ExternalRef`. `Deal` gains `clientId`, `Message` gains
  an optional `external`.

**Decisions**

- *The model lands now, the features land after Phase 6.* Deals are already
  being written to `localStorage`; if `clientId` arrives after Phase 6 every
  stored deal needs migrating. Adding the field now costs one line and a null.
- *Insights are computed on read, never stored.* A cached statistic can go
  stale and still look authoritative. If days-to-pay is wrong the fix belongs
  in the invoice data, not in a summary field.
- *Learned numbers carry their basis.* `LearnedNumber` pairs a value with the
  row ids it came from, because §1's provenance rule has to apply to a
  statistic as much as to a price. And nothing is shown below three data
  points — two invoices is an anecdote, not a median.
- *Read scopes only, forever.* `gmail.readonly` and nothing else. Asking for
  inbox access and send access on the same consent screen would trade away the
  entire "nothing sends" trust story for a convenience nobody asked for.

**Still open — genuinely blocking, before any of §12 gets built**

- `gmail.readonly` is a **Restricted** scope. Google's scopes page conditions
  the annual CASA security assessment on storing or transmitting scope data
  server-side, which Backpay never does; the verification page states the
  assessment flatly for all restricted scopes. The two pages disagree and this
  is the difference between free and paid. Needs a direct answer from Google.
  §2 still says free and has not been amended.
- Unverified apps show a full-screen warning and cap the user list. Fine for a
  demo, not for launch.
- The token model has no refresh tokens, so it is re-consent every session.

## Phase 1 — Thread in, Deal out ✅ (needs a look on the live URL)

**What shipped**

- Paste screen: one textarea, an "Use the example thread" shortcut, a skeleton
  while it thinks, and errors that take focus and say what to do next.
- `parseThread` — splits messy input into `Message[]` on `From:`,
  `On … wrote:`, WhatsApp-style `[time] Name:`, `---`, and blank lines. Named
  senders stay on the same side across the thread; unlabelled paragraphs
  alternate starting with the client. It never throws and never returns nothing
  for non-empty input.
- `extractDeal` prompt in `src/prompts/`, with the exact JSON schema, the
  verbatim-substring rule, and the instruction to return `null` rather than
  guess.
- `validateDeal` — fences stripped, then every field checked. One retry with
  the errors fed back; if the second attempt also fails, the raw output goes on
  screen behind a disclosure rather than being replaced with a fake.
- **Quotes are verified, not trusted.** A quote that isn't actually in the
  message it claims is dropped and the user is told. A quote in the *wrong*
  message is silently repaired to the right one. Without this the provenance
  lines would be decoration.
- Demo Mode: canned fixture, 1.4s delay, no network, on by default.
- BYOK: key in `localStorage`, direct browser call with the
  `anthropic-dangerous-direct-browser-access` header, 401/429/5xx each get a
  hint that points at Demo Mode.
- **The provenance lines.** Two columns, thread left, Deal right. Focusing or
  hovering a field highlights the exact sentence and draws a hairline between
  them; clicking pins it so it survives moving the mouse. Every field is
  editable.
- The usage-rights nudge when the thread never mentioned rights.

**Decisions**

- *Two additive fields on the section 4 model.* Section 6 wants provenance on
  every extracted field, but the model as written only carries `source` on
  `Deliverable`. Added `Deal.fieldSources` (a quote per scalar field) and
  `Deliverable.priceSource`. The second one matters: the deliverable and its
  price are almost never in the same sentence — the hero thread says "3 reels…"
  in one paragraph and "budget-ish 2k" three paragraphs later — and section 1's
  demo moment is specifically about tracing the *price*. Both are optional, so a
  hand-built Deal is still a valid Deal.
- *The model is asked for `unitPriceCents`, not `unitPrice`.* Naming the unit in
  the field removes any chance of a euros/cents mix-up, which is the one error
  here that would be both silent and expensive.
- *A lump budget is not divided automatically.* The prompt puts the whole amount
  on the line it most clearly refers to and leaves the others null. Splitting a
  budget is a pricing decision, and pricing your own work is exactly the part
  the user has to own.
- *The connector is drawn only at ≥1024px.* Stacked on a phone a line looping
  down the page is noise; the highlight and the button's pressed state carry it.
- *Provenance triggers are `<button aria-pressed>`, not hover targets.* Hover
  still works, but it is never the only way in.
- *Model IDs verified against the docs* before wiring the live path:
  `claude-sonnet-5` and `claude-haiku-4-5-20251001` are both current. No change.
- *Added `npm run check`.* A small smoke test over parse → validate → money.
  It exists mainly to guard one fragile invariant: every quote in
  `demoExtraction.ts` must stay a verbatim substring of `heroThread.ts`. Edit
  one without the other and the demo silently loses its provenance lines. Uses
  `npx esbuild` on demand, so it adds no dependency.

**Still open**

- Not yet verified on the live Pages URL, or with a real API key — both need a
  browser and a key. Demo Mode is verified by `npm run check` and a clean build.
- `Message.receivedAt` is left empty. Nothing needs it until invoices have
  dates to compare against.
- The retry passes the whole prompt again rather than a short correction. Fine
  at this size; worth trimming if latency shows on stage.

**Next:** Phase 2 — Quote.

---

## Phase 0 — Skeleton ✅

**What shipped**

- Vite + React 19 + TypeScript scaffold wired up: `base: '/backpay/'` so assets
  resolve on Pages, Tailwind v4 via `@tailwindcss/vite`.
- Design tokens from CLAUDE.md §6 (`paper`, `ink`, `slate`, `line`, `overdue`,
  `paid`) and the three type families (Bricolage Grotesque, Inter, IBM Plex
  Mono) defined once, in `src/index.css`.
- `src/types.ts` — the full data model from §4, transcribed unchanged.
- `src/config.ts` — VAT rate, net-14 default, locale, model IDs, API constants.
  One place, no duplicates.
- `src/lib/money.ts` — `formatEuros`, `centsFromEuros`, `vatOf`. Integer cents
  only.
- The shell: one screen, the empty-state invitation, nothing else.
- `.github/workflows/deploy.yml` — build and publish on push to `main`.
- README rewritten for someone landing cold, including the honest BYOK caveat.

**Decisions**

- *Tokens live in CSS, not `tailwind.config.js`.* CLAUDE.md §6 says config file,
  §8 installs `@tailwindcss/vite` — that's Tailwind v4, which dropped the JS
  config in favour of an `@theme` block. Went with v4 as §8 specifies. The rule
  that matters is unchanged: named tokens only, no raw hex in components.
- *`backpay/` is the git root*, so §8's workflow YAML works verbatim with no
  `working-directory` override, and the repo name matches the base path.
- *No UI shells for later phases.* No dashboard nav, no disabled buttons — they
  arrive with the features they belong to.
- Vite scaffold cruft (`App.css`, `src/assets/`, `public/icons.svg`) deleted
  rather than left to rot.

**Still open**

- Pages must be enabled by hand: Settings → Pages → Source: GitHub Actions.
- The live URL in the README is a placeholder until the first deploy lands.
