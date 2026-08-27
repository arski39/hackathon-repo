import { days, TONE_LABEL, type ChaseFacts, type ChaseTone } from '../lib/chase'

export const CHASE_SCHEMA = `{
  "subject": string,
  "body": string
}`

/**
 * The three tones differ in strategy, not in adjectives (§9). Written out in
 * full because "be firmer" produces the same email with more exclamation
 * marks, and what actually changes between these is what the email is *for*.
 */
const STRATEGY: Record<ChaseTone, string> = {
  friendly: `FRIENDLY.
Assume the invoice slipped through — it usually did. Give them an easy out: it
went to the wrong inbox, it is sitting in a payment run, someone was away. Offer
to resend it. Do not mention consequences, do not mention how late it is beyond
naming the due date, and do not ask them to explain themselves.`,

  firm: `FIRM.
State how many days overdue it is, plainly and once. Restate the payment terms
that were agreed. Ask for a specific date it will be paid, and offer to work
with whatever is holding it up. No apology for asking, and no warning either.`,

  formal: `FORMAL NOTICE.
Reference the agreement, state the amount, state the date payment fell due and
how long it has been outstanding. Ask for payment in full. You may note that
late payment interest applies as per the agreed terms — those exact words, with
no rate and no figure. Neutral and unemotional throughout: no anger, no
disappointment, no warmth.`,
}

export function chasePrompt(facts: ChaseFacts, tone: ChaseTone): string {
  const known = [
    `Invoice number: ${facts.invoiceNumber}`,
    `Amount due: ${facts.amountText}`,
    `Issued: ${facts.issuedText}`,
    `Payment fell due: ${facts.dueText}`,
    `Overdue by: ${days(facts.daysOverdue)}`,
    `Agreed payment terms: net ${facts.netDays} days`,
    facts.agreedText ? `The project was agreed on: ${facts.agreedText}` : null,
    `Today: ${facts.asOfText}`,
    `Project: ${facts.projectName}`,
    facts.clientName ? `Client's name: ${facts.clientName}` : null,
    facts.yourName ? `Your name (sign off with it): ${facts.yourName}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `You are drafting a payment reminder for a freelancer to send to their client.
You are writing it for them to check and send themselves. It is not sent by you.

THE FACTS. These are the only numbers that exist:

${known}

THE TONE. Write at exactly this tone and no other:

${STRATEGY[tone]}

RULES.

1. NEVER INVENT A NUMBER. Every figure, date, quantity and duration in your
   reply must be one of the facts above, copied exactly as written there. If you
   want to write a number that is not in that list, write the sentence without a
   number instead. This includes deadlines ("within 7 days"), amounts, and
   anything measured in days or weeks.

2. Never threaten legal action, debt collection, a lawyer, or court. Never
   mention stopping work or withholding files.

3. Never state an interest rate, a percentage, or a penalty figure. ${TONE_LABEL.formal}
   may say "late payment interest applies as per the agreed terms" and nothing
   more specific than that.

4. Never claim what the law requires or what the client is legally obliged to
   do. You do not know which country's rules apply.

5. Do not accuse, and do not imply the client is avoiding payment. They are
   almost always just busy. The user has to work with this person again.

6. No "as agreed", "as you are aware", "as per my last email", "just circling
   back", "gentle reminder", "kindly". Write like a person who is owed money and
   is fine about it.

7. Plain text only. No markdown, no bullet characters, no headings. Line breaks
   are fine. Six sentences at most.

8. The subject line names the invoice and the project. It is not a plea.

Return ONE JSON object and nothing else. No prose, no code fences.

${CHASE_SCHEMA}`
}
