import { lineTotalOf } from './money'
import { QUOTE_VALID_DAYS } from '../config'
import type { ProjectRecord } from '../types'

export type QuoteLine = {
  id: string
  description: string
  quantity: number
  unitPrice: number | null
  /** null when the line has no price yet. Not zero — see section 6. */
  lineTotal: number | null
}

export type QuoteTotals = {
  lines: QuoteLine[]
  /** The lines that have a price. Unpriced lines are neither counted as zero
   *  nor dropped; they are reported separately so an output can say so. */
  total: number
  unpricedCount: number
  /** Of the total, because that is the number that actually gets paid. */
  depositAmount: number
  balanceAmount: number
}

/** All money stays in integer cents through every step. The only division is
 *  inside formatEuros, at the point of display. */
export function quoteTotals(record: ProjectRecord): QuoteTotals {
  const lines: QuoteLine[] = record.deliverables.map((d) => ({
    id: d.id,
    description: d.description,
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    lineTotal: lineTotalOf(d.quantity, d.unitPrice),
  }))

  // No VAT anywhere in Backpay (CLAUDE.md §6) — the total is the agreed sum.
  // At OBSERVE most records start with every line unpriced, so a partial total
  // is the normal case rather than an error state.
  const total = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0)
  const unpricedCount = lines.filter((line) => line.lineTotal === null).length
  const depositAmount = Math.round(
    (total * record.paymentTerms.depositPercent) / 100,
  )

  return {
    lines,
    total,
    unpricedCount,
    depositAmount,
    balanceAmount: total - depositAmount,
  }
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function quoteValidUntil(issuedAt: string): string {
  return addDays(issuedAt, QUOTE_VALID_DAYS)
}

/** Dates are read by a client, so spell the month out — 09/12 means two
 *  different days depending on which side of the Atlantic you're on. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
