import { parseThread } from '../src/lib/parseThread'
import { validateRecord } from '../src/lib/validateRecord'
import { HERO_THREAD } from '../src/fixtures/heroThread'
import { DEMO_EXTRACTION } from '../src/fixtures/demoExtraction'
import { formatEuros, centsFromEuros } from '../src/lib/money'
import { quoteTotals, addDays, quoteValidUntil, formatDate } from '../src/lib/quote'
import { redactMessages, restoreRecord, restoreText } from '../src/lib/redact'
import { blankRecord } from '../src/lib/blankRecord'
import { agreedSummary } from '../src/lib/summary'
import { parseFollowUp } from '../src/lib/followUp'
import { validateScopeFlags } from '../src/lib/validateScopeFlags'
import { changeOrderText } from '../src/lib/changeOrder'
import { nextInvoiceNumber, depositInvoice, balanceInvoice, changeOrderInvoice, invoiceTotal, isOverdue, daysOverdue } from '../src/lib/invoices'
import { quoteText, scopeSummaryText, agreedReplyText, invoiceText } from '../src/lib/outputs'
import { restoreFlags, redactRecord } from '../src/lib/redact'
import { DEMO_SCOPE_FLAGS } from '../src/fixtures/demoScopeFlags'
import { SCOPE_CREEP_MESSAGE } from '../src/fixtures/heroThread'
import type { ScopeFlag } from '../src/types'
import type { Message } from '../src/types'

let failed = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) failed++
}

/** Substring-matching a formatted euro figure is a trap: a two-thousand-euro
 *  total ends with the same characters as a zero one, and the separator is a
 *  non-breaking space. Check the line, not the document. */
const hasZeroPricedLine = (text: string) =>
  text.split(String.fromCharCode(10)).some((line) => line.trimEnd().endsWith('— ' + formatEuros(0)))

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


// -- The hand-built record (CLAUDE.md §6, Phase 1) --------------------------
const blank = blankRecord()
check('a blank record is marked manual', blank.origin === 'manual')
check('...has no thread behind it', blank.sourceThread.length === 0)
check('...starts with one empty line to type into', blank.deliverables.length === 1 && blank.deliverables[0].description === '')
check('...carries no provenance', !blank.fieldSources && !blank.deliverables[0].source)
check('...has an absorbed list ready', Array.isArray(blank.absorbedWork) && blank.absorbedWork.length === 0)
check('...defaults to net 14', blank.paymentTerms.netDays === 14)
check('...totals to nothing without crashing', quoteTotals(blank).total === 0)
check('an extracted record is marked extracted', result.ok && result.record.origin === 'extracted')


// -- The sendable artifact (CLAUDE.md §1) -----------------------------------
// Phase 1 may not end in a screen that only stores, so the summary is part of
// the phase, not a nicety.
const summary = result.ok ? agreedSummary(result.record) : ''
check('the summary names the project', summary.includes('What we agreed'))
check('...lists the scope', summary.includes('Scope') && summary.includes('reels'))
check('...states the total once', summary.includes('Total: ') && (summary.match(/Total: /g) ?? []).length === 1)
check('...says the usage rights are missing rather than omitting it', summary.includes('Usage rights: not agreed yet'))
check('...never prints a zero price for a line nobody set', !hasZeroPricedLine(summary) && summary.includes('price not set'))
check('...says VAT is not calculated', summary.includes('VAT is not included or calculated'))
check('...mentions no client name that was redacted away', !summary.includes('[Client]'))

const blankSummary = agreedSummary(blank)
check('an empty record still produces a summary', blankSummary.includes('What we agreed — the project'))
check('...with no deadline claimed', blankSummary.includes('Delivery: no date agreed yet'))

const depositSummary = agreedSummary({ ...blank, deliverables: [{ id: 'x', description: 'Film', quantity: 1, unitPrice: 100000 }], paymentTerms: { depositPercent: 40, netDays: 30 } })
check('a deposit is spelled out in euros', depositSummary.includes('40% deposit of') && depositSummary.includes('net 30 days'))


