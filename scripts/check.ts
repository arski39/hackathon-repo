import { parseThread } from '../src/lib/parseThread'
import { validateRecord } from '../src/lib/validateRecord'
import { HERO_THREAD } from '../src/fixtures/heroThread'
import { DEMO_EXTRACTION } from '../src/fixtures/demoExtraction'
import { formatEuros, centsFromEuros } from '../src/lib/money'
import { quoteTotals, addDays, quoteValidUntil, formatDate } from '../src/lib/quote'
import { redactMessages, restoreRecord, restoreText } from '../src/lib/redact'
import type { Message } from '../src/types'

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

const result = validateRecord(DEMO_EXTRACTION, messages)
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

// -- Redaction (CLAUDE.md §3) ----------------------------------------------
// The order in §3 is load-bearing: the model only ever sees the redacted text,
// so quotes are verified against that, and the names go back afterwards. If the
// round trip is not exact, every provenance line silently dies with the toggle
// on and it looks like the model misbehaving.
const red = redactMessages(messages)
const sentBodies = red.messages.map((m) => m.body).join('\n')

check('the client name is gone from what gets sent', !/nina/i.test(sentBodies))
check('both spellings were caught', sentBodies.includes('[Client]') && sentBodies.includes('[client]'), 'Nina and nina')
check('the map has an entry per spelling', red.map.get('[Client]') === 'Nina' && red.map.get('[client]') === 'nina')
check('"you" was never treated as a name', !sentBodies.includes('[YOU]') && sentBodies.includes("you'd"))

check(
  'restoring is an exact round trip',
  red.messages.every((m, i) => restoreText(m.body, red.map) === messages[i].body),
)

// A quote taken from the redacted text must survive validation there, and come
// back a verbatim substring of the original.
const sentReply = red.messages[1]
const response = JSON.stringify({
  clientName: '[Client]',
  projectName: 'Launch',
  deliverables: [
    { description: '3 reels for [Client]', quantity: 1, unitPriceCents: 200000,
      source: { quote: sentReply.body, messageId: sentReply.id } },
  ],
  notes: '',
})
const v = validateRecord(response, red.messages)
check('a redacted quote verifies against the text that was sent', v.ok && !!v.record.deliverables[0].source)
if (v.ok) {
  const back = restoreRecord(v.record, red.map, messages)
  const q = back.deliverables[0].source!
  check('the restored quote is verbatim in the original thread',
    messages.find((m) => m.id === q.messageId)!.body.includes(q.quote))
  check('the client name came back', back.clientName === 'Nina', back.clientName)
  check('placeholders are gone from descriptions', back.deliverables[0].description === '3 reels for Nina')
  check('sourceThread is the untouched original', back.sourceThread[0].body === messages[0].body)
}

// A short name must not be redacted out of the middle of an ordinary word.
const ali: Message[] = [
  { id: 'msg_1', from: 'client', sender: 'Ali', body: 'the quality has to be high, ali', receivedAt: '' },
]
const aliRed = redactMessages(ali)
check('a short name leaves "quality" alone', aliRed.messages[0].body === 'the quality has to be high, [client]', aliRed.messages[0].body)
check('...and still round trips', restoreText(aliRed.messages[0].body, aliRed.map) === ali[0].body)

// Nothing to redact must not mean nothing works.
const anon: Message[] = [{ id: 'msg_1', from: 'client', sender: 'You', body: 'hei, 3 reels?', receivedAt: '' }]
const anonRed = redactMessages(anon)
check('a generic sender label is left alone', anonRed.map.size === 0 && anonRed.messages === anon)

const withEmail: Message[] = [
  { id: 'msg_1', from: 'client', sender: 'Nina', body: 'send it to nina@studio.fi thanks', receivedAt: '' },
]
const emailRed = redactMessages(withEmail)
check('an email address is replaced whole', emailRed.messages[0].body.includes('[EMAIL_1]') && !emailRed.messages[0].body.includes('studio.fi'), emailRed.messages[0].body)
check('...and round trips exactly', restoreText(emailRed.messages[0].body, emailRed.map) === withEmail[0].body)


// -- Dates -----------------------------------------------------------------
check('addDays crosses a month boundary', addDays('2026-08-27', 30) === '2026-09-26', addDays('2026-08-27', 30))
check('addDays crosses a year boundary', addDays('2026-12-20', 30) === '2027-01-19', addDays('2026-12-20', 30))
check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('quote is valid 30 days out', quoteValidUntil('2026-08-27') === '2026-09-26')
check('dates spell the month out', formatDate('2026-09-12') === '12 September 2026', formatDate('2026-09-12'))
check('null date renders a dash', formatDate(null) === '—')

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
