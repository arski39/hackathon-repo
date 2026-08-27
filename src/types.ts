// The data model — CLAUDE.md §5. Everything else derives from this file.

export type Provenance = {
  quote: string        // exact substring from the source thread
  messageId: string    // which message it came from
}

export type Deliverable = {
  id: string
  description: string  // "3 vertical reels, 15s each"
  quantity: number
  unitPrice: number    // in cents, always
  source?: Provenance
  /** Additive: the budget is usually stated in a different sentence from the
   *  deliverable itself, and section 12 requires every number be traceable. */
  priceSource?: Provenance
}

/** Section 7 requires provenance on *every* extracted field, but the section 5
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
  vatRatePercent: number
  notes: string
  sourceThread: Message[]
  fieldSources?: RecordFieldSources
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
  whatWasAsked: string
  whyItsOutOfScope: string
  suggestedPrice: number       // cents
  status: 'open' | 'billed' | 'dismissed'
}

// ─── Section 13: client memory and themes ──────────────────────────────────
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