// -- Scope defense (CLAUDE.md §6, Phase 2) ----------------------------------
const base = result.ok ? result.record : blank
const incoming = parseFollowUp(SCOPE_CREEP_MESSAGE, base.sourceThread)

check('the follow-up is renumbered past the thread', incoming[0].id === 'msg_3', incoming.map((m) => m.id).join(','))
check('...and is attributed to the client', incoming.every((m) => m.from === 'client'))
check('...ids never collide with the record thread', incoming.every((m) => !base.sourceThread.some((e) => e.id === m.id)))

const scope = validateScopeFlags(DEMO_SCOPE_FLAGS, base.id, incoming)
check('the demo scope fixture validates', scope.ok, scope.ok ? '' : scope.errors.join(' '))
if (scope.ok) {
  check('...into three differences', scope.flags.length === 3, String(scope.flags.length))
  check('...with no warnings, so every quote is real', scope.warnings.length === 0, scope.warnings.join(' '))
  check(
    '...every quote verbatim in the message it cites',
    scope.flags.every((f) => incoming.find((m) => m.id === f.source!.messageId)!.body.includes(f.source!.quote)),
  )
  check('...every price left null rather than invented', scope.flags.every((f) => f.suggestedPrice === null && f.priceBasis === null))
  check('...all open to begin with', scope.flags.every((f) => f.status === 'open'))
  check('...none of them characterises the client', scope.flags.every((f) => !/scope creep|trying to|should|for free/i.test(f.differenceFromRecord)))
}

// Zero differences is a real answer, not a failure.
const none = validateScopeFlags('{"flags": []}', base.id, incoming)
check('no differences is a success, not an error', none.ok && none.flags.length === 0)

// A number with nothing behind it is the failure §8 exists to stop.
const unsourced = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'A 30s cutdown', differenceFromRecord: 'The record lists 15s reels.', source: { quote: 'a 30s cutdown for the youtube pre-roll', messageId: 'msg_3' }, suggestedPriceCents: 40000, priceBasis: null }] }), base.id, incoming)
check('a price with no basis is dropped', unsourced.ok && unsourced.flags[0].suggestedPrice === null)
check('...and the user is told why', unsourced.ok && unsourced.warnings.some((w) => w.includes('which line it came from')))

// No quote, no flag.
const unquoted = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'Something', differenceFromRecord: 'Not in the record.', source: { quote: 'words nobody wrote', messageId: 'msg_3' } }] }), base.id, incoming)
check('a flag we cannot quote is dropped entirely', unquoted.ok && unquoted.flags.length === 0)

// Neutrality is enforced, not merely requested.
const loaded = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'A 30s cutdown', differenceFromRecord: 'The client is trying to get a fourth video for free.', source: { quote: 'a 30s cutdown for the youtube pre-roll', messageId: 'msg_3' } }] }), base.id, incoming)
check('an editorialising note is rewritten, not shown', loaded.ok && loaded.flags[0].differenceFromRecord === 'The record does not cover this.')
check('...and the rewrite is disclosed', loaded.ok && loaded.warnings.some((w) => w.includes('rather than the difference')))

const loadedLine = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'Free work they are trying to sneak in', differenceFromRecord: 'Not in the record.', source: { quote: 'a 30s cutdown for the youtube pre-roll', messageId: 'msg_3' } }] }), base.id, incoming)
check('a characterisation never becomes an invoice line', loadedLine.ok && loadedLine.flags.length === 0)

// -- The change order (§8: restates the work, never the flag) ---------------
const billed: ScopeFlag[] = scope.ok
  ? [
      { ...scope.flags[0], status: 'billed', suggestedPrice: 40000 },
      { ...scope.flags[1], status: 'billed' },
      { ...scope.flags[2], status: 'dismissed' },
    ]
  : []
const order = changeOrderText(base, billed)
check('the change order lists the billed work', order.includes(billed[0].whatWasAsked))
check('...and not the dismissed work', !order.includes(billed[2].whatWasAsked))
check('...never restates why it was flagged', billed.every((f) => !order.includes(f.differenceFromRecord)))
check('...never prints a zero price', !hasZeroPricedLine(order) && order.includes('price to confirm'))
check('...totals only what is actually priced', order.includes('Additional so far: ' + formatEuros(40000)))
check('an empty change order is empty, not a header', changeOrderText(base, []) === '')

