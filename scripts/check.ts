import { parseThread } from '../src/lib/parseThread'
import { validateRecord } from '../src/lib/validateRecord'
import { HERO_THREAD } from '../src/fixtures/heroThread'
import { DEMO_EXTRACTION } from '../src/fixtures/demoExtraction'
import { formatEuros, centsFromEuros } from '../src/lib/money'
import { quoteTotals, addDays, quoteValidUntil, formatDate } from '../src/lib/quote'
import { redactMessages, restoreRecord, restoreText } from '../src/lib/redact'
import { blankRecord } from '../src/lib/blankRecord'
import { logPrice, comparables } from '../src/lib/priceLog'
import { DEFAULT_CAPABILITIES, canPromote, promote, recordOutcome, EVIDENCE_FLOOR } from '../src/lib/capabilities'
import { agreedSummary } from '../src/lib/summary'
import { parseFollowUp } from '../src/lib/followUp'
import { validateScopeFlags } from '../src/lib/validateScopeFlags'
import { changeOrderText } from '../src/lib/changeOrder'
import { nextInvoiceNumber, depositInvoice, balanceInvoice, changeOrderInvoice, invoiceTotal, isOverdue, daysOverdue } from '../src/lib/invoices'
import { quoteText, scopeSummaryText, agreedReplyText, invoiceText } from '../src/lib/outputs'
import { restoreFlags, redactRecord } from '../src/lib/redact'
import { DEMO_SCOPE_FLAGS } from '../src/fixtures/demoScopeFlags'
import { SCOPE_CREEP_MESSAGE } from '../src/fixtures/heroThread'
import { chaseFacts, allowedNumbers, numbersIn, mailtoHref, days, CHASE_TONES } from '../src/lib/chase'
import { validateChase } from '../src/lib/validateChase'
import { demoChase } from '../src/fixtures/demoChase'
import type { PriceEntry, ProjectRecord, ScopeFlag } from '../src/types'
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
// Pricing is at OBSERVE (CLAUDE.md §5). The evidence comes back; the number
// does not, and it is blank rather than zero — those are different facts.
check('the reels price comes back BLANK, not zero', reels.unitPrice === null, String(reels.unitPrice))
check('reels are one bundled line, not 3 separate ones', reels.quantity === 1)
check('stills line has a source', !!stills.source)
check('the stills price is blank too, and unsourced', stills.unitPrice === null && !stills.priceSource)
check('no deliverable comes back with any price', result.record.deliverables.every((d) => d.unitPrice === null))

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
check('...and the user is told', invented.ok && invented.warnings.some((w) => w.includes('is not in the thread')))
// The model will volunteer a price sooner or later. It is refused here, not
// displayed with a caveat — a caveat still displays it.
check('a volunteered price is refused', invented.ok && invented.record.deliverables[0].unitPrice === null)
check('...and that is said out loud', invented.ok && invented.warnings.some((w) => w.includes("Backpay doesn't price your work")))

// -- Quote totals ----------------------------------------------------------
// The record as it is after the user has priced the first line and left the
// second blank — which is what a real half-finished record looks like.
const priced: ProjectRecord = result.ok
  ? {
      ...result.record,
      deliverables: result.record.deliverables.map((d, i) => ({
        ...d,
        unitPrice: i === 0 ? 200000 : null,
      })),
    }
  : blankRecord()

const q = quoteTotals(priced)
check('the total is what the user typed', q.total === 200000, formatEuros(q.total))
check('no VAT is added to the total', q.total === q.lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0))
check('an unpriced line is counted, not silently dropped', q.unpricedCount === 1, String(q.unpricedCount))
check('...and is not treated as zero', q.lines[1].lineTotal === null)
check('a fully unpriced record totals 0 with everything unpriced',
  quoteTotals(blankRecord()).unpricedCount === 1)
check('no deposit stated, so deposit is 0', q.depositAmount === 0)
check('balance is the whole total', q.balanceAmount === q.total)
check('every total is an integer number of cents',
  [q.total, q.depositAmount, q.balanceAmount].every(Number.isInteger))

const withDeposit = quoteTotals({ ...priced, paymentTerms: { depositPercent: 40, netDays: 14 } })
check('40% deposit of the total', withDeposit.depositAmount === 80000, formatEuros(withDeposit.depositAmount))
check('deposit + balance === total', withDeposit.depositAmount + withDeposit.balanceAmount === withDeposit.total)

