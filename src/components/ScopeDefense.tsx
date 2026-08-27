import { useMemo, useRef, useState } from 'react'
import { CopyButton } from './CopyButton'
import { MoneyInput } from './MoneyInput'
import { SourceButton } from './SourceButton'
import { ThreadColumn } from './ThreadColumn'
import { ApiError } from '../lib/anthropic'
import { changeOrderText } from '../lib/changeOrder'
import { parseFollowUp } from '../lib/followUp'
import { formatEuros } from '../lib/money'
import { today } from '../lib/quote'
import { runScopeCheck } from '../lib/runScopeCheck'
import { SCOPE_CREEP_MESSAGE } from '../fixtures/heroThread'
import type { ActiveSource, ProvenanceApi } from '../lib/provenance'
import type { Settings } from './SettingsPanel'
import type { AbsorbedItem, Message, ProjectRecord, ScopeFlag } from '../types'

type Props = {
  record: ProjectRecord
  flags: ScopeFlag[]
  settings: Settings
  onRecordChange: (record: ProjectRecord) => void
  onFlagsChange: (flags: ScopeFlag[]) => void
  onBack: () => void
}

type Failure = { message: string; hint?: string; raw?: string }

/** All three actions are the same button. Bill it, absorb it and dismiss it are
 *  three equal answers (CLAUDE.md §6) — the tool has no opinion about which one
 *  the user should pick, and styling one as primary would be having one. */
const ACTION =
  'min-h-11 flex-1 basis-32 cursor-pointer rounded-md border border-line bg-white px-4 py-2.5 text-center font-medium transition-colors duration-150 hover:border-slate/40'

/** Deterministic, so undoing an absorb can find the row it created without
 *  putting a flag id on AbsorbedItem that §5 does not have. */
const absorbedIdFor = (flag: ScopeFlag) => `abs_${flag.id}`

