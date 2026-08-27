import type { ReactNode } from 'react'
import type { ProvenanceApi } from '../lib/provenance'
import { SourceButton } from './SourceButton'
import type { Provenance } from '../types'

type Props = {
  fieldKey: string
  label: string
  hint?: string
  source?: Provenance
  provenance: ProvenanceApi
  registerRow: (key: string, node: HTMLDivElement | null) => void
  children: ReactNode
}

export function Field({
  fieldKey,
  label,
  hint,
  source,
  provenance,
  registerRow,
  children,
}: Props) {
  const isActive = provenance.active?.key === fieldKey

  return (
    <div
      ref={(node) => registerRow(fieldKey, node)}
      className={`rounded-lg border px-3 py-3 transition-colors duration-150 ${
        isActive ? 'border-overdue/40 bg-overdue/4' : 'border-transparent'
      }`}
    >
      <label
        htmlFor={fieldKey}
        className="block text-sm font-medium tracking-wide text-slate uppercase"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={`${fieldKey}-hint`} className="mt-1.5 text-sm text-slate">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">
        <SourceButton
          fieldKey={fieldKey}
          label={label}
          source={source}
          provenance={provenance}
        />
      </div>
    </div>
  )
}
