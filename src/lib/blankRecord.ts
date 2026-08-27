import { newId } from './id'
import { DEFAULT_NET_DAYS } from '../config'
import type { ProjectRecord } from '../types'

/**
 * A record with nothing in it — CLAUDE.md §6, Phase 1.
 *
 * Not a fallback for when extraction fails. Plenty of creative work is agreed
 * on a call and never appears in writing at all, and a tool that can only read
 * threads has nothing to offer those projects. It starts with one empty
 * deliverable because a record with no lines has nothing to type into.
 */
export function blankRecord(): ProjectRecord {
  return {
    id: newId('record'),
    origin: 'manual',
    clientId: null,
    clientName: '',
    projectName: '',
    status: 'draft',
    deliverables: [{ id: newId('dlv'), description: '', quantity: 1, unitPrice: null }],
    revisionsIncluded: 0,
    deadline: null,
    usageRights: null,
    paymentTerms: { depositPercent: 0, netDays: DEFAULT_NET_DAYS },
    currency: 'EUR',
    notes: '',
    sourceThread: [],
    absorbedWork: [],
    createdAt: new Date().toISOString(),
  }
}
