// The data model — CLAUDE.md §6. Everything else derives from this file.

export type Provenance = {
  quote: string        // exact substring from the source thread
  messageId: string    // which message it came from
}

export type Deliverable = {
  id: string
  description: string  // "3 vertical reels, 15s each"
  quantity: number
  /** Cents. null means nobody has decided yet; 0 means the work is genuinely
   *  free. They are different facts and must never share a value (section 6). */
  unitPrice: number | null
  source?: Provenance
  /** The sentence where money was mentioned. Under the capability ladder this
   *  is the whole point of the price row: the field is blank and this quote
   *  sits beside it as evidence. Reading what the client said is not pricing. */
  priceSource?: Provenance
}

/** Section 8 requires provenance on *every* extracted field, but the section 5
 *  model only carries `source` on Deliverable. This is the additive companion:
 *  a quote for each scalar field the model filled in. Optional, so a record built
 *  by hand is still a valid record. */
export type RecordFieldKey =
  | 'clientName'
  | 'projectName'
  | 'deadline'
  | 'usageRights'
  | 'revisionsIncluded'
  | 'depositPercent'
  | 'netDays'

export type RecordFieldSources = Partial<Record<RecordFieldKey, Provenance>>

export type ProjectRecord = {
  id: string
  /** An extracted record is a draft to be checked; a hand-typed one is the
   *  user's own words. The review screen says something different for each.
   *  Deriving this from sourceThread.length breaks the moment someone pastes
   *  a thread into a record they started blank. */
  origin: 'extracted' | 'manual'
  /** Resolved once the user confirms which client this is. Null until then —
   *  extraction produces a name long before it can know it's the same Nina as
   *  last time. See section 13. */
  clientId: string | null
  clientName: string
  projectName: string
  status: 'draft' | 'quoted' | 'agreed' | 'delivered' | 'closed'
  deliverables: Deliverable[]
  revisionsIncluded: number
  deadline: string | null      // ISO date
  usageRights: string | null   // "social only, 6 months, FI" — often unstated; flag when missing
  paymentTerms: {
    depositPercent: number     // 0 if none
    netDays: number            // 14 is the Finnish default
  }
  currency: 'EUR'
  notes: string
  sourceThread: Message[]
  fieldSources?: RecordFieldSources
  /** Work delivered and never billed. Stored, not merely counted — section 6
   *  phase 5 has nothing behind its absorbed total otherwise. */
  absorbedWork: AbsorbedItem[]
  createdAt: string
}

export type Message = {
  id: string
  from: 'client' | 'creator'
  sender: string
  body: string
  receivedAt: string
  /** Set when the message was imported rather than pasted, so it can be shown
   *  as imported and never double-imported. Section 13.3. */
  external?: ExternalRef
}

export type ExternalRef = {
  provider: 'gmail'
  messageId: string
  threadId: string
}

export type Invoice = {
  id: string
  recordId: string
  number: string               // "2026-001"
  kind: 'deposit' | 'balance' | 'change-order'
  lineItems: Deliverable[]
  issuedAt: string
  dueAt: string
  status: 'draft' | 'sent' | 'paid'
  paidAt: string | null
}

export type ScopeFlag = {
  id: string
  recordId: string
  messageId: string
  /** The work itself, written the way it would go on an invoice line. This
   *  is what a change order restates; section 8 forbids the change order
   *  from restating the flag. */
  whatWasAsked: string
  /** The verbatim sentence in the new message that raised the flag. Same
   *  rule as everywhere else: verified before it is shown, never trusted. */
  source?: Provenance
  /** Renamed from whyItsOutOfScope. The old name asks the model to justify a
   *  verdict; this one asks it to state a difference. Field names shape output,
   *  and section 8 requires these to be neutral and factual. */
  differenceFromRecord: string
  /** Cents, or null when nothing in the record supports a price. Section 8
   *  forbids generating a monetary figure the user cannot trace, and a change
   *  order price is derived from a rate already in the record — never invented. */
  suggestedPrice: number | null
  /** Which line in the record the price came from. Null with suggestedPrice. */
  priceBasis: string | null
  /** Cents. What the work is worth if absorbed rather than billed. Defaults to
   *  suggestedPrice and edits downward — people absorb at a goodwill value
   *  below what they would have charged, and forcing the two equal would
   *  inflate the absorbed total. */
  estimatedValue: number | null
  status: 'open' | 'billed' | 'absorbed' | 'dismissed'
}

