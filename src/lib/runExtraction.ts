import { complete } from './anthropic'
import { validateRecord, type ValidationResult } from './validateRecord'
import { extractRecordPrompt, retrySuffix } from '../prompts/extractRecord'
import { DEMO_EXTRACTION } from '../fixtures/demoExtraction'
import type { ProjectRecord, Message } from '../types'

export type ExtractionOutcome =
  | { kind: 'ok'; record: ProjectRecord; warnings: string[] }
  | { kind: 'invalid'; errors: string[]; raw: string }

/** Demo Mode: no network, no key, but not instant either — an answer that
 *  arrives in 0ms doesn't read as work being done. */
const DEMO_DELAY_MS = 1400

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

/**
 * Thread in, record out.
 *
 * Validation failure is expected, not exceptional: one retry with the errors
 * fed back, and if that fails too the raw output goes to the user rather than
 * being replaced with a plausible-looking fake (section 12).
 */
export async function runExtraction(
  messages: Message[],
  options: { demoMode: boolean; apiKey: string },
  signal?: AbortSignal,
): Promise<ExtractionOutcome> {
  const today = new Date().toISOString().slice(0, 10)
  const finish = (result: ValidationResult, raw: string): ExtractionOutcome =>
    result.ok
      ? { kind: 'ok', record: result.record, warnings: result.warnings }
      : { kind: 'invalid', errors: result.errors, raw }

  if (options.demoMode) {
    await sleep(DEMO_DELAY_MS, signal)
    return finish(
      validateRecord(DEMO_EXTRACTION, messages),
      DEMO_EXTRACTION,
    )
  }

  const prompt = extractRecordPrompt(messages, today)
  const first = await complete(options.apiKey, prompt, signal)
  const firstResult = validateRecord(first, messages)
  if (firstResult.ok) return finish(firstResult, first)

  const second = await complete(
    options.apiKey,
    prompt + retrySuffix(firstResult.errors, first),
    signal,
  )
  return finish(validateRecord(second, messages), second)
}
