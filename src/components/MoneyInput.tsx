import { useState } from 'react'
import { centsFromEuros } from '../lib/money'

type Props = {
  id: string
  value: number
  onChange: (cents: number) => void
  ariaDescribedBy?: string
}

const show = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/** Typing "2 000,5" should not be fought by a formatter on every keystroke, so
 *  the text is local while focused and only normalised on blur. */
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
        aria-describedby={ariaDescribedBy}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const cents = centsFromEuros(text)
          onChange(cents ?? 0)
          setText(show(cents ?? 0))
        }}
        className="w-28 rounded-md border border-line bg-white px-2 py-1.5 text-right font-mono tabular-nums focus:border-slate/50"
      />
    </div>
  )
}
