import { complete } from './anthropic'
import { redactMessages, redactRecord, restoreFlags, restoreText } from './redact'
import { validateScopeFlags, type ScopeValidation } from './validateScopeFlags'
import { findScopeFlagsPrompt, scopeRetrySuffix } from '../prompts/findScopeFlags'
import { DEMO_SCOPE_FLAGS } from '../fixtures/demoScopeFlags'
import type { Message, ProjectRecord, ScopeFlag } from '../types'

export type ScopeOutcome =
  | { kind: 'ok'; flags: ScopeFlag[]; warnings: string[] }
  | { kind: 'invalid'; errors: string[]; raw: string }

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
 * A new message from the client, compared against the record — CLAUDE.md §6,
 * Phase 2.
 *
 * Zero flags is a real answer, not a failure. Most follow-ups ask for nothing
 * new, and a tool that finds something every time is one the user stops
 * believing by the fourth project.
 *
 * Redaction covers the record as well as the message here: they go out in the
 * same request, and redacting only the thread would put the client's name back
 * on the wire in the next paragraph (§3).
 */
export async function runScopeCheck(
  record: ProjectRecord,
  incoming: Message[],
  options: { demoMode: boolean; apiKey: string; redact: boolean },
  signal?: AbortSignal,
): Promise<ScopeOutcome> {
  const redaction =
    options.redact && !options.demoMode
      ? redactMessages([...record.sourceThread, ...incoming])
      : { messages: [...record.sourceThread, ...incoming], map: new Map<string, string>() }

  const sentIncoming = redaction.messages.slice(-incoming.length)
  const sentRecord = redactRecord(record, redaction.map)

  const finish = (result: ScopeValidation, raw: string): ScopeOutcome =>
    result.ok
      ? {
          kind: 'ok',
          flags: restoreFlags(result.flags, redaction.map),
          warnings: result.warnings.map((w) => restoreText(w, redaction.map)),
        }
      : { kind: 'invalid', errors: result.errors, raw }

  if (options.demoMode) {
    await sleep(DEMO_DELAY_MS, signal)
    return finish(
      validateScopeFlags(DEMO_SCOPE_FLAGS, record.id, sentIncoming),
      DEMO_SCOPE_FLAGS,
    )
  }

  const prompt = findScopeFlagsPrompt(sentRecord, sentIncoming)
  const first = await complete(options.apiKey, prompt, signal)
  const firstResult = validateScopeFlags(first, record.id, sentIncoming)
  if (firstResult.ok) return finish(firstResult, first)

  const second = await complete(
    options.apiKey,
    prompt + scopeRetrySuffix(firstResult.errors, first),
    signal,
  )
  return finish(validateScopeFlags(second, record.id, sentIncoming), second)
}
