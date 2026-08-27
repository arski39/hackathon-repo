import { formatEuros } from '../lib/money'
import { formatDate } from '../lib/quote'
import type { PriceEntry } from '../types'

type Props = {
  rows: PriceEntry[]
  /** What the user is pricing right now, so the list can say what it matched. */
  description: string
}

/**
 * RECALL — CLAUDE.md §7 Phase 5.
 *
 * The user's own past prices, beside a field that is still blank. This
 * component does not fill anything in, does not sort by "best", and does not
 * compute anything.
 *
 * **It shows the rows.** Client, deliverable, what was charged, when. §5 is
 * explicit that a mean, a median or a range must never stand in for them: an
 * average has no author, and it hides the one thing that decides the question —
 * that the €900 job was a favour, and the user is the only person who knows it.
 * If a summary line ever appears here, it is a bug, not a refinement.
 */
export function Comparables({ rows, description }: Props) {
  if (rows.length === 0) return null

  return (
    <div className="mt-2 rounded-md border border-line bg-white/70 px-3 py-2.5">
      <p className="text-xs text-slate">
        What you charged before, for work like{' '}
        <span className="text-ink">{description.trim() || 'this'}</span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <li
            key={`${row.recordId}-${row.enteredAt}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
          >
            <span className="min-w-0">
              <span className="text-slate">{row.clientName || 'Unnamed client'}</span>
              <span className="text-slate/60"> · </span>
              {row.deliverableDescription}
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="font-mono tabular-nums">{formatEuros(row.amount)}</span>
              <span className="w-28 text-right text-xs text-slate">
                {formatDate(row.enteredAt.slice(0, 10))}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate/80">
        Yours, all of them. Backpay isn&rsquo;t averaging these or suggesting a
        number &mdash; you know which of those clients was a favour.
      </p>
    </div>
  )
}
