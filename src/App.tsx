import { useState } from 'react'
import { RecordReview } from './components/RecordReview'
import { QuoteView } from './components/QuoteView'
import { SettingsPanel, type Settings } from './components/SettingsPanel'
import { ThreadInput } from './components/ThreadInput'
import { ApiError } from './lib/anthropic'
import { parseThread } from './lib/parseThread'
import { runExtraction } from './lib/runExtraction'
import { useLocalStorage } from './lib/useLocalStorage'
import type { ProjectRecord } from './types'

// No router: GitHub Pages 404s on client-side routes, so views switch on state.
type View = 'input' | 'review' | 'quote'

type Failure = { message: string; hint?: string; raw?: string }

// Demo Mode is on by default. Hackathon wifi is the single most likely thing
// to break, and a first-run user has no key anyway.
const DEFAULT_SETTINGS: Settings = {
  demoMode: true,
  apiKey: '',
  yourName: '',
  yourEmail: '',
  businessId: '',
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>(
    'backpay.settings',
    DEFAULT_SETTINGS,
  )
  const [thread, setThread] = useLocalStorage('backpay.draftThread', '')
  // Persisted, so a refresh mid-edit doesn't throw the work away.
  const [record, setRecord] = useLocalStorage<ProjectRecord | null>('backpay.record', null)

  const [view, setView] = useState<View>(record ? 'review' : 'input')
  const [warnings, setWarnings] = useState<string[]>([])
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
      })
      if (outcome.kind === 'ok') {
        setRecord(outcome.record)
        setWarnings(outcome.warnings)
        setView('review')
      } else {
        // Twice now. Show what actually came back rather than inventing a
        // plausible record the user would have no reason to distrust.
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
        message:
          apiError?.message ?? `Something went wrong: ${(e as Error).message}`,
        hint: apiError?.hint,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => setView(record ? 'review' : 'input')}
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
        {view === 'input' || !record ? (
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
        ) : view === 'review' ? (
          <RecordReview
            record={record}
            warnings={warnings}
            onChange={setRecord}
            onStartOver={() => setView('input')}
            onSeeQuote={() => setView('quote')}
          />
        ) : (
          <QuoteView
            record={record}
            settings={settings}
            onBack={() => setView('review')}
          />
        )}
      </main>

      <footer className="no-print border-t border-line">
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
