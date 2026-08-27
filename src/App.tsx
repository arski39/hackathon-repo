import { useState } from 'react'
import { DealReview } from './components/DealReview'
import { SettingsPanel, type Settings } from './components/SettingsPanel'
import { ThreadInput } from './components/ThreadInput'
import { ApiError } from './lib/anthropic'
import { parseThread } from './lib/parseThread'
import { runExtraction } from './lib/runExtraction'
import { useLocalStorage } from './lib/useLocalStorage'
import { VAT_RATE_PERCENT } from './config'
import type { Deal } from './types'

// No router: GitHub Pages 404s on client-side routes, so views switch on state.
type View =
  | { name: 'input' }
  | { name: 'review'; deal: Deal; warnings: string[] }

type Failure = { message: string; hint?: string; raw?: string }

// Demo Mode is on by default. Hackathon wifi is the single most likely thing
// to break, and a first-run user has no key anyway.
const DEFAULT_SETTINGS: Settings = {
  demoMode: true,
  apiKey: '',
  vatRatePercent: VAT_RATE_PERCENT,
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>(
    'backpay.settings',
    DEFAULT_SETTINGS,
  )
  const [thread, setThread] = useLocalStorage('backpay.draftThread', '')
  const [view, setView] = useState<View>({ name: 'input' })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function readTheThread() {
    const messages = parseThread(thread)
    if (messages.length === 0) {
      setFailure({ message: 'There is nothing to read yet.' })
      return
    }
    if (!settings.demoMode && settings.apiKey.trim() === '') {
      setFailure({
        message: 'No API key set.',
        hint: 'Add one in Settings, or switch Demo Mode back on to try it without a key.',
      })
      return
    }

    setBusy(true)
    setFailure(null)
    try {
      const outcome = await runExtraction(messages, {
        demoMode: settings.demoMode,
        apiKey: settings.apiKey.trim(),
        vatRatePercent: settings.vatRatePercent,
      })
      if (outcome.kind === 'ok') {
        setView({ name: 'review', deal: outcome.deal, warnings: outcome.warnings })
      } else {
        // Twice now. Show what actually came back rather than inventing a
        // plausible Deal the user would have no reason to distrust.
        setFailure({
          message: "That didn't come back in a shape we could use.",
          hint: outcome.errors.join(' '),
          raw: outcome.raw,
        })
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const apiError = e instanceof ApiError ? e : null
      setFailure({
        message: apiError?.message ?? `Something went wrong: ${(e as Error).message}`,
        hint: apiError?.hint,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => setView({ name: 'input' })}
            className="cursor-pointer font-display text-lg font-semibold tracking-tight"
          >
            Backpay
          </button>
          <div className="flex items-center gap-4">
            {settings.demoMode ? (
              <span className="rounded-full border border-line px-2.5 py-1 text-xs text-slate">
                Demo Mode
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-11 cursor-pointer text-sm text-slate hover:text-ink"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view.name === 'input' ? (
          <ThreadInput
            value={thread}
            onChange={(next) => {
              setThread(next)
              setFailure(null)
            }}
            onSubmit={readTheThread}
            busy={busy}
            demoMode={settings.demoMode}
            error={failure}
            rawOutput={failure?.raw ?? null}
          />
        ) : (
          <DealReview
            deal={view.deal}
            warnings={view.warnings}
            onChange={(deal) => setView({ ...view, deal })}
            onStartOver={() => setView({ name: 'input' })}
          />
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 text-sm text-slate sm:px-8">
          Nothing sends. Nothing charges. You click the real send button
          yourself.
        </div>
      </footer>

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
