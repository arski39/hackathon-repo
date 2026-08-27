import type { Message } from '../types'

/**
 * The shape we ask the model for. Deliberately not the ProjectRecord type: ids,
 * status, currency and the thread itself are ours to fill in.
 *
 * Note what is absent: there is **no price field at all**. Pricing sits at
 * OBSERVE (CLAUDE.md §5), and a field that exists is a field that gets filled —
 * "return null if unsure" is not the same instruction and does not hold. The
 * model reads the thread and quotes the sentence money was mentioned in; the
 * user types the number.
 */
export const EXTRACTION_SCHEMA = `{
  "clientName": string | null,
  "projectName": string | null,
  "deliverables": [
    {
      "description": string,
      "quantity": integer,
      "source": { "quote": string, "messageId": string } | null,
      "priceSource": { "quote": string, "messageId": string } | null
    }
  ],
  "revisionsIncluded": integer | null,
  "deadline": string | null,
  "usageRights": string | null,
  "paymentTerms": {
    "depositPercent": integer | null,
    "netDays": integer | null
  },
  "notes": string,
  "fieldSources": {
    "clientName":        { "quote": string, "messageId": string } | null,
    "projectName":       { "quote": string, "messageId": string } | null,
    "deadline":          { "quote": string, "messageId": string } | null,
    "usageRights":       { "quote": string, "messageId": string } | null,
    "revisionsIncluded": { "quote": string, "messageId": string } | null,
    "depositPercent":    { "quote": string, "messageId": string } | null,
    "netDays":           { "quote": string, "messageId": string } | null
  }
}`

function renderThread(messages: Message[]): string {
  return messages
    .map(
      (m) =>
        `<message id="${m.id}" from="${m.from}" sender="${m.sender}">\n${m.body}\n</message>`,
    )
    .join('\n\n')
}

export function extractRecordPrompt(messages: Message[], today: string): string {
  return `You are reading a real client conversation for a freelance creative and pulling out the commercial terms, so they can decide what to charge for it.

Today's date is ${today}.

<thread>
${renderThread(messages)}
</thread>

Return ONLY a JSON object matching this schema. No prose, no explanation, no markdown code fences:

${EXTRACTION_SCHEMA}

Rules:

1. Every value you extract must be supported by words actually in the thread. For each one, give a "quote" that is a VERBATIM substring of a message body — copied character for character, not paraphrased, not re-punctuated, not capitalised differently — plus the "messageId" of the message you took it from.
2. If you cannot find a supporting substring for a field, return null for that field. Do NOT invent a value and do NOT invent a quote. A null is a useful answer; a fabricated one destroys the point of this tool.
3. Leave "deadline" and "usageRights" as null when the thread does not state them. Unstated usage rights are normal and we want to show the gap to the user, not paper over it. Do not guess "social media" just because the work is video.
4. "deadline" must be an ISO date (YYYY-MM-DD) when you can resolve one confidently from the thread and today's date. If the thread says something vague like "sometime in spring", return null.
5. NEVER STATE A PRICE. You are not being asked what anything costs, and there is no field to put it in. Do not put an amount in "description". Do not mention what work like this usually costs, what it is worth, or what a fair rate would be. The freelancer decides that, and this tool exists precisely so nothing decides it for them.
6. "source" is the sentence the line item itself came from. "priceSource" is the sentence where MONEY was mentioned in connection with it — "budget-ish 2k", "we've got about three grand for this". Quoting what the client said about money is reading, and it is the most useful thing you can do here: that quote is shown to the freelancer beside an empty box while they decide. They are usually different sentences, often paragraphs apart, so quote each separately. "priceSource" is null if nobody mentioned money for that line.
7. "quantity" defaults to 1. If the thread says "3 reels", prefer ONE deliverable with quantity 1 and the count in the description ("3 vertical reels, 15s, for launch"). Only use a quantity above 1 when the thread itself treats the items as separately countable and separately priceable. Splitting a bundle into per-unit lines implies a per-unit price, and implying a price is still pricing.
8. "depositPercent" is 0 only if the thread explicitly says no deposit; otherwise null when unstated. "netDays" is null when unstated.
9. Put anything commercially relevant that does not fit a field — a hinted revision limit, a mention of exclusivity, a conflicting date — into "notes" as a short plain sentence. Leave it as an empty string if there is nothing.
10. Write "description" the way the creative would put it on an invoice line: concrete and countable, e.g. "Vertical reel, 15s, for launch". Do not pad it.`
}

/** Appended verbatim to a retry after the first response failed validation. */
export function retrySuffix(errors: string[], previous: string): string {
  return `

Your previous response was rejected. Here it is:

${previous}

It failed validation for these reasons:
${errors.map((e) => `- ${e}`).join('\n')}

Return the corrected JSON object only. No prose, no code fences.`
}
