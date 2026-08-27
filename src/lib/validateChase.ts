import { allowedNumbers, numbersIn, type ChaseFacts } from './chase'
import { stripFences } from './validateRecord'

export type ChaseDraft = { subject: string; body: string }

export type ChaseResult =
  | { ok: true; draft: ChaseDraft; warnings: string[] }
  | { ok: false; errors: string[] }

/**
 * Things a payment reminder must never say, however the model got there.
 *
 * §13: the chase email is a draft, never a legal document. A user who sends a
 * threat because the tool wrote one for them is worse off than before they
 * installed it.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\blegal action\b|\bsue\b|\bcourt\b|\blitigat/i, why: 'threatened legal action' },
  { pattern: /\bdebt collect|\bcollections agenc|\bbailiff/i, why: 'threatened debt collection' },
  { pattern: /\blawyer\b|\bsolicitor\b|\battorney\b/i, why: 'invoked a lawyer' },
  { pattern: /\d\s*(?:%|per ?cent)/i, why: 'stated an interest rate or percentage' },
  { pattern: /\bstatutory\b|\brequired by law\b|\blegally obliged\b/i, why: 'claimed what the law requires' },
]

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/**
 * Turn raw model output into a sendable draft, or into reasons it is not one.
 *
 * The load-bearing check is the numeric one. Everywhere else in Backpay a
 * fabricated figure is embarrassing; in a payment reminder it is the thing that
 * makes the user look wrong in front of someone who owes them money. So every
 * digit run in the draft is matched against the facts we handed over, and one
 * that isn't there fails the whole draft rather than being quietly stripped —
 * a sentence with a number cut out of it does not survive the cut.
 */
export function validateChase(raw: string, facts: ChaseFacts): ChaseResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    return { ok: false, errors: ['The reply was not JSON.'] }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ['The reply was not a JSON object.'] }
  }

  const fields = parsed as Record<string, unknown>
  const subject = asText(fields.subject)
  const body = asText(fields.body)
  if (!subject) errors.push('No subject line.')
  if (!body) errors.push('No body.')
  if (!subject || !body) return { ok: false, errors }

  const text = `${subject}\n${body}`

  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) errors.push(`The draft ${rule.why}. Rewrite it without that.`)
  }

  const allowed = allowedNumbers(facts)
  const invented = [...new Set(numbersIn(text).filter((n) => !allowed.has(n)))]
  if (invented.length > 0) {
    errors.push(
      `The draft contains ${invented.length === 1 ? 'a number' : 'numbers'} that ` +
        `nobody gave you: ${invented.join(', ')}. Use only the facts listed, or ` +
        `write the sentence without a number.`,
    )
  }

  // Recoverable: a draft the user can read and fix beats a blank screen.
  if (/```|^#{1,6} |^[-*] /m.test(body)) {
    warnings.push('The draft came back with formatting in it. Check it before sending.')
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, draft: { subject, body }, warnings }
}
