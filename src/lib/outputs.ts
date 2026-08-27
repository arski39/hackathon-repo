import { invoiceTotal, KIND_LABEL } from './invoices'
import { formatEuros } from './money'
import { formatDate, quoteTotals, quoteValidUntil, today } from './quote'
import type { Invoice, ProjectRecord, ScopeFlag } from '../types'

/** Every output goes through this, so a price nobody set never reaches a
 *  document. A zero on something a client reads is the user agreeing to free
 *  work by accident (CLAUDE.md §5). */
function priceOrGap(cents: number, gap = 'price not set'): string {
  return cents > 0 ? formatEuros(cents) : gap
}

function header(record: ProjectRecord, title: string): string[] {
  const lines = [`${title} — ${record.projectName.trim() || 'the project'}`]
  if (record.clientName.trim()) lines.push(`Client: ${record.clientName.trim()}`)
  return lines
}

const VAT_NOTE = 'Amounts are as agreed. VAT is not included or calculated here.'

/** The quote as plain text, for pasting into an email rather than printing. */
export function quoteText(
  record: ProjectRecord,
  from: { yourName: string; yourEmail: string; businessId: string },
  issuedAt = today(),
): string {
  const totals = quoteTotals(record)
  const lines = header(record, 'Quote')
  if (from.yourName.trim()) lines.push(`From: ${from.yourName.trim()}`)
  lines.push(`Issued: ${formatDate(issuedAt)}`)
  lines.push(`Valid until: ${formatDate(quoteValidUntil(issuedAt))}`)
  lines.push('')

  for (const line of totals.lines) {
    const count = line.quantity > 1 ? `${line.quantity} × ` : ''
    lines.push(`- ${count}${line.description || 'Untitled line'} — ${priceOrGap(line.lineTotal)}`)
  }
  lines.push('')
  lines.push(`Total: ${formatEuros(totals.total)}`)

  const { depositPercent, netDays } = record.paymentTerms
  lines.push(
    depositPercent > 0
      ? `Payment: ${depositPercent}% deposit of ${formatEuros(totals.depositAmount)} on acceptance, ` +
          `${formatEuros(totals.balanceAmount)} on delivery. Invoices due net ${netDays} days.`
      : `Payment: full amount on delivery. Invoices due net ${netDays} days.`,
  )
  lines.push(`Delivery: ${record.deadline ? formatDate(record.deadline) : 'to be agreed'}`)
  lines.push(
    record.revisionsIncluded === 0
      ? 'Revisions: none included. Further rounds quoted separately.'
      : `Revisions: ${record.revisionsIncluded} included. Further rounds quoted separately.`,
  )
  lines.push(
    record.usageRights?.trim()
      ? `Usage rights: ${record.usageRights.trim()}`
      : 'Usage rights: not yet agreed. No usage is granted by this quote until the media, term and territory are set in writing.',
  )
  if (from.businessId.trim()) lines.push(`Business ID: ${from.businessId.trim()}`)
  lines.push('')
  lines.push(VAT_NOTE)
  return lines.join('\n')
}

/**
 * What was agreed, what was added, what was billed, what was absorbed —
 * CLAUDE.md §6, Phase 3.
 *
 * Client-facing, so absorbed work is named but not priced, and dismissed flags
 * do not appear at all: the user decided those were not differences, and
 * listing them would resurrect an argument nobody is having.
 */
export function scopeSummaryText(record: ProjectRecord, flags: ScopeFlag[]): string {
  const mine = flags.filter((f) => f.recordId === record.id)
  const billed = mine.filter((f) => f.status === 'billed')
  const totals = quoteTotals(record)

  const lines = header(record, 'Scope summary')
  lines.push(`As of ${formatDate(today())}`)
  lines.push('')

  lines.push('Agreed at the start')
  for (const line of totals.lines) {
    const count = line.quantity > 1 ? `${line.quantity} × ` : ''
    lines.push(`- ${count}${line.description || 'Untitled line'} — ${priceOrGap(line.lineTotal)}`)
  }
  lines.push(`Agreed total: ${formatEuros(totals.total)}`)

  if (billed.length > 0) {
    lines.push('')
    lines.push('Added since, and invoiced separately')
    let extra = 0
    for (const flag of billed) {
      const price = flag.suggestedPrice ?? 0
      extra += Math.max(0, price)
      lines.push(`- ${flag.whatWasAsked} — ${priceOrGap(price, 'price to confirm')}`)
    }
    lines.push(`Additional total: ${formatEuros(extra)}`)
  }

  if (record.absorbedWork.length > 0) {
    lines.push('')
    lines.push('Added since, at no additional charge')
    for (const item of record.absorbedWork) {
      lines.push(`- ${item.description.trim() || 'Additional work'}`)
    }
  }

  lines.push('')
  lines.push(VAT_NOTE)
  return lines.join('\n')
}

