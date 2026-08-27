import type { ActiveSource, ProvenanceApi } from '../lib/provenance'
import type { Provenance } from '../types'

type Props = {
  fieldKey: string
  label: string
  source: Provenance | undefined
  provenance: ProvenanceApi
}

/**
 * The trust mechanism, as a real button.
 *
 * Hover activates it because that feels immediate, but hover is never the only
 * way in: it is focusable, it toggles on click, and it reports its state with
 * aria-pressed. A div with onMouseEnter would leave keyboard and touch users
 * with no way to check where a number came from.
 */
export function SourceButton({ fieldKey, label, source, provenance }: Props) {
  if (!source) {
    return (
      <span className="text-xs text-slate/70 italic" title="Nothing in the thread said this">
        not in the thread
      </span>
    )
  }

  const active: ActiveSource = { ...source, key: fieldKey }
  const isActive = provenance.active?.key === fieldKey
  const isPinned = provenance.pinnedKey === fieldKey

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onMouseEnter={() => provenance.peek(active)}
      onMouseLeave={() => provenance.peek(null)}
      onFocus={() => provenance.peek(active)}
      onBlur={() => provenance.peek(null)}
      onClick={() => provenance.toggle(active)}
      className={`inline-flex max-w-full min-h-[1.75rem] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ${
        isActive
          ? 'border-overdue/40 bg-overdue/10 text-ink'
          : 'border-line text-slate hover:border-slate/40 hover:text-ink'
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M6 3.5 3.5 8 6 12.5M10 3.5 12.5 8 10 12.5" />
      </svg>
      <span className="truncate">{source.quote}</span>
      <span className="sr-only">
        {` — source for ${label}. ${isPinned ? 'Selected.' : 'Select to keep it highlighted.'}`}
      </span>
    </button>
  )
}
