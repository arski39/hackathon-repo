import type { Provenance } from '../types'

/** A source being pointed at right now. `key` identifies which control on the
 *  Deal side is asking, so two fields quoting the same sentence stay distinct. */
export type ActiveSource = Provenance & { key: string }

export type ProvenanceApi = {
  active: ActiveSource | null
  pinnedKey: string | null
  /** Called on focus and on hover — the transient, reversible path. */
  peek: (source: ActiveSource | null) => void
  /** Called on click — sticky, so the connector survives moving the mouse. */
  toggle: (source: ActiveSource) => void
}