export function ScopeDefense({
  record,
  flags,
  settings,
  onRecordChange,
  onFlagsChange,
  onBack,
}: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [lastIncoming, setLastIncoming] = useState<Message[]>([])
  const [pinned, setPinned] = useState<ActiveSource | null>(null)
  const [transient, setTransient] = useState<ActiveSource | null>(null)

  const markRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const active = pinned ?? transient

  const provenance: ProvenanceApi = {
    active,
    pinnedKey: pinned?.key ?? null,
    peek: setTransient,
    toggle: (source) =>
      setPinned((current) => (current?.key === source.key ? null : source)),
  }

  const mine = useMemo(
    () => flags.filter((f) => f.recordId === record.id),
    [flags, record.id],
  )

  // After a reload `lastIncoming` is empty but the flags are still here, so
  // fall back to whichever messages the flags actually point at.
  const shown = useMemo(() => {
    if (lastIncoming.length > 0) return lastIncoming
    const cited = new Set(mine.map((f) => f.messageId))
    return record.sourceThread.filter((m) => cited.has(m.id))
  }, [lastIncoming, mine, record.sourceThread])

  const changeOrder = useMemo(
    () => changeOrderText(record, mine),
    [record, mine],
  )

  const absorbedTotal = record.absorbedWork.reduce(
    (sum, item) => sum + item.estimatedValue,
    0,
  )

  const patchFlag = (id: string, changes: Partial<ScopeFlag>) =>
    onFlagsChange(flags.map((f) => (f.id === id ? { ...f, ...changes } : f)))

  const setPrice = (flag: ScopeFlag, cents: number) =>
    patchFlag(flag.id, {
      suggestedPrice: cents,
      estimatedValue: cents,
      // The basis described the model's number. Once the user types their own
      // it no longer does, and a stale basis is worse than none.
      priceBasis: null,
    })

  const absorb = (flag: ScopeFlag) => {
    const item: AbsorbedItem = {
      id: absorbedIdFor(flag),
      recordId: record.id,
      description: flag.whatWasAsked,
      estimatedValue: flag.estimatedValue ?? 0,
      absorbedAt: today(),
      note: '',
    }
    onRecordChange({
      ...record,
      absorbedWork: [...record.absorbedWork.filter((a) => a.id !== item.id), item],
    })
    patchFlag(flag.id, { status: 'absorbed' })
  }

  const undo = (flag: ScopeFlag) => {
    if (flag.status === 'absorbed') {
      onRecordChange({
        ...record,
        absorbedWork: record.absorbedWork.filter((a) => a.id !== absorbedIdFor(flag)),
      })
    }
    patchFlag(flag.id, { status: 'open' })
  }

  const noteFor = (flag: ScopeFlag) =>
    record.absorbedWork.find((a) => a.id === absorbedIdFor(flag))?.note ?? ''

  const setNote = (flag: ScopeFlag, note: string) =>
    onRecordChange({
      ...record,
      absorbedWork: record.absorbedWork.map((a) =>
        a.id === absorbedIdFor(flag) ? { ...a, note } : a,
      ),
    })

  async function check() {
    const incoming = parseFollowUp(draft, record.sourceThread)
    if (incoming.length === 0) {
      setFailure({ message: 'There is nothing to check yet.' })
      return
    }
    if (!settings.demoMode && settings.apiKey.trim() === '') {
      setFailure({
        message: 'No API key set.',
        hint: 'Add one in Settings, or switch Demo Mode back on to try it without a key.',
      })
      return
    }

    setBusy(true)
    setFailure(null)
    try {
      const outcome = await runScopeCheck(record, incoming, {
        demoMode: settings.demoMode,
        apiKey: settings.apiKey.trim(),
        redact: settings.redact,
      })
      if (outcome.kind === 'ok') {
        onRecordChange({
          ...record,
          sourceThread: [...record.sourceThread, ...incoming],
        })
        onFlagsChange([...flags, ...outcome.flags])
        setLastIncoming(incoming)
        setWarnings(outcome.warnings)
        setChecked(true)
        setDraft('')
      } else {
        setFailure({
          message: "That didn't come back in a shape we could use.",
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
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            A new message came in
          </h1>
          <p className="mt-1 max-w-xl text-slate">
            Paste it and we&rsquo;ll say where it differs from the record. What
            you do about that is yours &mdash; billing is one of three answers,
            not the right one.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm hover:border-slate/40"
        >
          Back to the record
        </button>
      </div>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
      >
        <label htmlFor="followUp" className="sr-only">
          The new message from the client
        </label>
        <textarea
          id="followUp"
          rows={6}
          value={draft}
          disabled={busy}
          onChange={(e) => {
            setDraft(e.target.value)
            setFailure(null)
          }}
          placeholder="heyy these look SO good — quick one…"
          className="w-full resize-y rounded-lg border border-line bg-white px-4 py-3 leading-relaxed focus:border-slate/50 disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="submit"
            disabled={busy || draft.trim() === ''}
            className="min-h-11 cursor-pointer rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Comparing…' : 'Compare it to the record'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(SCOPE_CREEP_MESSAGE)}
            disabled={busy}
            className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink disabled:opacity-40"
          >
            Use the example follow-up
          </button>
        </div>
      </form>

      {busy ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="mt-6 space-y-3 rounded-lg border border-line bg-white/60 p-5"
        >
          <p className="sr-only">Comparing the message to the record.</p>
          <div className="h-3 w-1/3 rounded-sm bg-line" />
          <div className="h-3 w-2/3 rounded-sm bg-line" />
        </div>
      ) : null}

      {failure ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-overdue/40 bg-overdue/6 px-4 py-4"
        >
          <p className="font-medium">{failure.message}</p>
          {failure.hint ? (
            <p className="mt-1 text-sm text-slate">{failure.hint}</p>
          ) : null}
          {failure.raw ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate underline underline-offset-4">
                Show what came back
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-line bg-white p-3 text-xs whitespace-pre-wrap">
                {failure.raw}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-line bg-white/70 px-4 py-3"
        >
          <p className="text-sm font-medium">A few things didn&rsquo;t line up</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {checked && mine.length === 0 && !busy ? (
        <div className="mt-6 rounded-lg border border-line bg-white/70 px-4 py-5">
          <p className="font-medium">Nothing here the record doesn&rsquo;t cover.</p>
          <p className="mt-1 text-slate">
            That is the usual answer, and it is worth having in writing. Most
            follow-ups are just follow-ups.
          </p>
        </div>
      ) : null}

      {mine.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          <ThreadColumn
            messages={shown}
            active={active}
            markRef={markRef}
            scrollRef={scrollRef}
            heading="The new message"
            label="The message you added"
          />

          <section aria-label="Differences from the record" className="min-w-0">
            <h2 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
              {mine.length} difference{mine.length === 1 ? '' : 's'}
            </h2>

            <ul className="mt-3 space-y-4">
              {mine.map((flag) => (
                <li
                  key={flag.id}
                  className={`rounded-lg border px-4 py-4 ${
                    flag.status === 'dismissed'
                      ? 'border-line bg-white/40 opacity-70'
                      : 'border-line bg-white'
                  }`}
                >
                  <p className="font-medium">{flag.whatWasAsked}</p>

                  <div className="mt-2">
                    <SourceButton
                      fieldKey={flag.id}
                      label={flag.whatWasAsked}
                      source={flag.source}
                      provenance={provenance}
                    />
                  </div>

                  <p className="mt-2.5 text-sm text-slate">
                    {flag.differenceFromRecord}
                  </p>

                  {flag.status === 'open' ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                        <div>
                          <label
                            htmlFor={`${flag.id}-price`}
                            className="block text-xs text-slate"
                          >
                            What is it worth?
                          </label>
                          <div className="mt-1">
                            <MoneyInput
                              id={`${flag.id}-price`}
                              value={flag.suggestedPrice ?? 0}
                              onChange={(cents) => setPrice(flag, cents)}
                              ariaDescribedBy={`${flag.id}-basis`}
                            />
                          </div>
                        </div>
                        <p
                          id={`${flag.id}-basis`}
                          className="max-w-xs pb-2 text-xs text-slate"
                        >
                          {flag.priceBasis
                            ? flag.priceBasis
                            : 'Nothing in the record prices this, so we haven’t guessed. Your number.'}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => patchFlag(flag.id, { status: 'billed' })}
                          className={ACTION}
                        >
                          Bill it
                        </button>
                        <button
                          type="button"
                          onClick={() => absorb(flag)}
                          className={ACTION}
                        >
                          Absorb it
                        </button>
                        <button
                          type="button"
                          onClick={() => patchFlag(flag.id, { status: 'dismissed' })}
                          className={ACTION}
                        >
                          Dismiss it
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 border-t border-line pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm">
                          {flag.status === 'billed' ? (
                            <>
                              <span className="font-medium">On the change order</span>
                              {flag.suggestedPrice && flag.suggestedPrice > 0
                                ? ` at ${formatEuros(flag.suggestedPrice)}.`
                                : ', price still to set.'}
                            </>
                          ) : flag.status === 'absorbed' ? (
                            <>
                              <span className="font-medium">Absorbed.</span>
                              {flag.estimatedValue && flag.estimatedValue > 0
                                ? ` Worth ${formatEuros(flag.estimatedValue)}, not billed.`
                                : ' No value recorded.'}
                            </>
                          ) : (
                            <span className="font-medium">Dismissed.</span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => undo(flag)}
                          className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
                        >
                          Undo
                        </button>
                      </div>

                      {flag.status === 'absorbed' ? (
                        <div className="mt-2">
                          <label
                            htmlFor={`${flag.id}-note`}
                            className="block text-xs text-slate"
                          >
                            Why, for your own records. Never leaves this app.
                          </label>
                          <input
                            id={`${flag.id}-note`}
                            value={noteFor(flag)}
                            onChange={(e) => setNote(flag, e.target.value)}
                            placeholder="Long-term client, worth the goodwill"
                            className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm focus:border-slate/50"
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {record.absorbedWork.length > 0 ? (
              <p className="mt-5 rounded-lg border border-overdue/40 bg-overdue/6 px-4 py-3">
                <span className="font-medium">
                  {formatEuros(absorbedTotal)} absorbed on this project.
                </span>{' '}
                <span className="text-slate">
                  Work you did and did not bill. Nobody sees this but you.
                </span>
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {changeOrder ? (
        <section
          aria-labelledby="change-order-heading"
          className="mt-10 rounded-lg border border-line bg-white/70 px-4 py-5 sm:px-5"
        >
          <h2 id="change-order-heading" className="font-display font-semibold">
            The change order
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate">
            The work and the price, and nothing about how it came up. Send it as
            it is.
          </p>
          <div className="mt-4">
            <CopyButton text={changeOrder} label="Copy the change order" />
          </div>
          <pre className="mt-4 max-h-72 overflow-auto rounded-md border border-line bg-white p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">
            {changeOrder}
          </pre>
        </section>
      ) : null}
    </div>
  )
}
