import { newId } from './id'
import { lineTotalOf } from './money'
import { addDays, quoteTotals, today } from './quote'
import type { Deliverable, Invoice, ProjectRecord, ScopeFlag } from '../types'

/**
 * Sequential invoice numbers, `YYYY-NNN` — CLAUDE.md §6, Phase 3.
 *
 * Derived from the invoices already stored rather than from a separate counter.
 * A counter is one more thing that can drift out of step with reality, and when
 * it does the numbers it hands out are wrong in a way nobody notices for
 * months. This cannot disagree with the invoices, because it is computed from
 * them.
 *
 * The trade: deleting an invoice would let its number be reused. Nothing in
 * Backpay deletes one, and we are not the system of record — the user's
 * invoicing service is. If deletion ever arrives, this needs a high-water mark.
 */
export function nextInvoiceNumber(existing: Invoice[], year: number): string {
  const prefix = `${year}-`
  let highest = 0
  for (const invoice of existing) {
    if (!invoice.number.startsWith(prefix)) continue
    const n = Number(invoice.number.slice(prefix.length))
    if (Number.isFinite(n)) highest = Math.max(highest, n)
  }
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

/** A snapshot, not a reference. An invoice states what was billed on the day it
 *  was issued; editing the record afterwards must not rewrite it. */
function snapshot(line: Deliverable): Deliverable {
  return {
    id: newId('ln'),
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }
}

function build(
  record: ProjectRecord,
  number: string,
  kind: Invoice['kind'],
  lineItems: Deliverable[],
  issuedAt: string,
): Invoice {
  return {
    id: newId('inv'),
    recordId: record.id,
    number,
    kind,
    lineItems,
    issuedAt,
    dueAt: addDays(issuedAt, record.paymentTerms.netDays),
    status: 'draft',
    paidAt: null,
  }
}

export function depositInvoice(
  record: ProjectRecord,
  number: string,
  issuedAt = today(),
): Invoice {
  const { depositAmount } = quoteTotals(record)
  return build(
    record,
    number,
    'deposit',
    [
      {
        id: newId('ln'),
        description: `Deposit, ${record.paymentTerms.depositPercent}% of the agreed total`,
        quantity: 1,
        unitPrice: depositAmount,
      },
    ],
    issuedAt,
  )
}

/**
 * The balance, with the deposit shown as a deduction rather than silently
 * netted off. A client who paid a deposit should be able to see it on the
 * invoice that follows, or the total looks wrong and they ask.
 */
export function balanceInvoice(
  record: ProjectRecord,
  number: string,
  deposit: Invoice | null,
  issuedAt = today(),
): Invoice {
  const lines = record.deliverables.map(snapshot)
  if (deposit) {
    lines.push({
      id: newId('ln'),
      description: `Less deposit invoiced (${deposit.number})`,
      quantity: 1,
      unitPrice: -invoiceTotal(deposit),
    })
  }
  return build(record, number, 'balance', lines, issuedAt)
}

/** Only flags the user chose to bill, and only the ones that have a price.
 *  A zero on an invoice is the user agreeing to free work by accident. */
export function changeOrderInvoice(
  record: ProjectRecord,
  flags: ScopeFlag[],
  number: string,
  issuedAt = today(),
): Invoice | null {
  const lines = flags
    .filter((f) => f.status === 'billed' && (f.suggestedPrice ?? 0) > 0)
    .map((f) => ({
      id: newId('ln'),
      description: f.whatWasAsked,
      quantity: 1,
      unitPrice: f.suggestedPrice as number,
    }))
  if (lines.length === 0) return null
  return build(record, number, 'change-order', lines, issuedAt)
}

/** Unpriced lines are not zero and are not dropped — they simply are not in
 *  the total, and `unpricedLines` says how many (section 6). */
export function invoiceTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce(
    (sum, l) => sum + (lineTotalOf(l.quantity, l.unitPrice) ?? 0),
    0,
  )
}

export function unpricedLines(invoice: Invoice): number {
  return invoice.lineItems.filter((l) => l.unitPrice === null).length
}

export function isOverdue(invoice: Invoice, on = today()): boolean {
  return invoice.status === 'sent' && invoice.dueAt < on
}

export function daysOverdue(invoice: Invoice, on = today()): number {
  if (!isOverdue(invoice, on)) return 0
  const due = Date.parse(`${invoice.dueAt}T00:00:00Z`)
  const now = Date.parse(`${on}T00:00:00Z`)
  return Math.max(0, Math.round((now - due) / 86_400_000))
}

export const KIND_LABEL: Record<Invoice['kind'], string> = {
  deposit: 'Deposit',
  balance: 'Balance',
  'change-order': 'Change order',
}
