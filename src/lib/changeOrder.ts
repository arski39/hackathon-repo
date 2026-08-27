import { formatEuros } from './money'
import { formatDate, today } from './quote'
import type { ProjectRecord, ScopeFlag } from '../types'

/**
 * The billed flags as a change order — CLAUDE.md §6, Phase 2.
 *
 * It restates the work and the price. It never restates the flag (§8): the
 * client does not need to be told which line of theirs tripped a comparison,
 * and `differenceFromRecord` is a private note to the user. Templated, no API
 * call — every word here already exists in the record.
 */
export function changeOrderText(record: ProjectRecord, flags: ScopeFlag[]): string {
  const billed = flags.filter((f) => f.status === 'billed')
  if (billed.length === 0) return ''

  const lines: string[] = []
  lines.push(`Change order — ${record.projectName.trim() || 'the project'}`)
  if (record.clientName.trim()) lines.push(`For: ${record.clientName.trim()}`)
  lines.push(`Date: ${formatDate(today())}`)
  lines.push('')
  lines.push('In addition to the agreed scope:')

  let total = 0
  let anyUnpriced = false
  for (const flag of billed) {
    if (flag.suggestedPrice !== null && flag.suggestedPrice > 0) {
      total += flag.suggestedPrice
      lines.push(`- ${flag.whatWasAsked} — ${formatEuros(flag.suggestedPrice)}`)
    } else {
      // Never print 0,00 € into something a client reads. A zero is a price
      // nobody set, and putting it on a change order agrees to free work.
      anyUnpriced = true
      lines.push(`- ${flag.whatWasAsked} — price to confirm`)
    }
  }

  lines.push('')
  lines.push(
    anyUnpriced
      ? `Additional so far: ${formatEuros(total)}, plus the lines marked to confirm.`
      : `Additional total: ${formatEuros(total)}`,
  )
  lines.push(
    `Payment terms are unchanged: net ${record.paymentTerms.netDays} days from the invoice date.`,
  )
  lines.push('')
  lines.push('This is additional to the agreed scope and does not replace it.')
  lines.push('')
  lines.push('Amounts are as agreed. VAT is not included or calculated here.')

  return lines.join('\n')
}
