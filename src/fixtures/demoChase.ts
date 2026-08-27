import { days, type ChaseFacts, type ChaseTone } from '../lib/chase'

/**
 * The canned chase drafts — CLAUDE.md §12.
 *
 * Unlike the other fixtures this one is a function of the facts rather than a
 * frozen string, and it has to be: the invoice number, the amount and how late
 * it is are all computed at runtime from whatever the user actually did. A
 * hardcoded draft would either show figures that contradict the invoice on the
 * same screen, or fail `validateChase` for inventing every number in it.
 *
 * It is still canned in the sense that matters — no network, no key, no model,
 * the same text every time for a given invoice.
 */
export function demoChase(facts: ChaseFacts, tone: ChaseTone): string {
  const hi = facts.clientName ? `Hi ${facts.clientName},` : 'Hi,'
  const sign = facts.yourName ? `\n\n${facts.yourName}` : ''

  if (tone === 'friendly') {
    return JSON.stringify({
      subject: `Invoice ${facts.invoiceNumber} — ${facts.projectName}`,
      body:
        `${hi}\n\n` +
        `I think invoice ${facts.invoiceNumber} may have slipped through — it was ` +
        `due on ${facts.dueText}, for ${facts.amountText}.\n\n` +
        `If it's already in a payment run then ignore me and I'll leave it with ` +
        `you. If it went to the wrong inbox, say the word and I'll send it again.` +
        sign,
    })
  }

  if (tone === 'firm') {
    return JSON.stringify({
      subject: `Invoice ${facts.invoiceNumber} is overdue — ${facts.projectName}`,
      body:
        `${hi}\n\n` +
        `Invoice ${facts.invoiceNumber} for ${facts.amountText} is now ` +
        `${days(facts.daysOverdue)} past due. It was issued on ${facts.issuedText} ` +
        `and fell due on ${facts.dueText}, on the net ${facts.netDays} day terms ` +
        `we agreed.\n\n` +
        `Can you let me know the date it will be paid? If something is holding it ` +
        `up on your side, tell me what it is and I'll work around it.` +
        sign,
    })
  }

  return JSON.stringify({
    subject: `Formal notice — invoice ${facts.invoiceNumber}, ${facts.projectName}`,
    body:
      `${facts.clientName || 'To whom it may concern'},\n\n` +
      `This is a formal notice regarding invoice ${facts.invoiceNumber}, issued ` +
      `${facts.issuedText} for ${facts.amountText} in respect of ${facts.projectName}` +
      `${facts.agreedText ? `, agreed on ${facts.agreedText}` : ''}.\n\n` +
      `Payment fell due on ${facts.dueText}, under the agreed net ` +
      `${facts.netDays} day terms, and remains outstanding as of ` +
      `${facts.asOfText} — ${days(facts.daysOverdue)} later.\n\n` +
      `Please arrange payment of ${facts.amountText} in full. Late payment ` +
      `interest applies as per the agreed terms.` +
      sign,
  })
}
