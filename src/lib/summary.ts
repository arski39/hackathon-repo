import { formatEuros } from './money'
import { formatDate, quoteTotals } from './quote'
import type { ProjectRecord } from '../types'

/**
 * The record as plain text a person can paste into an email — CLAUDE.md §6,
 * Phase 1, and the §1 rule that every session ends in something sendable.
 *
 * Built from a template, with no API call: it is a restatement of what is
 * already on screen, and putting a model between the user and their own record
 * would add latency, cost and a chance of drift for nothing. Phase 3 builds the
 * outputs that need care; this one exists so Phase 1 does not end in a screen
 * that only stores.
 */
export function agreedSummary(record: ProjectRecord): string {
  const totals = quoteTotals(record)
  const lines: string[] = []

  lines.push(`What we agreed — ${record.projectName.trim() || 'the project'}`)
  if (record.clientName.trim()) lines.push(`Client: ${record.clientName.trim()}`)
  lines.push('')

  lines.push('Scope')
  for (const line of totals.lines) {
    const what = line.description.trim() || 'Untitled line'
    const count = line.quantity > 1 ? `${line.quantity} × ` : ''
    // A zero here is almost always a price nobody has set yet, not free work.
    // Printing "0,00 €" into something the client reads would quietly agree to
    // that on the user's behalf.
    const money = line.lineTotal > 0 ? formatEuros(line.lineTotal) : 'price not set'
    lines.push(`- ${count}${what} — ${money}`)
  }
  lines.push('')

  // Absorbed work is listed, but never priced here.
  //
  // What the client got is a fair thing to write down, and the user is worth
  // being seen to have delivered it. What it was worth is their own accounting
  // — that belongs in the app and in Phase 5's absorbed total, not in a
  // document that would read as an invoice for goodwill.
  if (record.absorbedWork.length > 0) {
    lines.push('Also included, at no additional charge')
    for (const item of record.absorbedWork) {
      lines.push(`- ${item.description.trim() || 'Additional work'}`)
    }
    lines.push('')
  }

  lines.push(`Total: ${formatEuros(totals.total)}`)

  const { depositPercent, netDays } = record.paymentTerms
  lines.push(
    depositPercent > 0
      ? `Payment: ${depositPercent}% deposit of ${formatEuros(totals.depositAmount)} on acceptance, ` +
          `${formatEuros(totals.balanceAmount)} on delivery. Invoices due net ${netDays} days.`
      : `Payment: full amount on delivery. Invoices due net ${netDays} days.`,
  )

  lines.push(
    record.deadline ? `Delivery: ${formatDate(record.deadline)}` : 'Delivery: no date agreed yet.',
  )

  lines.push(
    record.revisionsIncluded === 0
      ? 'Revisions: none included. Further rounds quoted separately.'
      : `Revisions: ${record.revisionsIncluded} round${record.revisionsIncluded === 1 ? '' : 's'} included. ` +
          'Further rounds quoted separately.',
  )

  // Stated rather than omitted. A gap the client can see is a gap they can
  // answer; a gap nobody writes down is the one that costs money later.
  lines.push(
    record.usageRights?.trim()
      ? `Usage rights: ${record.usageRights.trim()}`
      : 'Usage rights: not agreed yet. No usage is granted until the media, term and territory are set in writing.',
  )

  if (record.notes.trim()) {
    lines.push('')
    lines.push(`Notes: ${record.notes.trim()}`)
  }

  lines.push('')
  lines.push('Amounts are as agreed. VAT is not included or calculated here.')

  return lines.join('\n')
}
