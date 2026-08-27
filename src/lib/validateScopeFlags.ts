import { newId } from './id'
import { stripFences } from './validateRecord'
import { checkProvenance } from './verifyQuote'
import type { Message, ScopeFlag } from '../types'

export type ScopeValidation =
  | { ok: true; flags: ScopeFlag[]; warnings: string[] }
  | { ok: false; errors: string[] }

function isRecordObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/** Words the prompt bans. Checked rather than trusted: a flag that editorialises
 *  is worse than no flag, because it puts an opinion the user never asked for
 *  next to a button that charges their client (§8). */
const LOADED = /\b(scope creep|trying to|you should|push back|getting away|for free|cheeky|sneak)/i

/**
 * Model output into ScopeFlags — CLAUDE.md §8.
 *
 * Zero flags is a valid, common answer and is never an error. What *is*
 * rejected: a flag with no verifiable quote, and any price at all — §5 puts
 * scope-value estimation at OBSERVE, so the number is the user's to type.
 */
export function validateScopeFlags(
  raw: string,
  recordId: string,
  incoming: Message[],
): ScopeValidation {
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch (e) {
    return { ok: false, errors: [`Response was not valid JSON: ${(e as Error).message}`] }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isRecordObject(parsed) && Array.isArray(parsed.flags)
      ? parsed.flags
      : null

  if (list === null) {
    return { ok: false, errors: ['Expected an object with a "flags" array.'] }
  }

  const flags: ScopeFlag[] = list.flatMap((item, index): ScopeFlag[] => {
    const nth = `flag ${index + 1}`
    if (!isRecordObject(item)) {
      warnings.push(`Skipped ${nth}: not an object.`)
      return []
    }

    const whatWasAsked = asText(item.whatWasAsked)
    const differenceFromRecord = asText(item.differenceFromRecord)
    if (!whatWasAsked || !differenceFromRecord) {
      warnings.push(`Skipped ${nth}: it did not say what was asked for.`)
      return []
    }

    // Rule 5 is "no quote, no flag". A difference we cannot point at in the
    // message is a claim about a conversation the user had, with nothing
    // behind it.
    const source = checkProvenance(item.source, incoming, `"${whatWasAsked}"`, warnings)
    if (!source) {
      warnings.push(`Skipped "${whatWasAsked}": it isn't quoted in the message.`)
      return []
    }

    // `whatWasAsked` ends up on a change order the client reads. There is no
    // safe way to rewrite editorial into an invoice line, so the flag goes.
    if (LOADED.test(whatWasAsked)) {
      warnings.push(`Dropped a flag: "${whatWasAsked}" is a characterisation, not a line of work.`)
      return []
    }

    const loadedNote = LOADED.test(differenceFromRecord)
    if (loadedNote) {
      warnings.push(
        `Rewrote the note on "${whatWasAsked}": the model described the client rather than the difference.`,
      )
    }

    // Scope-value estimation is at OBSERVE (section 5). The schema has no price
    // field; if one arrives anyway it is dropped, and the user is told rather
    // than left wondering why a number they glimpsed is gone.
    if (item.suggestedPriceCents !== undefined && item.suggestedPriceCents !== null) {
      warnings.push(
        `Ignored a price for "${whatWasAsked}". Backpay doesn't price your work — that one's yours.`,
      )
    }

    return [
      {
        id: newId('flag'),
        recordId,
        messageId: source.messageId,
        whatWasAsked,
        // The note stays on screen only if it states a difference. When the
        // model characterises the client instead, its wording is discarded
        // rather than shown with a caveat — a caveat still shows it (§8).
        differenceFromRecord: loadedNote
          ? 'The record does not cover this.'
          : differenceFromRecord,
        source,
        suggestedPrice: null,
        priceBasis: null,
        estimatedValue: null,
        status: 'open',
      },
    ]
  })

  return { ok: true, flags, warnings }
}