// Rounding is where cents quietly go missing.
const thirdDown = quoteTotals({ ...priced, deliverables: [{ id: 'x', description: 'odd', quantity: 1, unitPrice: 33333 }], paymentTerms: { depositPercent: 33, netDays: 14 } })
check('deposit rounds to a whole cent', Number.isInteger(thirdDown.depositAmount) && thirdDown.depositAmount === 11000, String(thirdDown.depositAmount))
check('deposit + balance loses nothing', thirdDown.depositAmount + thirdDown.balanceAmount === thirdDown.total)
const odd = quoteTotals({ ...priced, deliverables: [{ id: 'x', description: 'odd', quantity: 7, unitPrice: 3333 }] })
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
const base = priced
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

// Scope-value estimation is at OBSERVE too (§5): any price is refused,
// basis or no basis, and the refusal is said out loud.
const unsourced = validateScopeFlags(JSON.stringify({ flags: [{ whatWasAsked: 'A 30s cutdown', differenceFromRecord: 'The record lists 15s reels.', source: { quote: 'a 30s cutdown for the youtube pre-roll', messageId: 'msg_3' }, suggestedPriceCents: 40000, priceBasis: 'priced from the reels line' }] }), base.id, incoming)
check('a volunteered scope price is refused even with a basis', unsourced.ok && unsourced.flags[0].suggestedPrice === null && unsourced.flags[0].priceBasis === null)
check('...and the user is told why', unsourced.ok && unsourced.warnings.some((w) => w.includes("Backpay doesn't price your work")))
check('...and the flag itself survives', unsourced.ok && unsourced.flags.length === 1)

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


// -- The capability ladder (CLAUDE.md §5) -----------------------------------
check('everything starts at OBSERVE', DEFAULT_CAPABILITIES.every((c) => c.stage === 'observe'))
check('...with no override history and no promotion date',
  DEFAULT_CAPABILITIES.every((c) => c.overrideHistory.length === 0 && c.promotedAt === null))

const pricingCap = DEFAULT_CAPABILITIES.find((c) => c.name === 'pricing')!
check('nothing is promotable below the evidence floor', !canPromote(pricingCap, EVIDENCE_FLOOR - 1))
check('pricing becomes promotable at the floor', canPromote(pricingCap, EVIDENCE_FLOOR))

const atRecall = promote(pricingCap)
check('promotion moves exactly one rung', atRecall.stage === 'recall')
check('...and stamps when', atRecall.promotedAt !== null)
check('PRICING CANNOT GO PAST RECALL, however much history there is',
  !canPromote(atRecall, 999))

const scopeCap = DEFAULT_CAPABILITIES.find((c) => c.name === 'scope-value')!
check('other capabilities may go further', canPromote(promote(scopeCap), 999))

// Demotion only fires where something is actually being proposed.
const proposing = { ...scopeCap, stage: 'propose' as const }
let walked = proposing
for (let i = 0; i < 5; i++) walked = recordOutcome(walked, true).capability
check('five overrides inside the window do not demote yet', walked.stage === 'propose')
const sixth = recordOutcome(walked, true)
check('the sixth does', sixth.capability.stage === 'recall')
check('...and says why in plain language',
  (sixth.demotedBecause ?? '').includes('so I') && (sixth.demotedBecause ?? '').includes('6'),
  sixth.demotedBecause ?? 'nothing said')
check('...and the new stage starts with a clean slate',
  sixth.capability.overrideHistory.length === 0)

let accepting = proposing
for (let i = 0; i < 8; i++) accepting = recordOutcome(accepting, false).capability
check('accepting proposals never demotes', accepting.stage === 'propose')

let atObserve = DEFAULT_CAPABILITIES[0]
for (let i = 0; i < 6; i++) atObserve = recordOutcome(atObserve, true).capability
check('OBSERVE cannot be demoted by overrides — nothing was proposed',
  atObserve.stage === 'observe' && atObserve.overrideHistory.length === 0)

// -- The learning corpus (§5, §6) -------------------------------------------
let log: PriceEntry[] = []
log = logPrice(log, priced, 'Vertical reel, 15s', 180000, 'user', '2026-03-01T10:00:00.000Z')
check('a price the user enters is logged', log.length === 1 && log[0].amount === 180000)
check('...as theirs, not as a proposal', log[0].enteredBy === 'user')

// Typing 1, 18, 180 fires three changes. Only the last is a decision.
log = logPrice(log, priced, 'Vertical reel, 15s', 190000, 'user', '2026-03-01T10:00:05.000Z')
check('keystrokes collapse into one decision', log.length === 1 && log[0].amount === 190000)

log = logPrice(log, priced, 'Vertical reel, 15s', 200000, 'user', '2026-03-01T11:00:00.000Z')
check('a later change is a separate decision', log.length === 2)

log = logPrice(log, priced, '   ', 500000, 'user', '2026-03-02T10:00:00.000Z')
check('a price on an unnamed line teaches nothing and is not logged', log.length === 2)

