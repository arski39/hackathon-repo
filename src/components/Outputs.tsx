import { useMemo, useState } from 'react'
import { CopyButton } from './CopyButton'
import { QuoteSheet } from './QuoteSheet'
import { formatEuros, formatPrice } from '../lib/money'
import {
  balanceInvoice,
  changeOrderInvoice,
  daysOverdue,
  depositInvoice,
  invoiceTotal,
  isOverdue,
  nextInvoiceNumber,
  KIND_LABEL,
} from '../lib/invoices'
import { agreedReplyText, invoiceText, quoteText, scopeSummaryText } from '../lib/outputs'
import { formatDate, today } from '../lib/quote'
import type { Settings } from './SettingsPanel'
import type { Invoice, ProjectRecord, ScopeFlag } from '../types'

type Tab = 'quote' | 'scope' | 'invoices' | 'reply'

type Props = {
  record: ProjectRecord
  flags: ScopeFlag[]
  invoices: Invoice[]
  settings: Settings
  initialTab?: Tab
  onInvoicesChange: (invoices: Invoice[]) => void
  onBack: () => void
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'quote', label: 'Quote' },
  { key: 'scope', label: 'Scope summary' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'reply', label: 'What we agreed' },
]

const BUTTON =
  'min-h-11 cursor-pointer rounded-md border border-line bg-white px-4 py-2 text-sm hover:border-slate/40'

const SHEET =
  'print-sheet mt-5 rounded-lg border border-line bg-white px-5 py-6 sm:px-8 sm:py-8'

const PRE =
  'font-sans text-sm leading-relaxed whitespace-pre-wrap'

