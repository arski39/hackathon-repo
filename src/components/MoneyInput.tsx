import { useState } from 'react'
import { centsFromEuros } from '../lib/money'

type Props = {
  id: string
  /** null means nobody has decided yet. It renders as an empty box, not as
   *  0,00 — see CLAUDE.md §6. */
  value: number | null
  onChange: (cents: number | null) => void
  ariaDescribedBy?: string
}

const show = (cents: number | null) =>
  cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')

/**
 * A euro amount that may not have been decided yet.
 *
 * Clearing the box puts it back to `null` rather than to zero. That round trip
 * matters: under the capability ladder a blank price is the normal state of a
 * new record, and a field the user cannot empty again would quietly turn "I
 * haven't decided" into "this is free" the first time they mistype.
 *
 * Typing "2 000,5" should not be fought by a formatter on every keystroke, so
 * the text is local while focused and only normalised on blur.
 */
export function MoneyInput({ id, value, onChange, ariaDescribedBy }: Props) {
  const [draft, setDraft] = useState(() => ({ text: show(value), seen: value }))

  // Adjusting state during render is the sanctioned way to follow a prop
  // without a round-trip through an effect. Only resets when the value
  // changed from the outside, so typing is never interrupted.
  let text = draft.text
  if (draft.seen !== value) {
    text = centsFromEuros(draft.text) === value ? draft.text : show(value)
    setDraft({ text, seen: value })
  }
  const setText = (next: string) => setDraft({ text: next, seen: value })

  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="font-mono text-slate">
        €
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder="—"
        aria-describedby={ariaDescribedBy}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          // An empty box is a decision the user has not made yet, and stays
          // one. Only a parseable number becomes a number.
          const cents = text.trim() === '' ? null : centsFromEuros(text)
          onChange(cents)
          setText(show(cents))
        }}
        className="w-28 rounded-md border border-line bg-white px-2 py-1.5 text-right font-mono tabular-nums placeholder:text-slate/50 focus:border-slate/50"
      />
    </div>
  )
}
