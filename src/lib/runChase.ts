import { complete } from './anthropic'
import { redactMessages, redactText, restoreText } from './redact'
import { validateChase, type ChaseDraft } from './validateChase'
import { chasePrompt } from '../prompts/draftChase'
import { retrySuffix } from '../prompts/extractRecord'
import { demoChase } from '../fixtures/demoChase'
import { sleep, DEMO_DELAY_MS } from './demoDelay'
import type { ChaseFacts, ChaseTone } from './chase'
import type { Message } from '../types'

export type ChaseOutcome =
  | { kind: 'ok'; draft: ChaseDraft; warnings: string[] }
  | { kind: 'invalid'; errors: string[]; raw: string }

/**
 * Facts in, draft out — CLAUDE.md §7 Phase 4.
 *
 * Same shape as extraction: one retry with the errors fed back, then the raw
 * output goes to the user rather than a plausible-looking fake (§13). And the
 * same redaction ordering (§3) — the model only ever sees the redacted names,
 * so the draft comes back with placeholders in it and they are put back here,
 * on this machine, before anyone reads it.
 */
export async function runChase(
  facts: ChaseFacts,
  tone: ChaseTone,
  thread: Message[],
  options: { demoMode: boolean; apiKey: string; redact: boolean },
  signal?: AbortSignal,
): Promise<ChaseOutcome> {
  const redaction =
    options.redact && !options.demoMode
      ? redactMessages(thread)
      : { messages: thread, map: new Map<string, string>() }

  const sent: ChaseFacts =
    redaction.map.size === 0
      ? facts
      : {
          ...facts,
          clientName: redactText(facts.clientName, redaction.map),
          projectName: redactText(facts.projectName, redaction.map),
          yourName: redactText(facts.yourName, redaction.map),
        }

  const finish = (raw: string): ChaseOutcome => {
    const result = validateChase(raw, sent)
    if (!result.ok) return { kind: 'invalid', errors: result.errors, raw }
    return {
      kind: 'ok',
      draft: {
        subject: restoreText(result.draft.subject, redaction.map),
        body: restoreText(result.draft.body, redaction.map),
      },
      warnings: result.warnings,
    }
  }

  if (options.demoMode) {
    await sleep(DEMO_DELAY_MS, signal)
    return finish(demoChase(sent, tone))
  }

  const prompt = chasePrompt(sent, tone)
  const first = await complete(options.apiKey, prompt, signal)
  const firstOutcome = finish(first)
  if (firstOutcome.kind === 'ok') return firstOutcome

  const second = await complete(
    options.apiKey,
    prompt + retrySuffix(firstOutcome.errors, first),
    signal,
  )
  return finish(second)
}
