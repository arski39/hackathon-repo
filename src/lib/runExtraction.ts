import { complete } from './anthropic'
import { validateDeal, type ValidationResult } from './validateDeal'
import { extractDealPrompt, retrySuffix } from '../prompts/extractDeal'
import { DEMO_EXTRACTION } from '../fixtures/demoExtraction'
import type { Deal, Message } from '../types'

export type ExtractionOutcome =
  | { kind: 'ok'; deal: Deal; warnings: string[] }
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
 * Thread in, Deal out.
 *
 * Validation failure is expected, not exceptional: one retry with the errors
 * fed back, and if that fails too the raw output goes to the user rather than
 * being replaced with a plausible-looking fake (section 11).
 */
export async function runExtraction(
  messages: Message[],
  options: { demoMode: boolean; apiKey: string; vatRatePercent: number },
  signal?: AbortSignal,
): Promise<ExtractionOutcome> {
  const today = new Date().toISOString().slice(0, 10)
  const finish = (result: ValidationResult, raw: string): ExtractionOutcome =>
    result.ok
      ? { kind: 'ok', deal: result.deal, warnings: result.warnings }
      : { kind: 'invalid', errors: result.errors, raw }

  if (options.demoMode) {
    await sleep(DEMO_DELAY_MS, signal)
    return finish(
      validateDeal(DEMO_EXTRACTION, messages, options.vatRatePercent),
      DEMO_EXTRACTION,
    )
  }

  const prompt = extractDealPrompt(messages, today)
  const first = await complete(options.apiKey, prompt, signal)
  const firstResult = validateDeal(first, messages, options.vatRatePercent)
  if (firstResult.ok) return finish(firstResult, first)

  const second = await complete(
    options.apiKey,
    prompt + retrySuffix(firstResult.errors, first),
    signal,
  )
  return finish(validateDeal(second, messages, options.vatRatePercent), second)
}
