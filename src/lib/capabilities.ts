import { STAGE_ORDER } from '../types'
import type { Capability, CapabilityName, Stage } from '../types'

/**
 * The capability ladder — CLAUDE.md §5.
 *
 * Everything starts at OBSERVE. Promotion is granted by the user and never
 * happens on its own; demotion happens on its own and is always explained.
 */
export const CAPABILITY_LABEL: Record<CapabilityName, string> = {
  pricing: 'Pricing',
  'scope-value': 'What added work is worth',
  'chase-tone': 'Tone of a chase email',
}

export const STAGE_LABEL: Record<Stage, string> = {
  observe: 'Observe',
  recall: 'Recall',
  propose: 'Propose',
  draft: 'Draft',
}

export const STAGE_BLURB: Record<Stage, string> = {
  observe: 'Leaves the field blank. You enter the number.',
  recall: 'Still leaves the field blank, and shows what you charged before.',
  propose: 'Fills it in from your own past work, and says which projects.',
  draft: 'Completes the whole thing for you to check.',
}

export const DEFAULT_CAPABILITIES: Capability[] = [
  { name: 'pricing', stage: 'observe', overrideHistory: [], promotedAt: null },
  { name: 'scope-value', stage: 'observe', overrideHistory: [], promotedAt: null },
  { name: 'chase-tone', stage: 'observe', overrideHistory: [], promotedAt: null },
]

/** Two invoices is an anecdote wearing a median's clothes. Same floor as §14.2. */
export const EVIDENCE_FLOOR = 3

/** How many recent decisions the override rate is judged over. */
const OVERRIDE_WINDOW = 6

export function stageOf(capabilities: Capability[], name: CapabilityName): Stage {
  return capabilities.find((c) => c.name === name)?.stage ?? 'observe'
}

export function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage)
}

/**
 * Pricing cannot be jumped past RECALL (§5). Everything else may skip ahead if
 * the user insists — money is the thing they came for and the thing they will
 * not forgive being wrong, so it is the one place we refuse.
 */
export function highestAllowed(name: CapabilityName, evidenceCount: number): Stage {
  if (evidenceCount < EVIDENCE_FLOOR) return 'observe'
  if (name === 'pricing') return 'recall'
  return 'draft'
}

export function canPromote(
  capability: Capability,
  evidenceCount: number,
): boolean {
  const next = STAGE_ORDER[stageIndex(capability.stage) + 1]
  if (!next) return false
  return stageIndex(next) <= stageIndex(highestAllowed(capability.name, evidenceCount))
}

export function promote(capability: Capability, at = new Date().toISOString()): Capability {
  const next = STAGE_ORDER[stageIndex(capability.stage) + 1]
  if (!next) return capability
  // Override history belongs to the stage that produced it. Carrying it across
  // a promotion would demote the new stage for the old one's mistakes.
  return { ...capability, stage: next, overrideHistory: [], promotedAt: at }
}

export function demote(capability: Capability): Capability {
  const previous = STAGE_ORDER[stageIndex(capability.stage) - 1]
  if (!previous) return capability
  return { ...capability, stage: previous, overrideHistory: [], promotedAt: null }
}

/**
 * Record what the user did with a proposal, and demote if they keep changing
 * it. Dormant until PROPOSE exists — nothing is proposed at OBSERVE or RECALL,
 * so there is nothing to override.
 */
export function recordOutcome(
  capability: Capability,
  overridden: boolean,
): { capability: Capability; demotedBecause: string | null } {
  if (stageIndex(capability.stage) < stageIndex('propose')) {
    return { capability, demotedBecause: null }
  }

  const history = [...capability.overrideHistory, overridden].slice(-OVERRIDE_WINDOW)
  const overrides = history.filter(Boolean).length

  // Judge only on a full window. Demoting after two corrections out of three
  // punishes the user for a bad first week.
  if (history.length >= OVERRIDE_WINDOW && overrides * 2 > history.length) {
    return {
      capability: demote({ ...capability, overrideHistory: history }),
      demotedBecause:
        `You changed the ${CAPABILITY_LABEL[capability.name].toLowerCase()} I suggested on ` +
        `${overrides} of the last ${history.length}, so I've stopped suggesting and gone back to ` +
        `${STAGE_LABEL[STAGE_ORDER[stageIndex(capability.stage) - 1]].toLowerCase()}.`,
    }
  }

  return { capability: { ...capability, overrideHistory: history }, demotedBecause: null }
}
