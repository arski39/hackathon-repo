import { parseThread } from '../src/lib/parseThread'
import { validateRecord } from '../src/lib/validateRecord'
import { HERO_THREAD } from '../src/fixtures/heroThread'
import { DEMO_EXTRACTION } from '../src/fixtures/demoExtraction'
import { formatEuros, centsFromEuros } from '../src/lib/money'
import { quoteTotals, addDays, quoteValidUntil, formatDate } from '../src/lib/quote'

let failed = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) failed++
}

const messages = parseThread(HERO_THREAD)
check('parses hero thread into 2 messages', messages.length === 2, `got ${messages.length}`)
check('first message is the client', messages[0].from === 'client' && messages[0].sender === 'Nina')
check('second message is the creator', messages[1].from === 'creator')
check('header line stripped from body', !messages[0].body.includes('From:'))

const result = validateRecord(DEMO_EXTRACTION, messages, 25.5)
if (!result.ok) {
  console.log('FAIL  demo extraction is valid —', result.errors.join('; '))
  process.exit(1)
}
check('demo extraction validates', true)
check('no provenance was dropped', result.warnings.length === 0, result.warnings.join(' | '))
check('two deliverables', result.record.deliverables.length === 2)

const [reels, stills] = result.record.deliverables
check('reels line has a source', !!reels.source)
check('reels PRICE has its own source', reels.priceSource?.quote === 'budget-ish 2k', reels.priceSource?.quote ?? 'none')
check('reels price is 2000 EUR in cents', reels.unitPrice === 200000, String(reels.unitPrice))
check('reels are one bundled line, not 3 x 2000', reels.quantity === 1)
check('stills line has a source', !!stills.source)
check('stills price left at 0, unsourced', stills.unitPrice === 0 && !stills.priceSource)

check('usageRights stayed null', result.record.usageRights === null)
check('deadline resolved to ISO', result.record.deadline === '2026-09-12')
check('deadline has a source', !!result.record.fieldSources?.deadline)
check('project has a source', !!result.record.fieldSources?.projectName)
check('clientName has NO source (came from the header)', !result.record.fieldSources?.clientName)
check('netDays defaulted to 14', result.record.paymentTerms.netDays === 14)

// Every surviving quote must really be in the thread it points at.
const all = [
  ...result.record.deliverables.flatMap((d) => [d.source, d.priceSource]),
  ...Object.values(result.record.fieldSources ?? {}),
].filter(Boolean)
check(
  `all ${all.length} quotes are verbatim substrings`,
  all.every((s) => messages.find((m) => m.id === s!.messageId)?.body.includes(s!.quote)),
)

check('formats euros fi-FI', formatEuros(200000).includes('2') && formatEuros(200000).includes('€'), formatEuros(200000))
check('parses "2 000,50"', centsFromEuros('2 000,50') === 200050, String(centsFromEuros('2 000,50')))
check('parses "2000.50"', centsFromEuros('2000.50') === 200050, String(centsFromEuros('2000.50')))
check('parses "€2000"', centsFromEuros('€2000') === 200000, String(centsFromEuros('€2000')))
check('rejects junk', centsFromEuros('abc') === null)

// Bad model output must degrade, never crash.
check('empty deliverables rejected', validateRecord('{"deliverables":[]}', messages).ok === false)
check('non-JSON rejected', validateRecord('sorry, here you go!', messages).ok === false)
check('fenced JSON accepted', validateRecord('```json\n' + DEMO_EXTRACTION + '\n```', messages).ok === true)
const invented = validateRecord(
  JSON.stringify({ deliverables: [{ description: 'X', quantity: 1, unitPriceCents: 500, source: { quote: 'I never said this', messageId: 'msg_1' } }] }),
  messages,
)
check('invented quote is dropped, not shown', invented.ok && !invented.record.deliverables[0].source)
check('...and the user is told', invented.ok && invented.warnings.length === 1, invented.ok ? invented.warnings.join('') : '')

// -- Quote totals ----------------------------------------------------------
const q = quoteTotals(result.record)
check('total matches the stated budget exactly', q.total === 200000, formatEuros(q.total))
check('no VAT is added to the total', q.total === q.lines.reduce((s, l) => s + l.lineTotal, 0))
check('no deposit stated, so deposit is 0', q.depositAmount === 0)
check('balance is the whole total', q.balanceAmount === q.total)
check('every total is an integer number of cents',
  [q.total, q.depositAmount, q.balanceAmount].every(Number.isInteger))

const withDeposit = quoteTotals({ ...result.record, paymentTerms: { depositPercent: 40, netDays: 14 } })
check('40% deposit of the total', withDeposit.depositAmount === 80000, formatEuros(withDeposit.depositAmount))
check('deposit + balance === total', withDeposit.depositAmount + withDeposit.balanceAmount === withDeposit.total)

// Rounding is where cents quietly go missing.
const thirdDown = quoteTotals({ ...result.record, deliverables: [{ id: 'x', description: 'odd', quantity: 1, unitPrice: 33333 }], paymentTerms: { depositPercent: 33, netDays: 14 } })
check('deposit rounds to a whole cent', Number.isInteger(thirdDown.depositAmount) && thirdDown.depositAmount === 11000, String(thirdDown.depositAmount))
check('deposit + balance loses nothing', thirdDown.depositAmount + thirdDown.balanceAmount === thirdDown.total)
const odd = quoteTotals({ ...result.record, deliverables: [{ id: 'x', description: 'odd', quantity: 7, unitPrice: 3333 }] })
check('odd line still totals exactly', odd.total === 23331, String(odd.total))

// -- Dates -----------------------------------------------------------------
check('addDays crosses a month boundary', addDays('2026-08-27', 30) === '2026-09-26', addDays('2026-08-27', 30))
check('addDays crosses a year boundary', addDays('2026-12-20', 30) === '2027-01-19', addDays('2026-12-20', 30))
check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('quote is valid 30 days out', quoteValidUntil('2026-08-27') === '2026-09-26')
check('dates spell the month out', formatDate('2026-09-12') === '12 September 2026', formatDate('2026-09-12'))
check('null date renders a dash', formatDate(null) === '—')

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