export function Outputs({
  record,
  flags,
  invoices,
  settings,
  initialTab = 'quote',
  onInvoicesChange,
  onBack,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)

  // A fresh object every render would re-render every document below it.
  const from = useMemo(
    () => ({
      yourName: settings.yourName,
      yourEmail: settings.yourEmail,
      businessId: settings.businessId,
    }),
    [settings.yourName, settings.yourEmail, settings.businessId],
  )

  const mineFlags = useMemo(
    () => flags.filter((f) => f.recordId === record.id),
    [flags, record.id],
  )
  const mine = useMemo(
    () => invoices.filter((i) => i.recordId === record.id),
    [invoices, record.id],
  )

  const quoteCopy = useMemo(() => quoteText(record, from), [record, from])
  const scopeCopy = useMemo(
    () => scopeSummaryText(record, mineFlags),
    [record, mineFlags],
  )
  const replyCopy = useMemo(() => agreedReplyText(record), [record])

  const deposit = mine.find((i) => i.kind === 'deposit') ?? null
  const hasBalance = mine.some((i) => i.kind === 'balance')
  const billable = mineFlags.some(
    (f) => f.status === 'billed' && (f.suggestedPrice ?? 0) > 0,
  )
  const hasChangeOrder = mine.some((i) => i.kind === 'change-order')

  const add = (invoice: Invoice | null) => {
    if (invoice) onInvoicesChange([...invoices, invoice])
  }
  const patch = (id: string, changes: Partial<Invoice>) =>
    onInvoicesChange(invoices.map((i) => (i.id === id ? { ...i, ...changes } : i)))

  const nextNumber = () => nextInvoiceNumber(invoices, Number(today().slice(0, 4)))

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <div className="no-print flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Things you can send
        </h1>
        <button type="button" onClick={onBack} className={BUTTON}>
          Back to the record
        </button>
      </div>

      <nav aria-label="Outputs" className="no-print mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => setTab(t.key)}
            className={`min-h-11 cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors duration-150 ${
              tab === t.key
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-white hover:border-slate/40'
            }`}
          >
            {t.label}
            {t.key === 'invoices' && mine.length > 0 ? (
              <span className="ml-2 font-mono text-xs tabular-nums">{mine.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'quote' ? (
        <section aria-label="Quote" className="mt-6">
          <div className="no-print flex flex-wrap items-center gap-3">
            <CopyButton text={quoteCopy} label="Copy as text" className={BUTTON} />
            <button type="button" onClick={() => window.print()} className={BUTTON}>
              Print or save as PDF
            </button>
          </div>
          <div className="mt-5">
            <QuoteSheet record={record} settings={settings} onFixUsageRights={onBack} />
          </div>
        </section>
      ) : null}

      {tab === 'scope' ? (
        <section aria-label="Scope summary" className="mt-6">
          <p className="no-print max-w-xl text-slate">
            What was agreed, what was added since, and what you took on without
            charging for it. The absorbed work is named but never priced &mdash;
            what it was worth is your business, not theirs.
          </p>
          <div className="no-print mt-4 flex flex-wrap items-center gap-3">
            <CopyButton text={scopeCopy} label="Copy the scope summary" className={BUTTON} />
            <button type="button" onClick={() => window.print()} className={BUTTON}>
              Print or save as PDF
            </button>
          </div>
          <article className={SHEET}>
            <pre className={PRE}>{scopeCopy}</pre>
          </article>
        </section>
      ) : null}

      {tab === 'reply' ? (
        <section aria-label="What we agreed" className="mt-6">
          <p className="no-print max-w-xl text-slate">
            For when a client remembers it differently. It restates the record
            and shows the lines from the thread, and it ends by asking them to
            correct it &mdash; because you still have to work with them on
            Monday.
          </p>
          <div className="no-print mt-4 flex flex-wrap items-center gap-3">
            <CopyButton text={replyCopy} label="Copy the reply" className={BUTTON} />
            <button type="button" onClick={() => window.print()} className={BUTTON}>
              Print or save as PDF
            </button>
          </div>
          <article className={SHEET}>
            <pre className={PRE}>{replyCopy}</pre>
          </article>
        </section>
      ) : null}

      {tab === 'invoices' ? (
        <section aria-label="Invoices" className="mt-6">
          <p className="no-print max-w-xl text-slate">
            Numbered in sequence and marked by hand. Nothing here sends, and
            nothing here charges anyone &mdash; you issue these from wherever you
            normally invoice.
          </p>

          <div className="no-print mt-4 flex flex-wrap gap-2">
            {record.paymentTerms.depositPercent > 0 && !deposit ? (
              <button
                type="button"
                onClick={() => add(depositInvoice(record, nextNumber()))}
                className={BUTTON}
              >
                Create the deposit invoice
              </button>
            ) : null}
            {!hasBalance ? (
              <button
                type="button"
                onClick={() => add(balanceInvoice(record, nextNumber(), deposit))}
                className={BUTTON}
              >
                {deposit ? 'Create the balance invoice' : 'Create the invoice'}
              </button>
            ) : null}
            {billable && !hasChangeOrder ? (
              <button
                type="button"
                onClick={() => add(changeOrderInvoice(record, mineFlags, nextNumber()))}
                className={BUTTON}
              >
                Create the change-order invoice
              </button>
            ) : null}
          </div>

          {mine.length === 0 ? (
            <p className="no-print mt-6 rounded-lg border border-line bg-white/70 px-4 py-4 text-slate">
              No invoices yet. The record has everything they need &mdash; make
              one when the work is agreed.
            </p>
          ) : (
            <ul className="mt-5 space-y-5">
              {mine.map((invoice) => {
                const overdue = isOverdue(invoice)
                const late = daysOverdue(invoice)
                return (
                  <li key={invoice.id} className={SHEET.replace('mt-5 ', '')}>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <h2 className="font-display font-semibold">
                          Invoice{' '}
                          <span className="font-mono tabular-nums">{invoice.number}</span>
                        </h2>
                        <p className="text-sm text-slate">
                          {KIND_LABEL[invoice.kind]} &middot; issued{' '}
                          {formatDate(invoice.issuedAt)} &middot; due{' '}
                          {formatDate(invoice.dueAt)}
                        </p>
                      </div>
                      {invoice.status === 'paid' ? (
                        <span className="rounded-full border border-paid/40 bg-paid/10 px-2.5 py-1 text-xs text-ink">
                          Paid {invoice.paidAt ? formatDate(invoice.paidAt) : ''}
                        </span>
                      ) : overdue ? (
                        <span className="rounded-full border border-overdue/40 bg-overdue/12 px-2.5 py-1 text-xs font-medium text-ink">
                          {late} day{late === 1 ? '' : 's'} overdue
                        </span>
                      ) : (
                        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-slate">
                          {invoice.status === 'sent' ? 'Sent' : 'Draft'}
                        </span>
                      )}
                    </div>

                    <table className="mt-4 w-full border-collapse text-left text-sm">
                      <tbody>
                        {invoice.lineItems.map((line) => (
                          <tr key={line.id} className="border-b border-line">
                            <td className="py-2 pr-4">{line.description}</td>
                            <td className="py-2 text-right font-mono tabular-nums">
                              {line.quantity > 1 ? `${line.quantity} × ` : ''}
                              {formatPrice(line.unitPrice, 'not priced')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="pt-3 text-right font-medium">Total due</td>
                          <td
                            className={`pt-3 pl-4 text-right font-mono text-lg tabular-nums ${
                              overdue ? 'text-overdue' : ''
                            }`}
                          >
                            {formatEuros(invoiceTotal(invoice))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    <div className="no-print mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                      {invoice.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => patch(invoice.id, { status: 'sent' })}
                          className={BUTTON}
                        >
                          I&rsquo;ve sent it
                        </button>
                      ) : null}
                      {invoice.status === 'sent' ? (
                        <button
                          type="button"
                          onClick={() =>
                            patch(invoice.id, { status: 'paid', paidAt: today() })
                          }
                          className={BUTTON}
                        >
                          Mark it paid
                        </button>
                      ) : null}
                      {invoice.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => patch(invoice.id, { status: 'sent', paidAt: null })}
                          className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
                        >
                          Undo
                        </button>
                      ) : null}
                      <CopyButton
                        text={invoiceText(record, invoice, from)}
                        label="Copy as text"
                        className={BUTTON}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
