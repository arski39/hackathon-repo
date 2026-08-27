import { vatOf } from './money'
import { QUOTE_VALID_DAYS } from '../config'
import type { ProjectRecord } from '../types'

export type QuoteLine = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type QuoteTotals = {
  lines: QuoteLine[]
  subtotal: number
  vat: number
  total: number
  /** Of the gross total, because that is the number that actually gets paid. */
  depositAmount: number
  balanceAmount: number
}

/** All money stays in integer cents through every step. The only division is
 *  inside formatEuros, at the point of display. */
export function quoteTotals(record: ProjectRecord): QuoteTotals {
  const lines = record.deliverables.map((d) => ({
    id: d.id,
    description: d.description,
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    lineTotal: d.quantity * d.unitPrice,
  }))

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const vat = vatOf(subtotal, record.vatRatePercent)
  const total = subtotal + vat
  const depositAmount = Math.round(
    (total * record.paymentTerms.depositPercent) / 100,
  )

  return {
    lines,
    subtotal,
    vat,
    total,
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