// Comparables: the rows themselves, never a summary.
const corpus: PriceEntry[] = [
  { recordId: 'r1', deliverableDescription: '3 vertical reels, 15s', amount: 180000, enteredBy: 'user', enteredAt: '2026-03-01T10:00:00.000Z' },
  { recordId: 'r2', deliverableDescription: '2 vertical reels, 20s', amount: 140000, enteredBy: 'user', enteredAt: '2026-01-04T10:00:00.000Z' },
  { recordId: 'r3', deliverableDescription: 'Photography day rate', amount: 90000, enteredBy: 'user', enteredAt: '2026-02-01T10:00:00.000Z' },
  { recordId: 'r4', deliverableDescription: '4 vertical reels, 15s', amount: 220000, enteredBy: 'user', enteredAt: '2026-04-01T10:00:00.000Z' },
]
const near = comparables(corpus, '3 vertical reels, 15s, for launch')
check('comparables find the user’s own reel projects', near.length === 3, String(near.length))
check('...and leave unrelated work out', !near.some((e) => e.deliverableDescription.includes('Photography')))
check('...best match first', near[0].deliverableDescription === '3 vertical reels, 15s')
check('...returning ROWS, never an average', near.every((e) => typeof e.recordId === 'string' && typeof e.enteredAt === 'string'))
check('the current record is excluded from its own comparables',
  comparables(corpus, 'vertical reels', 'r1').every((e) => e.recordId !== 'r1'))
check('nothing comparable means nothing shown, not a guess',
  comparables(corpus, 'Voiceover recording').length === 0)

// -- No output may compute an average (§5) ----------------------------------
const everyOutput = [
  agreedSummary(priced),
  quoteText(priced, sender, '2026-08-27'),
  scopeSummaryText(priced, []),
  agreedReplyText(priced),
]
check('no document says "average", "median", "typical" or "usually"',
  everyOutput.every((t) => !/\b(average|median|typical|usually|on average|per hour|hourly)\b/i.test(t)))

// -- A partly priced record is normal, not broken ---------------------------
const partial = agreedSummary(priced)
check('the summary says how many lines are still to price',
  partial.includes('1 line still to price'), partial.split(String.fromCharCode(10)).find((l) => l.includes('still to price')) ?? 'nothing said')
check('...and never prints a zero for the blank one', !hasZeroPricedLine(partial))
check('the quote text says it too', quoteText(priced, sender, '2026-08-27').includes('still to price'))
check('so does the reply', agreedReplyText(priced).includes('still to price'))



// -- Phase 4: the chase (CLAUDE.md §7, §9) ----------------------------------
const chased = { ...sent, number: '2026-002' }
const facts = chaseFacts(withDep, chased, 'Aaro', '2026-10-20')

check('the chase is handed the real amount', facts.amountCents === 120000 && facts.amountText === formatEuros(120000))
check('...how late it actually is', facts.daysOverdue === 40, String(facts.daysOverdue))
// A pasted thread carries no timestamps — there is nothing in plain pasted text
// for parseThread to read them from — so the chase never claims an agreement
// date today. That is the §1 rule applied to a date: no record to point at, so
// the field stays blank rather than borrowing createdAt, which means something
// else. It starts working the moment messages arrive dated (§7 Phase 6, §14.3).
check('a thread with no dates on it yields no agreement date', facts.agreedText === null)
check('...and neither does a record with no thread at all',
  chaseFacts(blankRecord(), chased, 'Aaro', '2026-10-20').agreedText === null)
const dated = {
  ...withDep,
  sourceThread: withDep.sourceThread.map((m, i) =>
    i === 0 ? { ...m, receivedAt: '2026-08-01T09:00:00.000Z' } : m,
  ),
}
check('...but a dated thread is used when there is one',
  chaseFacts(dated, chased, 'Aaro', '2026-10-20').agreedText === '1 August 2026',
  String(chaseFacts(dated, chased, 'Aaro', '2026-10-20').agreedText))
check('"1 day", not "1 days"', days(1) === '1 day' && days(40) === '40 days')

// The allowlist is what stands between the user and a confidently wrong figure
// in front of someone who owes them money.
const allowed = allowedNumbers(facts)
check('the amount is allowed however it is spelled',
  allowed.has('120000') && allowed.has('1200'), [...allowed].join(' '))
check('the invoice number is allowed whole and in parts',
  allowed.has('2026002') && allowed.has('2026') && allowed.has('002') && allowed.has('2'))
check('a number nobody mentioned is not allowed', !allowed.has('7'))

check('digit runs are read out of a formatted sentence',
  numbersIn('due 10 September 2026 for 1 200,00 €').join('|') === '10|2026|120000',
  numbersIn('due 10 September 2026 for 1 200,00 €').join('|'))
