import { useEffect, useRef, useState } from 'react'

type Props = {
  text: string
  label: string
  className?: string
}

type State = 'idle' | 'copied' | 'failed'

/**
 * Copy, with the failure case handled rather than swallowed.
 *
 * The Clipboard API needs a secure context and a permission that a browser can
 * refuse. When it does, the button says so and points at the text, which is on
 * screen anyway — the one thing it must never do is look like it worked.
 */
export function CopyButton({ text, label, className }: Props) {
  const [state, setState] = useState<State>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const announce = (next: State) => {
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2400)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => announce('copied'))
            .catch(() => announce('failed'))
        }}
        className={
          className ??
          'min-h-11 cursor-pointer rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition-opacity duration-150 hover:opacity-90'
        }
      >
        {label}
      </button>
      <p role="status" className="text-sm text-slate">
        {state === 'copied' ? 'Copied.' : null}
        {state === 'failed'
          ? 'Your browser blocked the copy — select the text below instead.'
          : null}
      </p>
    </div>
  )
}
