import { useMemo } from 'react'
import { formatEuros, formatPrice } from '../lib/money'
import { formatDate, quoteTotals, quoteValidUntil, today } from '../lib/quote'
import type { Settings } from './SettingsPanel'
import type { ProjectRecord } from '../types'

type Props = {
  record: ProjectRecord
  settings: Settings
  /** Phase 3 owns the chrome around this sheet, but the usage-rights nudge
   *  still needs a way back to the field it is nagging about. */
  onFixUsageRights: () => void
}

/** The quote document itself. The actions live in Outputs (§6, Phase 3), so
 *  the same sheet can be printed from anywhere without carrying its own
 *  navigation into the print output. */
export function QuoteSheet({ record, settings, onFixUsageRights }: Props) {
  const issuedAt = useMemo(() => today(), [])
  const totals = useMemo(() => quoteTotals(record), [record])
  const hasDeposit = record.paymentTerms.depositPercent > 0

  return (
    <div className="mx-auto w-full max-w-3xl">
      {!record.usageRights ? (
        <div className="no-print rounded-lg border border-overdue/40 bg-overdue/6 px-4 py-4">
          <p className="font-medium">This quote grants no usage rights.</p>
          <p className="mt-1 text-slate">
            Nothing in the thread said where this work can run, for how long, or
            where. Sending it like this is how a launch campaign quietly becomes
            three years of media for the price of one. Go back and set it, or
            send it knowing the gap is there &mdash; the line below says as much
            to the client either way.
          </p>
          <button
            type="button"
            onClick={onFixUsageRights}
            className="mt-3 min-h-11 cursor-pointer text-sm underline underline-offset-4"
          >
            Set the usage rights
          </button>
        </div>
      ) : null}

      {!settings.yourName ? (
        <p className="no-print mt-4 rounded-lg border border-line bg-white/70 px-4 py-3 text-sm text-slate">
          This quote has no sender on it. Add your name in Settings and it will
          appear at the top.
        </p>
      ) : null}

      <article className="print-sheet mt-5 rounded-lg border border-line bg-white px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Quote
            </h1>
            <p className="mt-1 text-slate">
              {record.projectName || 'Untitled project'}
            </p>
          </div>
          <dl className="text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-slate">Issued</dt>
              <dd className="font-mono tabular-nums">{formatDate(issuedAt)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-6">
              <dt className="text-slate">Valid until</dt>
              <dd className="font-mono tabular-nums">
                {formatDate(quoteValidUntil(issuedAt))}
              </dd>
            </div>
          </dl>
        </header>

        <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-medium tracking-wide text-slate uppercase">
              From
            </h2>
            <p className="mt-1.5">{settings.yourName || '—'}</p>
            {settings.yourEmail ? (
              <p className="text-slate">{settings.yourEmail}</p>
            ) : null}
            {settings.businessId ? (
              <p className="font-mono text-sm text-slate">
                Business ID {settings.businessId}
              </p>
            ) : null}
          </div>
          <div>
            <h2 className="text-xs font-medium tracking-wide text-slate uppercase">
              For
            </h2>
            <p className="mt-1.5">{record.clientName || '—'}</p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="pb-2 text-xs font-medium tracking-wide text-slate uppercase">
                  Item
                </th>
                <th scope="col" className="pb-2 text-right text-xs font-medium tracking-wide text-slate uppercase">
                  Qty
                </th>
                <th scope="col" className="pb-2 text-right text-xs font-medium tracking-wide text-slate uppercase">
                  Unit
                </th>
                <th scope="col" className="pb-2 text-right text-xs font-medium tracking-wide text-slate uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line) => (
                <tr key={line.id} className="border-b border-line">
                  <td className="py-3 pr-4">{line.description || '—'}</td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {line.quantity}
                  </td>
                  <td className="py-3 pl-4 text-right font-mono tabular-nums">
                    {formatPrice(line.unitPrice, '—')}
                  </td>
                  <td className="py-3 pl-4 text-right font-mono tabular-nums">
                    {line.lineTotal === null ? (
                      <span className="font-sans text-sm text-slate">not priced</span>
                    ) : (
                      formatEuros(line.lineTotal)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={3}
                  className="border-t border-line pt-3 text-right font-medium"
                >
                  Total
                </td>
                <td className="border-t border-line pt-3 pl-4 text-right font-mono text-lg tabular-nums">
                  {formatEuros(totals.total)}
                  {totals.unpricedCount > 0 ? (
                    <span className="block font-sans text-sm font-normal text-slate">
                      {totals.unpricedCount} line{totals.unpricedCount === 1 ? '' : 's'} still to
                      price, not included
                    </span>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <dl className="print-keep mt-10 space-y-4 border-t border-line pt-6">
          <div className="sm:flex sm:gap-6">
            <dt className="text-xs font-medium tracking-wide text-slate uppercase sm:w-40 sm:shrink-0 sm:pt-0.5">
              Payment
            </dt>
            <dd>
              {hasDeposit ? (
                <>
                  {record.paymentTerms.depositPercent}% deposit of{' '}
                  <span className="font-mono tabular-nums">
                    {formatEuros(totals.depositAmount)}
                  </span>{' '}
                  on acceptance, balance of{' '}
                  <span className="font-mono tabular-nums">
                    {formatEuros(totals.balanceAmount)}
                  </span>{' '}
                  on delivery.
                </>
              ) : (
                'Full amount on delivery.'
              )}{' '}
              Invoices are due{' '}
              <span className="font-mono tabular-nums">
                net {record.paymentTerms.netDays}
              </span>{' '}
              days from the invoice date.
            </dd>
          </div>

          <div className="sm:flex sm:gap-6">
            <dt className="text-xs font-medium tracking-wide text-slate uppercase sm:w-40 sm:shrink-0 sm:pt-0.5">
              Delivery
            </dt>
            <dd className="font-mono tabular-nums">
              {formatDate(record.deadline)}
            </dd>
          </div>

          <div className="sm:flex sm:gap-6">
            <dt className="text-xs font-medium tracking-wide text-slate uppercase sm:w-40 sm:shrink-0 sm:pt-0.5">
              Revisions
            </dt>
            <dd>
              {record.revisionsIncluded === 0
                ? 'None included. Further rounds are quoted separately.'
                : `${record.revisionsIncluded} round${record.revisionsIncluded === 1 ? '' : 's'} included. Further rounds are quoted separately.`}
            </dd>
          </div>

          <div className="sm:flex sm:gap-6">
            <dt className="text-xs font-medium tracking-wide text-slate uppercase sm:w-40 sm:shrink-0 sm:pt-0.5">
              Usage rights
            </dt>
            <dd>
              {record.usageRights ?? (
                // Said plainly on the document itself, not just nudged on
                // screen. A gap the client can see is a gap they can answer.
                <span>
                  Not yet agreed. No usage is granted by this quote until the
                  media, term and territory are set in writing.
                </span>
              )}
            </dd>
          </div>

          {record.notes ? (
            <div className="sm:flex sm:gap-6">
              <dt className="text-xs font-medium tracking-wide text-slate uppercase sm:w-40 sm:shrink-0 sm:pt-0.5">
                Notes
              </dt>
              <dd className="whitespace-pre-wrap">{record.notes}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-10 border-t border-line pt-4 text-sm text-slate">
          Amounts are as agreed. Backpay does not calculate VAT &mdash; your
          invoicing service adds it if it applies to you.
        </p>
      </article>
    </div>
  )
}
