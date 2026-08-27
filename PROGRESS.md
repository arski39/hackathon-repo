# Progress

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
