import type { Message, Provenance } from '../types'

function isRecordObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * A quote only earns a provenance line if it really is in the thread —
 * CLAUDE.md §8. The prompt's verbatim rule is unenforceable without this, and
 * an unverifiable quote is exactly the thing the user is trusting us about.
 *
 * With redaction on, `messages` is the *redacted* text that was actually sent
 * (§3). Checking against the original would fail every quote.
 */
export function checkProvenance(
  v: unknown,
  messages: Message[],
  label: string,
  warnings: string[],
): Provenance | undefined {
  if (!isRecordObject(v)) return undefined
  const quote = typeof v.quote === 'string' ? v.quote.trim() : ''
  const messageId = typeof v.messageId === 'string' ? v.messageId.trim() : ''
  if (!quote || !messageId) return undefined

  const named = messages.find((m) => m.id === messageId)
  if (named?.body.includes(quote)) return { quote, messageId }

  // Right quote, wrong message id — recoverable, so repair it quietly.
  const elsewhere = messages.find((m) => m.body.includes(quote))
  if (elsewhere) return { quote, messageId: elsewhere.id }

  warnings.push(`Dropped the source for ${label}: "${quote}" is not in the thread.`)
  return undefined
}
