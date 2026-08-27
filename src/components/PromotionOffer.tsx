type Props = {
  /** How many past rows were found for the work in this record. */
  count: number
  /** The word they were matched on, so the offer names what it matched. */
  term: string | null
  onAccept: () => void
  onDismiss: () => void
}

/**
 * The promotion offer — CLAUDE.md §5 and §7 Phase 5.
 *
 * **A prompt, not an upgrade.** Nothing here happens because enough evidence
 * accumulated; enough evidence only earns the right to ask. The button is the
 * grant, and Settings is where it can be taken back at any time.
 *
 * It is deliberately quiet. This is the moment the product's whole argument
 * lands — the tool asked instead of helping itself — and a banner that shouts
 * would undercut it.
 */
export function PromotionOffer({ count, term, onAccept, onDismiss }: Props) {
  return (
    <div className="mb-3 rounded-md border border-line bg-white px-3 py-3">
      <p className="text-sm">
        You have {count} past {count === 1 ? 'price' : 'prices'}
        {term ? (
          <>
            {' '}
            with <span className="font-medium">{term}</span> in them
          </>
        ) : null}
        . Want me to show them here when you&rsquo;re pricing?
      </p>
      <p className="mt-1 text-xs text-slate">
        It still won&rsquo;t fill the box in. It would list what you charged, and
        you would decide. You can put it back in Settings whenever you like.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAccept}
          className="min-h-11 cursor-pointer rounded-md border border-ink bg-ink px-3.5 py-1.5 text-sm text-paper transition-opacity duration-150 hover:opacity-90"
        >
          Yes, show them
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
