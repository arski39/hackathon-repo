import { DEFAULT_NET_DAYS } from '../config'
import { newId } from './id'
import type { ProjectRecord, RecordFieldKey, RecordFieldSources, Deliverable, Message, Provenance } from '../types'

export type ValidationResult =
  | { ok: true; record: ProjectRecord; warnings: string[] }
  | { ok: false; errors: string[] }

const FIELD_KEYS: RecordFieldKey[] = [
  'clientName',
  'projectName',
  'deadline',
  'usageRights',
  'revisionsIncluded',
  'depositPercent',
  'netDays',
]

/** Models like to wrap JSON in fences even when told not to. Strip them,
 *  then fall back to the outermost braces if there is stray prose. */
export function stripFences(raw: string): string {
  let text = raw.trim()
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  if (fenced) text = fenced[1].trim()
  if (!text.startsWith('{')) {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) text = text.slice(first, last + 1)
  }
  return text.trim()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Math.round(Number(v))
  }
  return null
}

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/** A quote only earns a provenance line if it really is in the thread.
 *  Rule 1 of the prompt is unenforceable without this check, and an
 *  unverifiable quote is exactly the thing the user is trusting us about. */
function checkProvenance(
  v: unknown,
  messages: Message[],
  label: string,
  warnings: string[],
): Provenance | undefined {
  if (!isRecord(v)) return undefined
  const quote = asText(v.quote)
  const messageId = asText(v.messageId)
  if (!quote || !messageId) return undefined

  const named = messages.find((m) => m.id === messageId)
  const inNamed = named?.body.includes(quote)
  if (inNamed) return { quote, messageId }

  // Right quote, wrong message id — recoverable, so repair it quietly.
  const elsewhere = messages.find((m) => m.body.includes(quote))
  if (elsewhere) return { quote, messageId: elsewhere.id }

  warnings.push(`Dropped the source for ${label}: "${quote}" is not in the thread.`)
  return undefined
}

/**
 * Turn raw model output into a record, or into a list of reasons it can't be one.
 * Errors are things we cannot proceed without; anything recoverable becomes a
 * warning and a sensible default, because a record the user can edit beats a
 * blank screen.
 */
export function validateRecord(raw: string, messages: Message[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch (e) {
    return {
      ok: false,
      errors: [`Response was not valid JSON: ${(e as Error).message}`],
    }
  }

  if (!isRecord(parsed)) {
    return { ok: false, errors: ['Expected a JSON object at the top level.'] }
  }

  if (!Array.isArray(parsed.deliverables)) {
    errors.push('"deliverables" is missing or is not an array.')
  } else if (parsed.deliverables.length === 0) {
    errors.push('"deliverables" is empty — at least one line item is required.')
  }

  if (errors.length > 0) return { ok: false, errors }

  const deliverables: Deliverable[] = (parsed.deliverables as unknown[]).flatMap(
    (item, index): Deliverable[] => {
      if (!isRecord(item)) {
        warnings.push(`Skipped deliverable ${index + 1}: not an object.`)
        return []
      }
      const description = asText(item.description)
      if (!description) {
        warnings.push(`Skipped deliverable ${index + 1}: no description.`)
        return []
      }
      const quantity = asInt(item.quantity)
      const price = asInt(item.unitPriceCents)
      if (price !== null && price < 0) {
        warnings.push(`Deliverable "${description}" had a negative price; set to 0.`)
      }
      return [
        {
          id: newId('dlv'),
          description,
          quantity: quantity !== null && quantity > 0 ? quantity : 1,
          unitPrice: price === null ? 0 : Math.max(0, price),
          source: checkProvenance(item.source, messages, `"${description}"`, warnings),
          priceSource: checkProvenance(
            item.priceSource,
            messages,
            `the price of "${description}"`,
            warnings,
          ),
        },
      ]
    },
  )

  if (deliverables.length === 0) {
    return {
      ok: false,
      errors: ['No usable deliverables: every line item was missing a description.'],
    }
  }

  const rawSources = isRecord(parsed.fieldSources) ? parsed.fieldSources : {}
  const fieldSources: RecordFieldSources = {}
  for (const key of FIELD_KEYS) {
    const found = checkProvenance(rawSources[key], messages, key, warnings)
    if (found) fieldSources[key] = found
  }

  const terms = isRecord(parsed.paymentTerms) ? parsed.paymentTerms : {}
  const depositPercent = asInt(terms.depositPercent)
  const netDays = asInt(terms.netDays)

  const deadline = asText(parsed.deadline)
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    warnings.push(`Deadline "${deadline}" is not an ISO date; left it for you to set.`)
  }

  const record: ProjectRecord = {
    id: newId('record'),
    origin: 'extracted',
    // Stays null until the user confirms which client this is; extraction can
    // read a name but has no way to know it's the same Nina as last time.
    clientId: null,
    clientName: asText(parsed.clientName) ?? '',
    projectName: asText(parsed.projectName) ?? '',
    status: 'draft',
    deliverables,
    revisionsIncluded: Math.max(0, asInt(parsed.revisionsIncluded) ?? 0),
    deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
    usageRights: asText(parsed.usageRights),
    paymentTerms: {
      depositPercent:
        depositPercent !== null ? Math.min(100, Math.max(0, depositPercent)) : 0,
      netDays: netDays !== null && netDays > 0 ? netDays : DEFAULT_NET_DAYS,
    },
    currency: 'EUR',
    notes: asText(parsed.notes) ?? '',
    sourceThread: messages,
    fieldSources,
    absorbedWork: [],
    createdAt: new Date().toISOString(),
  }

  return { ok: true, record, warnings }
}
