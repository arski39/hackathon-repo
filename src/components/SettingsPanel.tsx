import { useEffect, useRef, useState } from 'react'

export type Settings = {
  demoMode: boolean
  apiKey: string
  vatRatePercent: number
  /** Whose name is at the top of the quote. A quote with no sender is not
   *  something anyone would actually send. */
  yourName: string
  yourEmail: string
  businessId: string
}

type Props = {
  settings: Settings
  onChange: (settings: Settings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patch = (changes: Partial<Settings>) =>
    onChange({ ...settings, ...changes })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/20"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-paper"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="settings-title" className="font-display font-semibold">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 cursor-pointer px-2 text-sm text-slate hover:text-ink"
          >
            Done
          </button>
        </div>

        <div className="space-y-8 px-5 py-6">
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor="demoMode" className="font-medium">
                  Demo Mode
                </label>
                <p id="demoMode-hint" className="mt-1 text-sm text-slate">
                  Serves a canned answer for the example thread. No key, no
                  network call, nothing to go wrong on stage.
                </p>
              </div>
              <input
                id="demoMode"
                type="checkbox"
                aria-describedby="demoMode-hint"
                checked={settings.demoMode}
                onChange={(e) => patch({ demoMode: e.target.checked })}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
            </div>
          </section>

          <section>
            <h3 className="font-medium">Your details</h3>
            <p className="mt-1 text-sm text-slate">
              These go at the top of every quote and invoice. Nothing here
              leaves your browser.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="yourName" className="block text-sm text-slate">
                  Name or business name
                </label>
                <input
                  id="yourName"
                  value={settings.yourName}
                  onChange={(e) => patch({ yourName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 focus:border-slate/50"
                />
              </div>
              <div>
                <label htmlFor="yourEmail" className="block text-sm text-slate">
                  Email
                </label>
                <input
                  id="yourEmail"
                  type="email"
                  value={settings.yourEmail}
                  onChange={(e) => patch({ yourEmail: e.target.value })}
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 focus:border-slate/50"
                />
              </div>
              <div>
                <label htmlFor="businessId" className="block text-sm text-slate">
                  Business ID <span className="text-slate/70">(optional)</span>
                </label>
                <input
                  id="businessId"
                  placeholder="1234567-8"
                  value={settings.businessId}
                  onChange={(e) => patch({ businessId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-sm focus:border-slate/50"
                />
              </div>
            </div>
          </section>

          <section>
            <label htmlFor="apiKey" className="font-medium">
              Anthropic API key
            </label>
            <p id="apiKey-hint" className="mt-1 text-sm text-slate">
              Only needed with Demo Mode off. It is stored in this browser and
              sent straight to Anthropic &mdash; Backpay has no server to put it
              on. Use a key with a low spend limit and revoke it when
              you&rsquo;re done.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="apiKey-hint"
                placeholder="sk-ant-..."
                value={settings.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-sm focus:border-slate/50"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="min-h-11 shrink-0 cursor-pointer rounded-md border border-line px-3 text-sm text-slate hover:text-ink"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {settings.apiKey ? (
              <button
                type="button"
                onClick={() => patch({ apiKey: '' })}
                className="mt-2 min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
              >
                Forget this key
              </button>
            ) : null}
          </section>

          <section>
            <label htmlFor="vatRate" className="font-medium">
              VAT rate
            </label>
            <p id="vatRate-hint" className="mt-1 text-sm text-slate">
              Finland&rsquo;s general rate is 25,5%. Backpay uses this to
              estimate what to set aside. It is an estimate to help you park
              money, not tax advice.
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                id="vatRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                aria-describedby="vatRate-hint"
                value={settings.vatRatePercent}
                onChange={(e) =>
                  patch({
                    vatRatePercent: Math.min(
                      100,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
                className="w-24 rounded-md border border-line bg-white px-2.5 py-1.5 font-mono tabular-nums focus:border-slate/50"
              />
              <span className="text-slate">%</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
