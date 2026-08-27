import { parseThread } from '../src/lib/parseThread'
import { validateDeal } from '../src/lib/validateDeal'
import { HERO_THREAD } from '../src/fixtures/heroThread'
import { DEMO_EXTRACTION } from '../src/fixtures/demoExtraction'
import { formatEuros, centsFromEuros, vatOf } from '../src/lib/money'
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

const result = validateDeal(DEMO_EXTRACTION, messages, 25.5)
if (!result.ok) {
  console.log('FAIL  demo extraction is valid —', result.errors.join('; '))
  process.exit(1)
}
check('demo extraction validates', true)
check('no provenance was dropped', result.warnings.length === 0, result.warnings.join(' | '))
check('two deliverables', result.deal.deliverables.length === 2)

const [reels, stills] = result.deal.deliverables
check('reels line has a source', !!reels.source)
check('reels PRICE has its own source', reels.priceSource?.quote === 'budget-ish 2k', reels.priceSource?.quote ?? 'none')
check('reels price is 2000 EUR in cents', reels.unitPrice === 200000, String(reels.unitPrice))
check('reels are one bundled line, not 3 x 2000', reels.quantity === 1)
check('stills line has a source', !!stills.source)
check('stills price left at 0, unsourced', stills.unitPrice === 0 && !stills.priceSource)

check('usageRights stayed null', result.deal.usageRights === null)
check('deadline resolved to ISO', result.deal.deadline === '2026-09-12')
check('deadline has a source', !!result.deal.fieldSources?.deadline)
check('project has a source', !!result.deal.fieldSources?.projectName)
check('clientName has NO source (came from the header)', !result.deal.fieldSources?.clientName)
check('netDays defaulted to 14', result.deal.paymentTerms.netDays === 14)
check('vat rate carried through', result.deal.vatRatePercent === 25.5)

// Every surviving quote must really be in the thread it points at.
const all = [
  ...result.deal.deliverables.flatMap((d) => [d.source, d.priceSource]),
  ...Object.values(result.deal.fieldSources ?? {}),
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
check('empty deliverables rejected', validateDeal('{"deliverables":[]}', messages).ok === false)
check('non-JSON rejected', validateDeal('sorry, here you go!', messages).ok === false)
check('fenced JSON accepted', validateDeal('```json\n' + DEMO_EXTRACTION + '\n```', messages).ok === true)
const invented = validateDeal(
  JSON.stringify({ deliverables: [{ description: 'X', quantity: 1, unitPriceCents: 500, source: { quote: 'I never said this', messageId: 'msg_1' } }] }),
  messages,
)
check('invented quote is dropped, not shown', invented.ok && !invented.deal.deliverables[0].source)
check('...and the user is told', invented.ok && invented.warnings.length === 1, invented.ok ? invented.warnings.join('') : '')

// -- Quote totals ----------------------------------------------------------
const q = quoteTotals(result.deal)
check('subtotal matches the stated budget', q.subtotal === 200000, formatEuros(q.subtotal))
check('VAT at 25,5% of 2000', q.vat === 51000, formatEuros(q.vat))
check('total is subtotal + VAT', q.total === q.subtotal + q.vat && q.total === 251000, formatEuros(q.total))
check('no deposit stated, so deposit is 0', q.depositAmount === 0)
check('balance is the whole total', q.balanceAmount === q.total)
check('every total is an integer number of cents',
  [q.subtotal, q.vat, q.total, q.depositAmount, q.balanceAmount].every(Number.isInteger))

const withDeposit = quoteTotals({ ...result.deal, paymentTerms: { depositPercent: 40, netDays: 14 } })
check('40% deposit of the gross total', withDeposit.depositAmount === 100400, formatEuros(withDeposit.depositAmount))
check('deposit + balance === total', withDeposit.depositAmount + withDeposit.balanceAmount === withDeposit.total)

// Rounding is where cents quietly go missing.
check('VAT rounds, never truncates', vatOf(333, 25.5) === 85, String(vatOf(333, 25.5)))
check('VAT of 1 cent', vatOf(1, 25.5) === 0, String(vatOf(1, 25.5)))
const odd = quoteTotals({ ...result.deal, deliverables: [{ id: 'x', description: 'odd', quantity: 7, unitPrice: 3333 }] })
check('odd line still totals exactly', odd.subtotal === 23331 && Number.isInteger(odd.vat), String(odd.subtotal))

// -- Dates -----------------------------------------------------------------
check('addDays crosses a month boundary', addDays('2026-08-27', 30) === '2026-09-26', addDays('2026-08-27', 30))
check('addDays crosses a year boundary', addDays('2026-12-20', 30) === '2027-01-19', addDays('2026-12-20', 30))
check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('quote is valid 30 days out', quoteValidUntil('2026-08-27') === '2026-09-26')
check('dates spell the month out', formatDate('2026-09-12') === '12 September 2026', formatDate('2026-09-12'))
check('null date renders a dash', formatDate(null) === '—')

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