// -- Absorbing (§6, and the value stays private) ----------------------------
const absorbed = agreedSummary({ ...base, absorbedWork: [{ id: 'abs_1', recordId: base.id, description: 'Story frames from the feed stills', estimatedValue: 25000, absorbedAt: '2026-08-27', note: 'long-term client' }] })
check('absorbed work is listed in the summary', absorbed.includes('Also included, at no additional charge') && absorbed.includes('Story frames'))
check('...but never priced there', !absorbed.includes(formatEuros(25000)))
check('...and the private note never leaves', !absorbed.includes('long-term client'))

// -- Redaction through the scope path ---------------------------------------
const scopeRed = redactMessages([...base.sourceThread, ...incoming])
const sentIncoming = scopeRed.messages.slice(-incoming.length)
check('the follow-up is redacted too', sentIncoming.every((m) => !/nina/i.test(m.body)))
const sentRecord = redactRecord(base, scopeRed.map)
check('the record travelling with it is redacted', !/nina/i.test(sentRecord.clientName), sentRecord.clientName)
const redFlags = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'A 30s cutdown', differenceFromRecord: 'Not in the record.', source: { quote: sentIncoming[0].body.slice(0, 40), messageId: sentIncoming[0].id } }] }), base.id, sentIncoming)
check('a flag verifies against the redacted text that was sent', redFlags.ok && redFlags.flags.length === 1)
if (redFlags.ok) {
  const backFlag = restoreFlags(redFlags.flags, scopeRed.map)[0]
  check('...and its quote is verbatim in the original message', incoming.some((m) => m.body.includes(backFlag.source!.quote)), backFlag.source!.quote)
}


// -- Outputs (CLAUDE.md §6, Phase 3) ----------------------------------------
const withDep = { ...base, paymentTerms: { depositPercent: 40, netDays: 14 } }

check('the first number of the year is 001', nextInvoiceNumber([], 2026) === '2026-001')
const dep = depositInvoice(withDep, nextInvoiceNumber([], 2026), '2026-08-27')
check('a deposit invoice bills the deposit, not the total', invoiceTotal(dep) === 80000, formatEuros(invoiceTotal(dep)))
check('...is due net 14 from issue', dep.dueAt === '2026-09-10', dep.dueAt)
check('...starts as a draft', dep.status === 'draft' && dep.paidAt === null)

const bal = balanceInvoice(withDep, nextInvoiceNumber([dep], 2026), dep, '2026-08-27')
check('numbering runs on', bal.number === '2026-002', bal.number)
check('the balance shows the deposit as a deduction', bal.lineItems.some((l) => l.unitPrice === -80000))
check('...and totals to the remainder', invoiceTotal(bal) === 120000, formatEuros(invoiceTotal(bal)))
check('deposit + balance is the whole agreed total', invoiceTotal(dep) + invoiceTotal(bal) === quoteTotals(withDep).total)

check('a year rolls the sequence over', nextInvoiceNumber([dep, bal], 2027) === '2027-001')
check('a gap in numbering never reuses a number', nextInvoiceNumber([{ ...dep, number: '2026-009' }], 2026) === '2026-010')

// Line items are a snapshot: editing the record afterwards must not rewrite
// an invoice that has already gone out.
const edited = { ...withDep, deliverables: withDep.deliverables.map((d) => ({ ...d, unitPrice: 999999 })) }
check('an issued invoice ignores later edits to the record', invoiceTotal(balanceInvoice(withDep, '2026-003', null, '2026-08-27')) !== invoiceTotal(balanceInvoice(edited, '2026-004', null, '2026-08-27')))
check('...because its lines are copies, not references', bal.lineItems.every((l) => !withDep.deliverables.some((d) => d.id === l.id)))