/**
 * The reply for when a client misremembers — CLAUDE.md §6, Phase 3.
 *
 * It restates the record and shows the sentences it came from. The whole
 * difficulty here is tone: the same facts can read as a correction or as an
 * accusation, and the difference is one clause. So: no "as agreed", no "as you
 * can see", no "to be clear", nothing dated or numbered like evidence. It opens
 * by offering to put things in one place and closes by inviting a correction,
 * because the user has to keep working with this person on Monday.
 */
export function agreedReplyText(record: ProjectRecord): string {
  const name = record.clientName.trim()
  const totals = quoteTotals(record)
  const sources = record.fieldSources ?? {}

  const lines: string[] = []
  lines.push(name ? `Hi ${name},` : 'Hi,')
  lines.push('')
  lines.push(
    "Putting what we agreed in one place, with the lines from our thread so it's easy to check:",
  )
  lines.push('')

  for (const item of record.deliverables) {
    const count = item.quantity > 1 ? `${item.quantity} × ` : ''
    const total = item.quantity * item.unitPrice
    lines.push(`- ${count}${item.description || 'Untitled line'} — ${priceOrGap(total)}`)
    const quote = item.priceSource?.quote ?? item.source?.quote
    if (quote) lines.push(`  from: "${quote}"`)
  }

  lines.push('')
  lines.push(`Total: ${formatEuros(totals.total)}`)

  if (record.deadline) {
    lines.push(`Delivery: ${formatDate(record.deadline)}`)
    if (sources.deadline) lines.push(`  from: "${sources.deadline.quote}"`)
  }

  lines.push(
    record.revisionsIncluded === 0
      ? 'Revisions: none included, further rounds quoted separately.'
      : `Revisions: ${record.revisionsIncluded} included, further rounds quoted separately.`,
  )

  // Named rather than skipped. An unstated right is the gap that costs money,
  // and this is the message where it is cheapest to close.
  lines.push(
    record.usageRights?.trim()
      ? `Usage rights: ${record.usageRights.trim()}`
      : "Usage rights: we haven't set these yet — worth pinning down where and how long this runs.",
  )

  const { depositPercent, netDays } = record.paymentTerms
  lines.push(
    depositPercent > 0
      ? `Payment: ${depositPercent}% up front, the rest on delivery, net ${netDays} days.`
      : `Payment: on delivery, net ${netDays} days.`,
  )

  if (record.absorbedWork.length > 0) {
    lines.push('')
    lines.push('Also included since, at no extra charge:')
    for (const item of record.absorbedWork) {
      lines.push(`- ${item.description.trim() || 'Additional work'}`)
    }
  }

  lines.push('')
  lines.push("If any of that looks different from your notes, tell me and I'll update it.")
  return lines.join('\n')
}

/** One invoice as plain text. The printed version carries the same figures. */
export function invoiceText(
  record: ProjectRecord,
  invoice: Invoice,
  from: { yourName: string; yourEmail: string; businessId: string },
): string {
  const lines: string[] = []
  lines.push(`Invoice ${invoice.number} — ${KIND_LABEL[invoice.kind]}`)
  lines.push(`${record.projectName.trim() || 'the project'}`)
  if (record.clientName.trim()) lines.push(`For: ${record.clientName.trim()}`)
  if (from.yourName.trim()) lines.push(`From: ${from.yourName.trim()}`)
  if (from.businessId.trim()) lines.push(`Business ID: ${from.businessId.trim()}`)
  lines.push(`Issued: ${formatDate(invoice.issuedAt)}`)
  lines.push(`Due: ${formatDate(invoice.dueAt)}`)
  lines.push('')

  for (const line of invoice.lineItems) {
    const count = line.quantity > 1 ? `${line.quantity} × ` : ''
    const total = line.quantity * line.unitPrice
    // A deduction is negative and must show as one, not as "price not set".
    const money = total === 0 ? 'price not set' : formatEuros(total)
    lines.push(`- ${count}${line.description || 'Untitled line'} — ${money}`)
  }

  lines.push('')
  lines.push(`Total due: ${formatEuros(invoiceTotal(invoice))}`)
  lines.push('')
  lines.push(VAT_NOTE)
  return lines.join('\n')
}
