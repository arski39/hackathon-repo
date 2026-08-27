import { useCallback, useMemo, useRef, useState } from 'react'
import { Field } from './Field'
import { MoneyInput } from './MoneyInput'
import { SourceButton } from './SourceButton'
import { ThreadColumn } from './ThreadColumn'
import { formatEuros } from '../lib/money'
import { newId } from '../lib/id'
import { useConnector } from '../lib/useConnector'
import type { ActiveSource, ProvenanceApi } from '../lib/provenance'
import type { ProjectRecord, Deliverable } from '../types'

const input =
  'w-full rounded-md border border-line bg-white px-2.5 py-1.5 focus:border-slate/50'

const numeric =
  'rounded-md border border-line bg-white px-2.5 py-1.5 font-mono tabular-nums focus:border-slate/50'

type Props = {
  record: ProjectRecord
  warnings: string[]
  onChange: (record: ProjectRecord) => void
  onStartOver: () => void
  onSeeQuote: () => void
}

export function RecordReview({
  record,
  warnings,
  onChange,
  onStartOver,
  onSeeQuote,
}: Props) {
  const [pinned, setPinned] = useState<ActiveSource | null>(null)
  const [transient, setTransient] = useState<ActiveSource | null>(null)
  const active = pinned ?? transient

  const frameRef = useRef<HTMLDivElement | null>(null)
  const markRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rows = useRef(new Map<string, HTMLElement>())

  const registerRow = useCallback((key: string, node: HTMLDivElement | null) => {
    if (node) rows.current.set(key, node)
    else rows.current.delete(key)
  }, [])

  const connector = useConnector(frameRef, markRef, rows, active?.key ?? null)

  const provenance: ProvenanceApi = {
    active,
    pinnedKey: pinned?.key ?? null,
    peek: setTransient,
    toggle: (source) =>
      setPinned((current) => (current?.key === source.key ? null : source)),
  }

  const patch = (changes: Partial<ProjectRecord>) => onChange({ ...record, ...changes })

  const setDeliverable = (id: string, changes: Partial<Deliverable>) =>
    patch({
      deliverables: record.deliverables.map((d) =>
        d.id === id ? { ...d, ...changes } : d,
      ),
    })

  const subtotal = useMemo(
    () => record.deliverables.reduce((sum, d) => sum + d.quantity * d.unitPrice, 0),
    [record.deliverables],
  )

  const sources = record.fieldSources ?? {}

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Check what we read
          </h1>
          <p className="mt-1 max-w-xl text-slate">
            Every value points at the sentence it came from. Change anything
            that&rsquo;s wrong &mdash; this is a first draft, not a verdict.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartOver}
            className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm hover:border-slate/40"
          >
            Paste a different thread
          </button>
          <button
            type="button"
            onClick={onSeeQuote}
            className="min-h-11 cursor-pointer rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition-opacity duration-150 hover:opacity-90"
          >
            See the quote
          </button>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div
          role="status"
          className="mt-5 rounded-lg border border-line bg-white/70 px-4 py-3"
        >
          <p className="text-sm font-medium">A few things didn&rsquo;t line up</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={frameRef}
        className="relative mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10"
      >
        {connector ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
          >
            <path
              d={connector.d}
              fill="none"
              stroke="var(--color-overdue)"
              strokeWidth="1"
              strokeOpacity="0.55"
            />
            <circle
              cx={connector.to[0]}
              cy={connector.to[1]}
              r="2.5"
              fill="var(--color-overdue)"
              fillOpacity="0.7"
            />
          </svg>
        ) : null}

        <ThreadColumn
          messages={record.sourceThread}
          active={active}
          markRef={markRef}
          scrollRef={scrollRef}
        />

        <section aria-label="What we read from it" className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
            What it means
          </h2>

          <div className="mt-3 space-y-1">
            <div className="grid gap-1 sm:grid-cols-2">
              <Field
                fieldKey="clientName"
                label="Client"
                source={sources.clientName}
                provenance={provenance}
                registerRow={registerRow}
              >
                <input
                  id="clientName"
                  className={input}
                  value={record.clientName}
                  onChange={(e) => patch({ clientName: e.target.value })}
                />
              </Field>
              <Field
                fieldKey="projectName"
                label="Project"
                source={sources.projectName}
                provenance={provenance}
                registerRow={registerRow}
              >
                <input
                  id="projectName"
                  className={input}
                  value={record.projectName}
                  onChange={(e) => patch({ projectName: e.target.value })}
                />
              </Field>
            </div>

            <fieldset className="rounded-lg border border-line px-3 py-3">
              <legend className="px-1 text-sm font-medium tracking-wide text-slate uppercase">
                Deliverables
              </legend>
              <ul className="space-y-4">
                {record.deliverables.map((item) => (
                  <li key={item.id} className="space-y-2">
                    <div ref={(node) => registerRow(`${item.id}.line`, node)}>
                      <label htmlFor={`${item.id}-desc`} className="sr-only">
                        Deliverable description
                      </label>
                      <input
                        id={`${item.id}-desc`}
                        className={input}
                        placeholder="What you are delivering"
                        value={item.description}
                        onChange={(e) =>
                          setDeliverable(item.id, { description: e.target.value })
                        }
                      />
                      <div className="mt-1.5">
                        <SourceButton
                          fieldKey={`${item.id}.line`}
                          label={item.description || 'this line'}
                          source={item.source}
                          provenance={provenance}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                      <div>
                        <label
                          htmlFor={`${item.id}-qty`}
                          className="block text-xs text-slate"
                        >
                          Quantity
                        </label>
                        <input
                          id={`${item.id}-qty`}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            setDeliverable(item.id, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className={`mt-1 w-20 ${numeric}`}
                        />
                      </div>

                      <div ref={(node) => registerRow(`${item.id}.price`, node)}>
                        <label
                          htmlFor={`${item.id}-price`}
                          className="block text-xs text-slate"
                        >
                          Unit price
                        </label>
                        <div className="mt-1">
                          <MoneyInput
                            id={`${item.id}-price`}
                            value={item.unitPrice}
                            onChange={(cents) =>
                              setDeliverable(item.id, { unitPrice: cents })
                            }
                          />
                        </div>
                        <div className="mt-1.5">
                          <SourceButton
                            fieldKey={`${item.id}.price`}
                            label={`the price of ${item.description || 'this line'}`}
                            source={item.priceSource}
                            provenance={provenance}
                          />
                        </div>
                      </div>

                      <p className="ml-auto font-mono tabular-nums">
                        {formatEuros(item.quantity * item.unitPrice)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      deliverables: [
                        ...record.deliverables,
                        {
                          id: newId('dlv'),
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                        },
                      ],
                    })
                  }
                  className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
                >
                  Add a line
                </button>
                <p className="font-mono tabular-nums">
                  <span className="mr-3 font-sans text-sm text-slate">Total</span>
                  {formatEuros(subtotal)}
                </p>
              </div>
            </fieldset>

            <div className="grid gap-1 sm:grid-cols-2">
              <Field
                fieldKey="deadline"
                label="Deadline"
                source={sources.deadline}
                provenance={provenance}
                registerRow={registerRow}
              >
                <input
                  id="deadline"
                  type="date"
                  className={`w-full ${numeric}`}
                  value={record.deadline ?? ''}
                  onChange={(e) => patch({ deadline: e.target.value || null })}
                />
              </Field>
              <Field
                fieldKey="revisionsIncluded"
                label="Revisions included"
                source={sources.revisionsIncluded}
                provenance={provenance}
                registerRow={registerRow}
              >
                <input
                  id="revisionsIncluded"
                  type="number"
                  min={0}
                  className={`w-full ${numeric}`}
                  value={record.revisionsIncluded}
                  onChange={(e) =>
                    patch({
                      revisionsIncluded: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </Field>
            </div>

            <Field
              fieldKey="usageRights"
              label="Usage rights"
              source={sources.usageRights}
              provenance={provenance}
              registerRow={registerRow}
              hint={
                record.usageRights
                  ? undefined
                  : 'Nobody mentioned rights. Where can they run this, for how long, and in which countries? Unstated usage rights are how a launch campaign quietly becomes three years of media.'
              }
            >
              <input
                id="usageRights"
                className={input}
                placeholder="e.g. social only, 6 months, Finland"
                aria-describedby={
                  record.usageRights ? undefined : 'usageRights-hint'
                }
                value={record.usageRights ?? ''}
                onChange={(e) => patch({ usageRights: e.target.value || null })}
              />
            </Field>

            <div className="grid gap-1 sm:grid-cols-2">
              <Field
                fieldKey="depositPercent"
                label="Deposit"
                source={sources.depositPercent}
                provenance={provenance}
                registerRow={registerRow}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    id="depositPercent"
                    type="number"
                    min={0}
                    max={100}
                    className={`w-24 ${numeric}`}
                    value={record.paymentTerms.depositPercent}
                    onChange={(e) =>
                      patch({
                        paymentTerms: {
                          ...record.paymentTerms,
                          depositPercent: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        },
                      })
                    }
                  />
                  <span className="text-slate">%</span>
                </div>
              </Field>
              <Field
                fieldKey="netDays"
                label="Payment terms"
                source={sources.netDays}
                provenance={provenance}
                registerRow={registerRow}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate">Net</span>
                  <input
                    id="netDays"
                    type="number"
                    min={1}
                    className={`w-24 ${numeric}`}
                    value={record.paymentTerms.netDays}
                    onChange={(e) =>
                      patch({
                        paymentTerms: {
                          ...record.paymentTerms,
                          netDays: Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                  />
                  <span className="text-slate">days</span>
                </div>
              </Field>
            </div>

            <div className="px-3 py-3">
              <label
                htmlFor="notes"
                className="block text-sm font-medium tracking-wide text-slate uppercase"
              >
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                className={`mt-1.5 ${input}`}
                value={record.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