// Overdue is the loud thing (§7), so it had better be right.
const sent = { ...bal, status: 'sent' as const }
check('a draft is never overdue, however old', !isOverdue({ ...bal, dueAt: '2020-01-01' }, '2026-08-27'))
check('a sent invoice past its due date is overdue', isOverdue(sent, '2026-09-11'))
check('...but not on the due date itself', !isOverdue(sent, '2026-09-10'))
check('...and days are counted from the due date', daysOverdue(sent, '2026-10-20') === 40, String(daysOverdue(sent, '2026-10-20')))
check('a paid invoice is never overdue', !isOverdue({ ...sent, status: 'paid' }, '2026-12-01'))

// A change order only bills what was billed, and only what has a price.
const coFlags: ScopeFlag[] = scope.ok
  ? [
      { ...scope.flags[0], status: 'billed', suggestedPrice: 45000 },
      { ...scope.flags[1], status: 'billed', suggestedPrice: null },
      { ...scope.flags[2], status: 'absorbed', estimatedValue: 15000 },
    ]
  : []
const co = changeOrderInvoice(base, coFlags, '2026-005', '2026-08-27')
check('a change-order invoice bills only the priced billed flags', co !== null && co.lineItems.length === 1 && invoiceTotal(co) === 45000)
check('...and absorbed work never reaches an invoice', co !== null && !co.lineItems.some((l) => l.description === coFlags[2].whatWasAsked))
check('no billable lines means no invoice at all', changeOrderInvoice(base, [], '2026-006') === null)

// -- The four documents -----------------------------------------------------
const sender = { yourName: 'Aaro', yourEmail: 'a@example.com', businessId: '1234567-8' }

const qText = quoteText(base, sender, '2026-08-27')
check('the quote text carries the sender', qText.includes('From: Aaro') && qText.includes('Business ID: 1234567-8'))
check('...and an expiry', qText.includes('Valid until: 26 September 2026'))
check('...and never prints a zero price', !hasZeroPricedLine(qText) && qText.includes('price not set'))

const scopeText = scopeSummaryText({ ...base, absorbedWork: [{ id: 'abs_1', recordId: base.id, description: 'Story frames', estimatedValue: 15000, absorbedAt: '2026-08-27', note: 'goodwill' }] }, coFlags)
check('the scope summary separates agreed from added', scopeText.includes('Agreed at the start') && scopeText.includes('Added since, and invoiced separately'))
check('...names absorbed work', scopeText.includes('at no additional charge') && scopeText.includes('Story frames'))
check('...but never prices it', !scopeText.includes(formatEuros(15000)))
check('...never leaks the private note', !scopeText.includes('goodwill'))
check('...and omits dismissed flags entirely', !scopeSummaryText(base, [{ ...coFlags[0], status: 'dismissed' }]).includes(coFlags[0].whatWasAsked))

const reply = agreedReplyText(base)
check('the reply is addressed to the client', reply.startsWith('Hi Nina,'))
check('...quotes the thread', reply.includes('from: "budget-ish 2k"'))
check('...invites a correction rather than closing the argument', reply.includes("tell me and I'll update it"))
check('...never accuses', !/as agreed|as you can see|to be clear|as discussed|per our/i.test(reply))
check('...names the usage-rights gap', reply.includes("we haven't set these yet"))

const invText = invoiceText(withDep, bal, sender)
check('the invoice text carries its number and dates', invText.includes('Invoice 2026-002') && invText.includes('Due: 10 September 2026'))
check('...shows the deduction as a negative, not as a gap', invText.includes('Less deposit invoiced (2026-001)') && invText.includes(formatEuros(-80000)))
check('...totals what is actually due', invText.includes('Total due: ' + formatEuros(120000)))
check('every document says VAT is not calculated', [qText, scopeText, invText].every((t) => t.includes('VAT is not included or calculated')))


// -- Dates -----------------------------------------------------------------
check('addDays crosses a month boundary', addDays('2026-08-27', 30) === '2026-09-26', addDays('2026-08-27', 30))
check('addDays crosses a year boundary', addDays('2026-12-20', 30) === '2027-01-19', addDays('2026-12-20', 30))
check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('quote is valid 30 days out', quoteValidUntil('2026-08-27') === '2026-09-26')
check('dates spell the month out', formatDate('2026-09-12') === '12 September 2026', formatDate('2026-09-12'))
check('null date renders a dash', formatDate(null) === '—')

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
