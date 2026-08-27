import { formatEuros } from './money'
import { invoiceTotal, daysOverdue } from './invoices'
import { formatDate, today } from './quote'
import type { Invoice, ProjectRecord } from '../types'

/**
 * The chase — CLAUDE.md §7 Phase 4.
 *
 * Three tones that differ in *strategy*, not in adjectives. Friendly is the
 * default and the one that gets used: most late invoices are a few days late
 * and one polite nudge away from being paid.
 */
export type ChaseTone = 'friendly' | 'firm' | 'formal'

export const CHASE_TONES: ChaseTone[] = ['friendly', 'firm', 'formal']

/** Named in the UI exactly like this (§7). */
export const TONE_LABEL: Record<ChaseTone, string> = {
  friendly: 'Friendly',
  firm: 'Firm',
  formal: 'Formal notice',
}

export const TONE_STRATEGY: Record<ChaseTone, string> = {
  friendly: 'Assumes it slipped through and gives them an easy out. No consequence mentioned.',
  firm: 'States the days overdue plainly, restates the terms, asks for a payment date.',
  formal: 'References the agreement, states the amount and the deadline, neutral throughout.',
}

/**
 * Every figure the draft is allowed to contain, computed here and passed in.
 *
 * The model is never asked what anything costs or how late it is — it is handed
 * the numbers and told to write around them. Anything numeric it produces that
 * is not in this set is an invention, and `validateChase` rejects it.
 */
export type ChaseFacts = {
  clientName: string
  projectName: string
  yourName: string
  invoiceNumber: string
  amountCents: number
  amountText: string
  issuedAt: string
  issuedText: string
  dueAt: string
  dueText: string
  daysOverdue: number
  agreedText: string | null
  netDays: number
  asOfText: string
}

export function chaseFacts(
  record: ProjectRecord,
  invoice: Invoice,
  yourName: string,
  on = today(),
): ChaseFacts {
  // When the agreement happened, not when the record was typed up: the first
  // message in the thread is the date a client will recognise. A hand-built
  // record has no thread, and then we say nothing rather than guess.
  const firstMessage = record.sourceThread[0]?.receivedAt ?? null
  const agreedAt = firstMessage ? firstMessage.slice(0, 10) : null

  return {
    clientName: record.clientName.trim(),
    projectName: record.projectName.trim() || 'the project',
    yourName: yourName.trim(),
    invoiceNumber: invoice.number,
    amountCents: invoiceTotal(invoice),
    amountText: formatEuros(invoiceTotal(invoice)),
    issuedAt: invoice.issuedAt,
    issuedText: formatDate(invoice.issuedAt),
    dueAt: invoice.dueAt,
    dueText: formatDate(invoice.dueAt),
    daysOverdue: daysOverdue(invoice, on),
    agreedText: agreedAt ? formatDate(agreedAt) : null,
    netDays: record.paymentTerms.netDays,
    asOfText: formatDate(on),
  }
}

/** "1 day", "5 days" — a draft that says "1 days" reads as generated. */
export function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

/**
 * Every digit sequence the draft may legitimately contain.
 *
 * Both the run-together form ("200000" for 2 000,00 €) and each component
 * ("2026", "001" and "1" from invoice 2026-001), because there is no single
 * spelling of a date or an amount that a writer is obliged to use.
 */
export function allowedNumbers(facts: ChaseFacts): Set<string> {
  const allowed = new Set<string>()

  const add = (text: string | number | null) => {
    if (text === null) return
    const s = String(text)
    const joined = s.replace(/\D/g, '')
    if (joined !== '') {
      allowed.add(joined)
      allowed.add(joined.replace(/^0+/, '') || '0')
    }
    for (const part of s.split(/\D+/)) {
      if (part === '') continue
      allowed.add(part)
      allowed.add(part.replace(/^0+/, '') || '0')
    }
  }

  add(facts.invoiceNumber)
  add(facts.amountText)
  add(facts.amountCents)
  add(Math.round(facts.amountCents / 100))
  add(facts.issuedAt)
  add(facts.issuedText)
  add(facts.dueAt)
  add(facts.dueText)
  add(facts.daysOverdue)
  add(facts.netDays)
  add(facts.agreedText)
  add(facts.asOfText)
  add(facts.projectName)
  add(facts.clientName)
  add(facts.yourName)
  return allowed
}

/**
 * Digit runs in the draft, in the spellings a person actually writes:
 * "2 000,00", "12 September", "2026-001".
 *
 * Exactly one separator may sit between two digit groups. Two in a row ends
 * the run, which is what keeps "as of 20 October 2026, 40 days beyond" from
 * reading as the number 202640 and failing a draft that is perfectly correct.
 */
export function numbersIn(text: string): string[] {
  const found = text.match(/\d+(?:[\u00a0\u202f .,:/-]\d+)*/g) ?? []
  return found.map((run) => run.replace(/\D/g, '')).filter((run) => run !== '')
}

/**
 * A `mailto:` with no recipient.
 *
 * Backpay never learns the client's email address, and guessing one is how a
 * chase goes to the wrong person. The user's mail client opens with the draft
 * in it and they address it themselves — which is also the send button we
 * refuse to own (§13).
 */
export function mailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
