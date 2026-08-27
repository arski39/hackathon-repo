import type { Message, ProjectRecord, Provenance } from '../types'

/**
 * Best-effort redaction — CLAUDE.md §3.
 *
 * Replaces email addresses and client names we already know about with
 * placeholders before the thread is sent, and puts them back locally
 * afterwards. It is pattern matching, not anonymisation: a client mentioned
 * only by a nickname, or by a name the parser never saw in a header, goes
 * through untouched. The UI has to say so.
 */
export type Redaction = {
  /** The messages to actually send. The same objects when nothing matched. */
  messages: Message[]
  /** placeholder -> original. Memory only — never written to localStorage. */
  map: Map<string, string>
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g

/** Labels parseThread invents when a message has no real name on it. They are
 *  ordinary words in the body too, so replacing them would shred the thread
 *  and take every quote down with it. */
const GENERIC_SENDERS = new Set(['you', 'me', 'client', 'creator', 'them', 'us'])

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A name only counts where it stands on its own. Without the guards,
 *  redacting a client called "Ali" turns "quality" into "qu[Client]ty" and
 *  every quote in the response comes back unverifiable. */
function wordPattern(needle: string, flags: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`,
    `${flags}u`,
  )
}

/**
 * Every distinct *spelling* of a name gets its own placeholder.
 *
 * The hero thread says "From: Nina" and signs off "nina". Matching those
 * case-insensitively but restoring both to "Nina" would rewrite the user's own
 * words, and the restored quote would no longer be a verbatim substring of the
 * message it cites — which is precisely the check §8 relies on. So the match is
 * case-insensitive and the mapping is exact, one entry per spelling.
 */
function surfaceForms(messages: Message[], needle: string): string[] {
  const pattern = wordPattern(needle, 'gi')
  const forms = new Set<string>()
  for (const message of messages) {
    for (const found of message.body.matchAll(pattern)) forms.add(found[0])
    for (const found of message.sender.matchAll(pattern)) forms.add(found[0])
  }
  return [...forms]
}

/** Match the placeholder's casing to the spelling it stands in for, so the
 *  thread still reads like a thread to the model: "[Client]" mid-sentence,
 *  "[client]" where they signed off in lowercase. */
function styled(label: string, form: string): string {
  if (form === form.toLowerCase()) return `[${label.toLowerCase()}]`
  if (form === form.toUpperCase() && form !== form.toLowerCase()) {
    return `[${label.toUpperCase()}]`
  }
  return `[${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}]`
}

export function redactMessages(messages: Message[]): Redaction {
  const map = new Map<string, string>()
  const claimed = new Set<string>()

  /** Placeholders must be unique, or restoring is a guess. */
  const claim = (original: string, preferred: string) => {
    if (map.has(preferred) && map.get(preferred) === original) return
    let placeholder = preferred
    let n = 1
    while (claimed.has(placeholder)) {
      n += 1
      placeholder = `${preferred.slice(0, -1)}_${n}]`
    }
    claimed.add(placeholder)
    map.set(placeholder, original)
  }

  // Emails first. They are the only detection here that is actually reliable,
  // and a name inside an address would otherwise be replaced twice.
  const emails = new Set<string>()
  for (const message of messages) {
    for (const found of message.body.matchAll(EMAIL)) emails.add(found[0])
    for (const found of message.sender.matchAll(EMAIL)) emails.add(found[0])
  }
  let emailIndex = 0
  for (const email of emails) {
    emailIndex += 1
    claim(email, `[EMAIL_${emailIndex}]`)
  }

  // Names we actually know: whoever the parser found in a client header. We do
  // not guess at capitalised words — guessing would redact "Instagram" and
  // "Monday" and wreck every quote in the response.
  //
  // Client side only, per §3. The user's own name is their own, and the parser
  // labels an unnamed creator "You": redacting that would turn every "you" and
  // "you'd" in the thread into a placeholder.
  const clientNames = new Set<string>()
  for (const message of messages) {
    if (message.from !== 'client') continue
    const sender = message.sender.replace(EMAIL, '').replace(/[<>(),"]/g, '').trim()
    if (sender.length < 3 || GENERIC_SENDERS.has(sender.toLowerCase())) continue
    clientNames.add(sender)
  }

  const names = [...clientNames].sort((a, b) => b.length - a.length)
  names.forEach((name, index) => {
    const label = names.length === 1 ? 'CLIENT' : `CLIENT_${index + 1}`
    for (const form of surfaceForms(messages, name)) {
      claim(form, styled(label, form))
    }
  })

  if (map.size === 0) return { messages, map }

  // Longest original first, so "Nina Korhonen" goes before the "Nina" in it.
  const pairs = [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  const apply = (text: string) => {
    let out = text
    for (const [placeholder, original] of pairs) {
      out = original.includes('@')
        ? out.split(original).join(placeholder)
        : out.replace(wordPattern(original, 'g'), placeholder)
    }
    return out
  }

  return {
    messages: messages.map((m) => ({ ...m, sender: apply(m.sender), body: apply(m.body) })),
    map,
  }
}

/** Reverse of `apply`. Exact substitution both ways, so a restored quote is
 *  again a verbatim substring of the original message body — which is what
 *  keeps provenance working with redaction on. */
export function restoreText(text: string, map: Map<string, string>): string {
  let out = text
  for (const [placeholder, original] of map) {
    out = out.split(placeholder).join(original)
  }
  return out
}

function restoreProvenance(
  source: Provenance | undefined,
  map: Map<string, string>,
): Provenance | undefined {
  return source ? { ...source, quote: restoreText(source.quote, map) } : undefined
}

/**
 * Put the real names back, including inside every quote.
 *
 * `sourceThread` becomes the untouched originals: the thread column shows the
 * user their own conversation, not a placeholder version of it.
 */
export function restoreRecord(
  record: ProjectRecord,
  map: Map<string, string>,
  originalThread: Message[],
): ProjectRecord {
  if (map.size === 0) return { ...record, sourceThread: originalThread }
  const text = (value: string) => restoreText(value, map)

  const fieldSources = record.fieldSources ?? {}
  const restoredFields: typeof fieldSources = {}
  for (const [key, source] of Object.entries(fieldSources)) {
    const restored = restoreProvenance(source, map)
    if (restored) restoredFields[key as keyof typeof fieldSources] = restored
  }

  return {
    ...record,
    clientName: text(record.clientName),
    projectName: text(record.projectName),
    usageRights: record.usageRights === null ? null : text(record.usageRights),
    notes: text(record.notes),
    deliverables: record.deliverables.map((d) => ({
      ...d,
      description: text(d.description),
      source: restoreProvenance(d.source, map),
      priceSource: restoreProvenance(d.priceSource, map),
    })),
    fieldSources: restoredFields,
    sourceThread: originalThread,
  }
}
