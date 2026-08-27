import { useEffect, useRef } from 'react'
import { HERO_THREAD } from '../fixtures/heroThread'

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStartBlank: () => void
  busy: boolean
  demoMode: boolean
  error: { message: string; hint?: string } | null
  rawOutput: string | null
}

export function ThreadInput({
  value,
  onChange,
  onSubmit,
  onStartBlank,
  busy,
  demoMode,
  error,
  rawOutput,
}: Props) {
  const errorRef = useRef<HTMLDivElement | null>(null)

  // Move focus to the problem when one appears, so a keyboard user is not
  // left wondering why nothing happened.
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        Paste the thread. Get back what you agreed.
      </h1>
      <p className="mt-3 max-w-xl text-slate">
        Forwarded email, a chat export, or just the messy paragraph they sent
        you. It doesn&rsquo;t need tidying up first &mdash; that&rsquo;s the point.
      </p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <label htmlFor="thread" className="sr-only">
          The client thread
        </label>
        <textarea
          id="thread"
          rows={12}
          value={value}
          disabled={busy}
          aria-describedby={error ? 'thread-error' : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder="hei! so following up on the call..."
          className="w-full resize-y rounded-lg border border-line bg-white px-4 py-3 leading-relaxed focus:border-slate/50 disabled:opacity-60"
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="submit"
            disabled={busy || value.trim() === ''}
            className="min-h-11 cursor-pointer rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Reading the thread…' : 'Read the thread'}
          </button>

          <button
            type="button"
            onClick={() => onChange(HERO_THREAD)}
            disabled={busy}
            className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink disabled:opacity-40"
          >
            Use the example thread
          </button>

          <p className="ml-auto text-sm text-slate">
            {demoMode ? 'Demo Mode — no key, no network' : 'Using your API key'}
          </p>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-6">
        <p className="text-slate">Agreed on a call, with nothing in writing?</p>
        <button
          type="button"
          onClick={onStartBlank}
          disabled={busy}
          className="min-h-11 cursor-pointer font-medium underline underline-offset-4 disabled:opacity-40"
        >
          Start a blank record
        </button>
      </div>

      {busy ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="mt-8 rounded-lg border border-line bg-white/60 p-5"
        >
          <p className="sr-only">Reading the thread.</p>
          <div className="space-y-3">
            <div className="h-3 w-1/3 rounded-sm bg-line" />
            <div className="h-3 w-2/3 rounded-sm bg-line" />
            <div className="h-3 w-1/2 rounded-sm bg-line" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          ref={errorRef}
          id="thread-error"
          role="alert"
          tabIndex={-1}
          className="mt-8 rounded-lg border border-overdue/40 bg-overdue/6 px-4 py-4"
        >
          <p className="font-medium">{error.message}</p>
          {error.hint ? (
            <p className="mt-1 text-sm text-slate">{error.hint}</p>
          ) : null}

          {rawOutput ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate underline underline-offset-4">
                Show what came back
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-line bg-white p-3 text-xs whitespace-pre-wrap">
                {rawOutput}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
