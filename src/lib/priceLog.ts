import { EVIDENCE_FLOOR } from './capabilities'
import type { PriceEntry, ProjectRecord } from '../types'

/**
 * The learning corpus — CLAUDE.md §5 and §6.
 *
 * Every price the user enters or changes appends a row here. This is the only
 * thing RECALL is allowed to read and the only thing PROPOSE would be allowed
 * to derive from: a log of decisions the user made, which is exactly what makes
 * it citable back to them.
 *
 * It starts filling in Phase 1, long before anything reads it, because it
 * cannot be reconstructed later. A record's price can be edited afterwards; the
 * history of what was decided, and when, should not move with it.
 */
export function logPrice(
  log: PriceEntry[],
  record: ProjectRecord,
  deliverableDescription: string,
  amount: number,
  enteredBy: PriceEntry['enteredBy'] = 'user',
  at = new Date().toISOString(),
): PriceEntry[] {
  const description = deliverableDescription.trim()
  // A price typed against a line with no description yet teaches nothing —
  // "" is not a comparable, and a corpus full of them makes RECALL noisier
  // rather than better.
  if (description === '') return log

  const last = log[log.length - 1]
  // Typing "2", "20", "200" fires three changes. Only the last one is a
  // decision; the two before it are keystrokes, and logging them would make
  // the user look indecisive to a feature built on this data.
  if (
    last &&
    last.recordId === record.id &&
    last.deliverableDescription === description &&
    last.enteredBy === enteredBy &&
    Date.parse(at) - Date.parse(last.enteredAt) < 60_000
  ) {
    return [...log.slice(0, -1), { ...last, amount, enteredAt: at }]
  }

  return [
    ...log,
    {
      recordId: record.id,
      clientName: record.clientName.trim(),
      deliverableDescription: description,
      amount,
      enteredBy,
      enteredAt: at,
    },
  ]
}

/**
 * Words worth matching on.
 *
 * Anything with a digit in it is kept whatever its length: "15s", "30s", "4k"
 * are the details that separate one reel job from another, and dropping them as
 * too short makes every reel project look identical. Short pure-letter words
 * ("for", "and", "the") carry nothing and are dropped.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3 || /\d/.test(w))
}

/** Exact, or a prefix match between two words long enough for it to mean
 *  something — so "reel" finds "reels", but "3" never finds "30s". */
function matches(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  return a.startsWith(b) || b.startsWith(a)
}

/**
 * The user's own past prices for work like this — what RECALL shows in Phase 5.
 *
 * Returns the rows themselves, never a summary. §5 is explicit: an average has
 * no author and hides the thing that matters, which is that one of those
 * projects was a favour and the user knows which.
 */
export function comparables(
  log: PriceEntry[],
  description: string,
  excludeRecordId: string | null = null,
  limit = 6,
): PriceEntry[] {
  const wanted = tokenise(description)
  if (wanted.length === 0) return []

  return log
    .filter((entry) => entry.recordId !== excludeRecordId)
    .map((entry) => {
      const have = tokenise(entry.deliverableDescription)
      return { entry, hits: wanted.filter((w) => have.some((h) => matches(w, h))).length }
    })
    .filter((scored) => scored.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.entry.enteredAt.localeCompare(a.entry.enteredAt))
    .slice(0, limit)
    .map((scored) => scored.entry)
}

/**
 * The word this deliverable and its comparables actually have in common.
 *
 * Used only to name the offer out loud — *"You have 5 past projects with reels
 * in them"* — so that the prompt describes what it matched on rather than
 * asserting a category it invented.
 *
 * Two rules, both about the difference between matching and naming:
 *
 * - **A word with a digit in it is never the label if a word without one will
 *   do.** "15s" and "4k" earn their place in `tokenise` because they separate
 *   one reel job from another, which is matching. As a name they describe a
 *   spec rather than the work: "6 past prices with 15s in them" is a sentence
 *   about a duration.
 * - **A tie goes to the word that appears later.** English noun phrases put the
 *   head noun last, so "3 vertical reels" is about reels, not about vertical,
 *   and both match exactly the same rows.
 */
export function commonTerm(description: string, rows: PriceEntry[]): string | null {
  const score = (word: string) =>
    rows.filter((row) =>
      tokenise(row.deliverableDescription).some((h) => matches(word, h)),
    ).length

  const pick = (words: string[]) => {
    let best: string | null = null
    let bestCount = 0
    for (const word of words) {
      const count = score(word)
      if (count > 0 && count >= bestCount) {
        best = word
        bestCount = count
      }
    }
    return best
  }

  const words = tokenise(description)
  return pick(words.filter((w) => !/\d/.test(w))) ?? pick(words)
}

/** How many rows RECALL will show, and therefore how many the promotion offer
 *  may promise. One number, so the two can never disagree. */
export const RECALL_LIMIT = 8

/**
 * What RECALL is actually allowed to put on screen for one deliverable.
 *
 * Below the evidence floor it shows nothing at all rather than one row dressed
 * up as a pattern (§7 Phase 5, §14.2). The floor lives here rather than in the
 * component so that it cannot be forgotten by the next thing that renders rows,
 * and so it is testable without a browser.
 */
export function recallRows(
  log: PriceEntry[],
  description: string,
  excludeRecordId: string | null = null,
  limit = RECALL_LIMIT,
): PriceEntry[] {
  const rows = comparables(log, description, excludeRecordId, limit)
  return rows.length >= EVIDENCE_FLOOR ? rows : []
}
