import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CopyButton } from './CopyButton'
import { ApiError } from '../lib/anthropic'
import {
  CHASE_TONES,
  chaseFacts,
  days,
  mailtoHref,
  TONE_LABEL,
  TONE_STRATEGY,
  type ChaseTone,
} from '../lib/chase'
import { daysOverdue, invoiceTotal, KIND_LABEL } from '../lib/invoices'
import { formatEuros } from '../lib/money'
import { formatDate } from '../lib/quote'
import { runChase } from '../lib/runChase'
import type { ChaseDraft as Draft } from '../lib/validateChase'
import type { Settings } from './SettingsPanel'
import type { Invoice, ProjectRecord } from '../types'

type Props = {
  record: ProjectRecord
  invoice: Invoice
  settings: Settings
  onBack: () => void
}

type Failure = { message: string; hint?: string; raw?: string }

const BUTTON =
  'min-h-11 cursor-pointer rounded-md border border-line bg-white px-4 py-2 text-sm hover:border-slate/40'

/**
 * The chase — CLAUDE.md §7 Phase 4.
 *
 * The screen opens on Friendly with the draft already written, because most
 * late invoices are a few days late and one polite nudge away from being paid.
 * Firm and Formal notice are one step away and plainly available; neither is
 * laid out as the destination.
 *
 * Chase tone is a laddered capability sitting at OBSERVE (§5), so nothing here
 * recommends a tone. Three equal options and one sensible default, chosen once
 * by us and not computed from anything about this client.
 */
export function ChaseDraft({ record, invoice, settings, onBack }: Props) {
  const [tone, setTone] = useState<ChaseTone>('friendly')
  // Kept per tone, so going back to one you have already read is instant and
  // costs nothing. Switching tones should feel like turning something over.
  const [drafts, setDrafts] = useState<Partial<Record<ChaseTone, Draft>>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  const facts = useMemo(
    () => chaseFacts(record, invoice, settings.yourName),
    [record, invoice, settings.yourName],
  )
  const late = daysOverdue(invoice)

  const draftFor = useCallback(
    async (which: ChaseTone) => {
      if (!settings.demoMode && settings.apiKey.trim() === '') {
        setFailure({
          message: 'No API key set.',
          hint: 'Add one in Settings, or switch Demo Mode back on to draft it without a key.',
        })
        return
      }
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller

      setBusy(true)
      setFailure(null)
      try {
        const outcome = await runChase(
          facts,
          which,
          record.sourceThread,
          {
            demoMode: settings.demoMode,
            apiKey: settings.apiKey.trim(),
            redact: settings.redact,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        if (outcome.kind === 'ok') {
          setDrafts((previous) => ({ ...previous, [which]: outcome.draft }))
          setWarnings(outcome.warnings)
        } else {
          setFailure({
            message: "That didn't come back as something you'd want to send.",
            hint: outcome.errors.join(' '),
            raw: outcome.raw,
          })
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const apiError = e instanceof ApiError ? e : null
        setFailure({
          message: apiError?.message ?? `Something went wrong: ${(e as Error).message}`,
          hint: apiError?.hint,
        })
      } finally {
        if (!controller.signal.aborted) setBusy(false)
      }
    },
    [facts, record.sourceThread, settings.apiKey, settings.demoMode, settings.redact],
  )

  // Opens on Friendly, already written. A screen about a late invoice that
  // makes you press a button first is a screen that makes you brace.
  const seen = drafts[tone] !== undefined
  useEffect(() => {
    // The lint rule is right in general and wrong here: this effect exists to
    // synchronise with an external system (the API), which is the case it
    // explicitly allows. The synchronous setState it objects to is the busy
    // flag, and a request that starts without one is a screen that looks stuck.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!seen) void draftFor(tone)
  }, [tone, seen, draftFor])

  useEffect(() => () => inFlight.current?.abort(), [])

  const draft = drafts[tone]
  const emailText = draft ? draft.subject + '\n\n' + draft.body : ''

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Draft the nudge
        </h1>
        <button type="button" onClick={onBack} className={BUTTON}>
          Back to the invoices
        </button>
      </div>

      <p className="mt-3 text-slate">
        Invoice <span className="font-mono tabular-nums">{invoice.number}</span>{' '}
        &middot; {KIND_LABEL[invoice.kind]} &middot; {formatEuros(invoiceTotal(invoice))}{' '}
        &middot; due {formatDate(invoice.dueAt)} &middot;{' '}
        <span className="font-medium text-overdue">{days(late)} overdue</span>
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Tone</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHASE_TONES.map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center rounded-md border px-4 py-2 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-ink/40 ${
                tone === option
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-white hover:border-slate/40'
              }`}
            >
              <input
                type="radio"
                name="tone"
                value={option}
                checked={tone === option}
                onChange={() => setTone(option)}
                className="sr-only"
              />
              {TONE_LABEL[option]}
            </label>
          ))}
        </div>
        <p className="mt-2 max-w-xl text-sm text-slate">{TONE_STRATEGY[tone]}</p>
      </fieldset>

      {tone === 'formal' ? (
        <p className="mt-3 max-w-xl rounded-md border border-line bg-white/70 px-4 py-3 text-sm text-slate">
          This is a draft email, not a legal notice. It says late payment
          interest applies as per the terms you agreed &mdash; it names no rate,
          and neither should you unless you know yours.
        </p>
      ) : null}

      <div aria-live="polite" className="mt-6">
        {busy ? (
          <p className="rounded-lg border border-line bg-white/70 px-4 py-4 text-slate">
            Writing the {TONE_LABEL[tone].toLowerCase()} version&hellip;
          </p>
        ) : failure ? (
          <div className="rounded-lg border border-overdue/40 bg-overdue/8 px-4 py-4">
            <p className="font-medium">{failure.message}</p>
            {failure.hint ? <p className="mt-1 text-slate">{failure.hint}</p> : null}
            {failure.raw ? (
              <>
                <p className="mt-3 text-sm text-slate">
                  Here is what actually came back, in full:
                </p>
                <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-line bg-white p-3 font-mono text-xs whitespace-pre-wrap">
                  {failure.raw}
                </pre>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void draftFor(tone)}
              className={`${BUTTON} mt-3`}
            >
              Try that again
            </button>
          </div>
        ) : draft ? (
          <>
            {warnings.length > 0 ? (
              <ul className="mb-4 space-y-1 text-sm text-slate">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <article className="rounded-lg border border-line bg-white px-5 py-5 sm:px-6">
              <p className="text-sm text-slate">Subject</p>
              <p className="mt-1 font-medium">{draft.subject}</p>
              <hr className="my-4 border-line" />
              <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                {draft.body}
              </p>
            </article>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CopyButton text={emailText} label="Copy the email" className={BUTTON} />
              <a
                href={mailtoHref(draft.subject, draft.body)}
                className={`${BUTTON} inline-flex items-center no-underline`}
              >
                Open in your email app
              </a>
              <button type="button" onClick={() => void draftFor(tone)} className={BUTTON}>
                Write it again
              </button>
            </div>
            <p className="mt-3 text-sm text-slate">
              It opens with the draft in it and no recipient. You put their
              address in and you press send &mdash; Backpay never does.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
