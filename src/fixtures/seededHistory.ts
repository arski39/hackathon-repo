import type { PriceEntry } from '../types'

/**
 * A year of invented history — CLAUDE.md §12.
 *
 * RECALL reads `PriceEntry` and nothing else, so this is what a demo of Act 3
 * actually needs. A new user has no corpus and will not have one until they
 * have finished three projects inside the app, which is weeks away; Phase 6's
 * retroactive import is the real answer to that, and this is how the feature
 * can be seen working before Phase 6 exists.
 *
 * **It is never loaded on its own.** §13 forbids showing a hardcoded figure
 * where history belongs, so this only enters the corpus when the user asks for
 * it in Settings, and it leaves again when they ask for that. Every row is
 * marked by its `recordId` prefix so removing it takes out exactly these and
 * nothing the user typed.
 *
 * Clients and projects are invented. Prices vary the way real ones do — the
 * same brief at three different numbers, because one of them was a rush, one
 * was a favour, and the user is the only person who knows which. That variance
 * is the argument for showing rows instead of an average.
 */
export const SEEDED_PREFIX = 'seed_'

export const SEEDED_HISTORY: PriceEntry[] = [
  {
    recordId: 'seed_01',
    clientName: 'Kaisla Studio',
    deliverableDescription: '3 vertical reels, 15s, for launch',
    amount: 195000,
    enteredBy: 'user',
    enteredAt: '2025-10-14T11:20:00.000Z',
  },
  {
    recordId: 'seed_01',
    clientName: 'Kaisla Studio',
    deliverableDescription: 'Still images for feed',
    amount: 48000,
    enteredBy: 'user',
    enteredAt: '2025-10-14T11:24:00.000Z',
  },
  {
    recordId: 'seed_02',
    clientName: 'Vellamo Drinks',
    deliverableDescription: '4 vertical reels, 15s',
    amount: 260000,
    enteredBy: 'user',
    enteredAt: '2025-12-02T09:05:00.000Z',
  },
  {
    recordId: 'seed_02',
    clientName: 'Vellamo Drinks',
    deliverableDescription: 'Cutdowns for paid, 6s',
    amount: 60000,
    enteredBy: 'user',
    enteredAt: '2025-12-02T09:11:00.000Z',
  },
  {
    recordId: 'seed_03',
    clientName: 'Halla Collective',
    deliverableDescription: '2 vertical reels, 30s',
    amount: 140000,
    enteredBy: 'user',
    enteredAt: '2026-01-19T15:40:00.000Z',
  },
  {
    recordId: 'seed_04',
    clientName: 'Norrsken Bakery',
    deliverableDescription: '3 vertical reels, 15s',
    amount: 90000,
    enteredBy: 'user',
    enteredAt: '2026-02-06T08:55:00.000Z',
  },
  {
    recordId: 'seed_04',
    clientName: 'Norrsken Bakery',
    deliverableDescription: 'Photography, half day',
    amount: 55000,
    enteredBy: 'user',
    enteredAt: '2026-02-06T09:02:00.000Z',
  },
  {
    recordId: 'seed_05',
    clientName: 'Vellamo Drinks',
    deliverableDescription: '2 vertical reels, 15s, reshoot',
    amount: 170000,
    enteredBy: 'user',
    enteredAt: '2026-03-23T13:15:00.000Z',
  },
  {
    recordId: 'seed_06',
    clientName: 'Aalto Interiors',
    deliverableDescription: 'Still images for feed, 8 frames',
    amount: 72000,
    enteredBy: 'user',
    enteredAt: '2026-04-30T10:30:00.000Z',
  },
  {
    recordId: 'seed_07',
    clientName: 'Kaisla Studio',
    deliverableDescription: '5 vertical reels, 15s, spring campaign',
    amount: 310000,
    enteredBy: 'user',
    enteredAt: '2026-05-18T16:00:00.000Z',
  },
  {
    recordId: 'seed_08',
    clientName: 'Halla Collective',
    deliverableDescription: 'Still images for feed',
    amount: 52000,
    enteredBy: 'user',
    enteredAt: '2026-06-11T12:45:00.000Z',
  },
  {
    recordId: 'seed_09',
    clientName: 'Myrsky Outdoor',
    deliverableDescription: '3 vertical reels, 15s, plus stills',
    amount: 240000,
    enteredBy: 'user',
    enteredAt: '2026-07-02T09:50:00.000Z',
  },
]

/** True for a row that came from the fixture rather than from the user. */
export function isSeeded(entry: PriceEntry): boolean {
  return entry.recordId.startsWith(SEEDED_PREFIX)
}
