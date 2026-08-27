import type { Message } from '../types'

/** The shape we ask the model for. Deliberately not the Deal type: ids,
 *  status, currency, VAT and the thread itself are ours to fill in, and
 *  money is named `unitPriceCents` so there is no chance of a euros/cents
 *  mix-up in the model's head. */
export const EXTRACTION_SCHEMA = `{
  "clientName": string | null,
  "projectName": string | null,
  "deliverables": [
    {
      "description": string,
      "quantity": integer,
      "unitPriceCents": integer | null,
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

export function extractDealPrompt(messages: Message[], today: string): string {
  return `You are reading a real client conversation for a freelance creative and pulling out the commercial terms, so they can send a quote.

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
5. Money: "unitPriceCents" is an INTEGER NUMBER OF CENTS. 2000 euros is 200000. A budget of "2k" is 200000. If the thread gives one lump budget for several deliverables, put the whole amount on the deliverable it most clearly refers to and leave the others null rather than dividing it yourself — splitting a budget is the user's decision, not yours.
6. "source" is the sentence the line item itself came from; "priceSource" is the sentence the money came from. They are usually different sentences and often in different paragraphs — that is expected, quote each separately. "priceSource" is null when the price is null.
7. "quantity" defaults to 1. If the thread says "3 reels", that is one deliverable with quantity 3, not three deliverables — BUT only when you have a genuine per-unit price. When a lump budget covers the whole bundle, set "quantity" to 1 and put the count in the description instead ("3 vertical reels, 15s, for launch"), so that quantity x unitPriceCents equals the stated budget exactly. Never divide a lump sum by the count to invent a per-unit price: it implies a precision the client never gave, and it rounds badly.
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