check('...and prose with no numbers yields none', numbersIn('no figures here at all').length === 0)

// Every canned draft, against the same validator the live path uses. This is
// the check that catches a fixture drifting away from the facts it renders.
for (const tone of CHASE_TONES) {
  const outcome = validateChase(demoChase(facts, tone), facts)
  check(`the ${tone} demo draft validates`, outcome.ok, outcome.ok ? '' : outcome.errors.join(' '))
}

const friendly = validateChase(demoChase(facts, 'friendly'), facts)
const firm = validateChase(demoChase(facts, 'firm'), facts)
const formal = validateChase(demoChase(facts, 'formal'), facts)
if (friendly.ok && firm.ok && formal.ok) {
  check('the three tones are three different emails',
    new Set([friendly.draft.body, firm.draft.body, formal.draft.body]).size === 3)
  check('friendly never says how late it is — only when it was due (§9)',
    !/overdue|past due|outstanding/i.test(friendly.draft.body) && friendly.draft.body.includes(facts.dueText))
  check('firm states the days overdue plainly', firm.draft.body.includes('40 days'))
  check('...and asks for a date it will be paid', /when|date it will be paid/i.test(firm.draft.body))
  check('formal notice says interest applies without naming a rate',
    formal.draft.body.includes('as per the agreed terms') && !formal.draft.body.includes('%'))
  check('every draft names the invoice and the amount',
    [friendly, firm, formal].every((r) => r.ok && r.draft.body.includes('2026-002') && r.draft.body.includes(facts.amountText)))
  check('no draft threatens anyone',
    [friendly, firm, formal].every((r) => r.ok && !/legal|court|lawyer|collect/i.test(r.draft.body)))
  check('the subject line names the invoice', [friendly, firm, formal].every((r) => r.ok && r.draft.subject.includes('2026-002')))
}

// Now the things a live model might actually do wrong.
const madeUpDeadline = JSON.stringify({ subject: 'Invoice 2026-002', body: 'Please pay within 7 days.' })
const inventedResult = validateChase(madeUpDeadline, facts)
check('a deadline nobody agreed is rejected as invented',
  !inventedResult.ok && inventedResult.errors.some((e) => e.includes('7')),
  inventedResult.ok ? 'accepted it' : inventedResult.errors.join(' '))

const wrongAmount = JSON.stringify({ subject: 'Invoice 2026-002', body: 'The 1 500,00 € is overdue.' })
check('a plausible but wrong amount is rejected', !validateChase(wrongAmount, facts).ok)

const threat = JSON.stringify({ subject: 'Invoice 2026-002', body: 'Pay or I will take legal action.' })
check('a threat of legal action is rejected', !validateChase(threat, facts).ok)

const rate = JSON.stringify({ subject: 'Invoice 2026-002', body: 'Interest accrues at 8 % per annum.' })
check('a stated interest rate is rejected (§9)', !validateChase(rate, facts).ok)

const lawful = JSON.stringify({ subject: 'Invoice 2026-002', body: 'You are legally obliged to pay this.' })
check('a claim about what the law requires is rejected', !validateChase(lawful, facts).ok)

check('prose instead of JSON is rejected, not guessed at', !validateChase('Sure! Here is your email:', facts).ok)
check('JSON with no body is rejected', !validateChase('{"subject":"Invoice 2026-002"}', facts).ok)

// The user's own words are theirs. A number inside the project name is not an
// invention just because it is a number.
const numbered = { ...facts, projectName: 'Launch 2026 campaign' }
check("a number in the user's own project name is allowed",
  validateChase(demoChase(numbered, 'friendly'), numbered).ok)

// mailto: opens a compose window. It does not send, and it does not guess who
// the client is (§7, §13).
const mail = mailtoHref('Invoice 2026-002', 'Hi Nina,\n\nPlease see attached.')
check('the mailto has no recipient', mail.startsWith('mailto:?'))
check('...and the body survives encoding', decodeURIComponent(mail.split('&body=')[1]).includes('Hi Nina,'))
check('...and carries the subject', mail.includes('subject=' + encodeURIComponent('Invoice 2026-002')))

// -- Dates -----------------------------------------------------------------
check('addDays crosses a month boundary', addDays('2026-08-27', 30) === '2026-09-26', addDays('2026-08-27', 30))
check('addDays crosses a year boundary', addDays('2026-12-20', 30) === '2027-01-19', addDays('2026-12-20', 30))
check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('quote is valid 30 days out', quoteValidUntil('2026-08-27') === '2026-09-26')
check('dates spell the month out', formatDate('2026-09-12') === '12 September 2026', formatDate('2026-09-12'))
check('null date renders a dash', formatDate(null) === '—')

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
