import { formatEuros } from '../lib/money'
import { formatDate } from '../lib/quote'
import type { Message, ProjectRecord } from '../types'

/** What we ask for. `whatWasAsked` is the work, phrased for an invoice line;
 *  `differenceFromRecord` is the private note to the user. They are separate
 *  because §8 forbids a change order from restating the flag. */
export const SCOPE_SCHEMA = `{
  "flags": [
    {
      "whatWasAsked": string,
      "differenceFromRecord": string,
      "source": { "quote": string, "messageId": string },
      "suggestedPriceCents": integer | null,
      "priceBasis": string | null
    }
  ]
}`

function renderRecord(record: ProjectRecord): string {
  const lines = record.deliverables.map((d) => {
    const price =
      d.unitPrice > 0 ? formatEuros(d.unitPrice) + ' each' : 'no price set'
    return `- ${d.description || 'untitled line'} (quantity ${d.quantity}) — ${price}`
  })
  return [
    `Client: ${record.clientName || 'unnamed'}`,
    `Project: ${record.projectName || 'unnamed'}`,
    'Agreed deliverables:',
    ...(lines.length > 0 ? lines : ['- none recorded']),
    `Revisions included: ${record.revisionsIncluded}`,
    `Deadline: ${record.deadline ? formatDate(record.deadline) : 'none agreed'}`,
    `Usage rights: ${record.usageRights ?? 'none granted'}`,
    record.notes ? `Notes: ${record.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function renderMessages(messages: Message[]): string {
  return messages
    .map((m) => `<message id="${m.id}" from="${m.sender}">\n${m.body}\n</message>`)
    .join('\n\n')
}

export function findScopeFlagsPrompt(
  record: ProjectRecord,
  incoming: Message[],
): string {
  return `You are comparing a new message from a client against a record of what was already agreed on a freelance project.

Your job is to state differences factually, for the freelancer's own eyes. It is not to judge anyone or to advise anyone.

<record>
${renderRecord(record)}
</record>

<new-message>
${renderMessages(incoming)}
</new-message>

Return ONLY a JSON object matching this schema. No prose, no explanation, no markdown code fences:

${SCOPE_SCHEMA}

Rules:

1. Raise a flag for work the new message asks for that the record does not already cover, or covers differently — a different quantity, a different deadline, a use the record does not grant.
2. If the new message asks for nothing beyond the record, return {"flags": []}. An empty list is a correct and common answer. Do not manufacture a flag to look useful.
3. "whatWasAsked" is a short, neutral description of the work itself, written the way it would appear on an invoice line: "30s cutdown for YouTube pre-roll". Not a characterisation, not a complaint.
4. "differenceFromRecord" states the difference and then stops. "The record lists 3 reels. This message asks for 5." Never describe what the client intended, wanted, assumed, expected or was trying to do — you do not know, and neither do we. Never suggest what the freelancer should do about it. They will decide, and billing is not the only right answer.
5. "source" is a VERBATIM substring of the new message body, copied character for character, not paraphrased or re-punctuated, plus its messageId. If you cannot quote it, do not raise the flag at all.
6. "suggestedPriceCents" must come from a rate that is ALREADY in the record above. If the record prices a 15s reel, a further 15s reel is that price. Name the line you used in "priceBasis", e.g. "priced from the 3 vertical reels line".
7. If nothing in the record supports a price, return null for BOTH "suggestedPriceCents" and "priceBasis". Do not estimate, do not use a market rate, do not guess from the size of the job. An empty box the freelancer fills in is correct; an invented number is not.
8. A use the record does not grant — a new territory, a paid ad, a longer term — is a flag like any other. Price it null unless the record actually prices usage.
9. Do not use the phrases "scope creep", "trying to", "should", "push back", "getting away with", or "for free" anywhere in your output. Describe the difference, not the person.`
}

/** Appended verbatim to a retry after the first response failed validation. */
export function scopeRetrySuffix(errors: string[], previous: string): string {
  return `

Your previous response was rejected. Here it is:

${previous}

It failed validation for these reasons:
${errors.map((e) => `- ${e}`).join('\n')}

Return the corrected JSON object only. No prose, no code fences.`
}