/** Frozen at the moment of absorbing, so later edits to the flag or to the
 *  record's rates cannot quietly restate history. */
export type AbsorbedItem = {
  id: string
  recordId: string
  description: string
  /** Cents, frozen at the moment of absorbing. null when the user absorbed it
   *  without putting a value on it — allowed, and common. */
  estimatedValue: number | null
  absorbedAt: string           // ISO date
  /** Why, in the user's own words. Never leaves the app. */
  note: string
}

// ─── Section 14: client memory and themes ──────────────────────────────────
// Not built until Phase 6 ships. Defined now so that records written to
// localStorage before then already point at a client and never need migrating.

/** The only part of a client that is stored. Everything interesting about them
 *  is derived from their records and invoices — see ClientInsight. */
export type Client = {
  id: string
  name: string
  /** How we recognise them across threads and, later, across imported mail. */
  emailAddresses: string[]
  notes: string
  createdAt: string
}

/** Where a learned number came from. The section 1 provenance rule applies to
 *  statistics too: a claim the user cannot trace to specific rows is the same
 *  confident invention we refuse everywhere else. */
export type InsightBasis = {
  /** Invoice or record ids the figure was computed from. */
  rowIds: string[]
  sampleSize: number
}

export type LearnedNumber = {
  value: number
  basis: InsightBasis
}

/**
 * Computed on read from records and invoices, never persisted — a stored summary
 * is a number that can quietly go stale and still look authoritative.
 *
 * Every field is nullable and must be null below three data points. Two
 * invoices is an anecdote, not a median, and presenting it as one would be
 * exactly the kind of thing this product exists to stop.
 */
/** NOTE: superseded in part by section 5's "never show an average" rule. The
 *  median fields below compute a summary where the spec now requires the rows
 *  themselves. Rework into row lists before any of section 14 is built — the
 *  three-data-point floor stays, the median does not. */
export type ClientInsight = {
  clientId: string
  recordsCount: number
  medianDaysToPay: LearnedNumber | null
  invoicesPaidLate: LearnedNumber | null
  scopeFlagsRaised: LearnedNumber | null
  totalBilled: LearnedNumber | null
  lastActivityAt: string | null
}

/**
 * A deliverable that recurs across records — "15s vertical reel" seen nine times
 * at seven prices. This is a rate card built from the user's own history, which
 * is the only kind of benchmark we can show honestly.
 */
export type Theme = {
  id: string
  label: string
  /** Deliverable ids that were grouped under this label. */
  deliverableIds: string[]
  timesQuoted: number
  medianUnitPrice: LearnedNumber | null
  lowestUnitPrice: number
  highestUnitPrice: number
}

// ─── Section 5: the capability ladder ──────────────────────────────────────
// The AI never sets prices. It earns the right to help with them, one
// capability at a time, and only when the user says so.

export type Stage = 'observe' | 'recall' | 'propose' | 'draft'

export const STAGE_ORDER: Stage[] = ['observe', 'recall', 'propose', 'draft']

export type CapabilityName = 'pricing' | 'scope-value' | 'chase-tone'

export type Capability = {
  name: CapabilityName
  stage: Stage
  /** One entry per proposal the user acted on: true means they overrode it.
   *  Past half across the recent window the capability is demoted a stage and
   *  told to the user in plain language. Empty until PROPOSE exists — there is
   *  nothing to override before something is proposed. */
  overrideHistory: boolean[]
  promotedAt: string | null
}

/**
 * The learning corpus. Every price the user enters or changes appends a row.
 *
 * This is the *only* thing RECALL may draw on, and the only thing PROPOSE would
 * be allowed to derive from. Nothing here comes from the model, from a market
 * rate, or from anywhere outside this browser — it is a log of decisions the
 * user made, which is exactly what makes it citable back to them.
 *
 * Separate from the records on purpose: a comparable is looked up *across*
 * projects, and a record's price can be edited afterwards while the history of
 * what was decided, and when, should not move.
 */
export type PriceEntry = {
  recordId: string
  deliverableDescription: string
  amount: number                // cents
  enteredBy: 'user' | 'proposed-accepted' | 'proposed-overridden'
  enteredAt: string             // ISO
}
