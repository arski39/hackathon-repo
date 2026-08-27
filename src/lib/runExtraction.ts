import { complete } from './anthropic'
import { sleep, DEMO_DELAY_MS } from './demoDelay'
import { redactMessages, restoreRecord, restoreText } from './redact'
import { validateRecord, type ValidationResult } from './validateRecord'
import { extractRecordPrompt, retrySuffix } from '../prompts/extractRecord'
import { DEMO_EXTRACTION } from '../fixtures/demoExtraction'
import type { Message, ProjectRecord } from '../types'

export type ExtractionOutcome =
  | { kind: 'ok'; record: ProjectRecord; warnings: string[] }
  | { kind: 'invalid'; errors: string[]; raw: string }

/**
 * Thread in, record out.
 *
 * Validation failure is expected, not exceptional: one retry with the errors
 * fed back, and if that fails too the raw output goes to the user rather than
 * being replaced with a plausible-looking fake (section 12).
 *
 * Redaction changes what "the thread" means partway through, and the order
 * matters (section 3): the model only ever sees the redacted text, so its
 * quotes are verified against *that*, and the real names go back afterwards.
 * Verifying against the original would fail every quote and look like the
 * model misbehaving.
 */
export async function runExtraction(
  messages: Message[],
  options: { demoMode: boolean; apiKey: string; redact: boolean },
  signal?: AbortSignal,
): Promise<ExtractionOutcome> {
  const today = new Date().toISOString().slice(0, 10)

  // Demo Mode sends nothing anywhere, so there is nothing to redact. Doing it
  // anyway would only break the fixture's quotes against the fixture's thread.
  const redaction =
    options.redact && !options.demoMode
      ? redactMessages(messages)
      : { messages, map: new Map<string, string>() }

  const sent = redaction.messages

  const finish = (result: ValidationResult, raw: string): ExtractionOutcome =>
    result.ok
      ? {
          kind: 'ok',
          record: restoreRecord(result.record, redaction.map, messages),
          warnings: result.warnings.map((w) => restoreText(w, redaction.map)),
        }
      : { kind: 'invalid', errors: result.errors, raw }

  if (options.demoMode) {
    await sleep(DEMO_DELAY_MS, signal)
    return finish(validateRecord(DEMO_EXTRACTION, sent), DEMO_EXTRACTION)
  }

  const prompt = extractRecordPrompt(sent, today)
  const first = await complete(options.apiKey, prompt, signal)
  const firstResult = validateRecord(first, sent)
  if (firstResult.ok) return finish(firstResult, first)

  const second = await complete(
    options.apiKey,
    prompt + retrySuffix(firstResult.errors, first),
    signal,
  )
  return finish(validateRecord(second, sent), second)
}
