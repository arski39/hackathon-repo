# Progress

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
- *No UI shells for later phases.* No dashboard nav, no disabled buttons, no
  Demo Mode toggle yet — they arrive with the features they belong to.
- Vite scaffold cruft (`App.css`, `src/assets/`, `public/icons.svg`) deleted
  rather than left to rot.

**Still open**

- Pages must be enabled by hand: Settings → Pages → Source: GitHub Actions.
  The first Actions run fails until then.
- The live URL in the README is a placeholder until the first deploy lands.
- Model ID `claude-sonnet-5` is written down but not yet verified against
  the docs — that check happens before the first real API call in Phase 1.

**Next:** Phase 1 — Thread in, Deal out.
