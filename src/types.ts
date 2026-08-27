// The data model — CLAUDE.md §4. Everything else derives from this file.

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
   *  deliverable itself, and section 11 requires every number be traceable. */
  priceSource?: Provenance
}

/** Section 6 requires provenance on *every* extracted field, but the section 4
 *  model only carries `source` on Deliverable. This is the additive companion:
 *  a quote for each scalar field the model filled in. Optional, so a Deal built
 *  by hand is still a valid Deal. */
export type DealFieldKey =
  | 'clientName'
  | 'projectName'
  | 'deadline'
  | 'usageRights'
  | 'revisionsIncluded'
  | 'depositPercent'
  | 'netDays'

export type DealFieldSources = Partial<Record<DealFieldKey, Provenance>>

export type Deal = {
  id: string
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
  fieldSources?: DealFieldSources
  createdAt: string
}

export type Message = {
  id: string
  from: 'client' | 'creator'
  sender: string
  body: string
  receivedAt: string
}

export type Invoice = {
  id: string
  dealId: string
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
  dealId: string
  messageId: string
  whatWasAsked: string
  whyItsOutOfScope: string
  suggestedPrice: number       // cents
  status: 'open' | 'billed' | 'dismissed'
}
