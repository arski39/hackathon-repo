import { useEffect, useRef, useState } from 'react'
import {
  CAPABILITY_LABEL,
  canPromote,
  demote,
  promote,
  STAGE_BLURB,
  STAGE_LABEL,
  stageIndex,
} from '../lib/capabilities'
import type { Capability } from '../types'

export type Settings = {
  demoMode: boolean
  apiKey: string
  /** Section 3. Off by default: it is the riskier path through extraction,
   *  so it should be a deliberate choice rather than a silent one. */
  redact: boolean
  /** Whose name is at the top of the quote. A quote with no sender is not
   *  something anyone would actually send. */
  yourName: string
  yourEmail: string
  businessId: string
}

type Props = {
  settings: Settings
  capabilities: Capability[]
  /** How many prices the user has entered. Nothing is offered below the floor. */
  evidenceCount: number
  onChange: (settings: Settings) => void
  onCapabilitiesChange: (capabilities: Capability[]) => void
  onClose: () => void
}

export function SettingsPanel({
  settings,
  capabilities,
  evidenceCount,
  onChange,
  onCapabilitiesChange,
  onClose,
}: Props) {
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

  const setCapability = (next: Capability) =>
    onCapabilitiesChange(capabilities.map((c) => (c.name === next.name ? next : c)))

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
            <h3 className="font-medium">What Backpay is allowed to do</h3>
            <p className="mt-1 text-sm text-slate">
              It never sets a price. It starts by watching what you charge, and
              you decide when it has seen enough to be useful. Nothing here moves
              on its own.
            </p>

            <ul className="mt-4 space-y-4">
              {capabilities.map((capability) => {
                const eligible = canPromote(capability, evidenceCount)
                const next = STAGE_LABEL[
                  (['observe', 'recall', 'propose', 'draft'] as const)[
                    stageIndex(capability.stage) + 1
                  ] ?? 'draft'
                ]
                return (
                  <li
                    key={capability.name}
                    className="rounded-lg border border-line bg-white px-3 py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{CAPABILITY_LABEL[capability.name]}</p>
                      <p className="text-xs tracking-wide text-slate uppercase">
                        {STAGE_LABEL[capability.stage]}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate">
                      {STAGE_BLURB[capability.stage]}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      {eligible ? (
                        <button
                          type="button"
                          onClick={() => setCapability(promote(capability))}
                          className="min-h-11 cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm hover:border-slate/40"
                        >
                          Let it {next.toLowerCase()}
                        </button>
                      ) : (
                        <p className="text-sm text-slate/80">
                          {capability.name === 'pricing' &&
                          stageIndex(capability.stage) >= 1
                            ? 'This is as far as pricing goes. It will not fill the box in for you.'
                            : `Not yet — ${evidenceCount} price${evidenceCount === 1 ? '' : 's'} recorded so far.`}
                        </p>
                      )}
                      {stageIndex(capability.stage) > 0 ? (
                        <button
                          type="button"
                          onClick={() => setCapability(demote(capability))}
                          className="min-h-11 cursor-pointer text-sm text-slate underline underline-offset-4 hover:text-ink"
                        >
                          Put it back
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rounded-lg border border-line bg-white/70 px-4 py-4">
            <h3 className="font-medium">Where your text goes</h3>
            <p className="mt-1.5 text-sm text-slate">
              Your thread text is sent to Anthropic to be read, using your own
              API key. It goes nowhere else. There is no Backpay server.
              Everything you create stays in this browser, and nothing about how
              you use this app is recorded or sent anywhere.
            </p>
          </section>

          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor="redact" className="font-medium">
                  Redact names before sending
                </label>
                <p id="redact-hint" className="mt-1 text-sm text-slate">
                  Swaps email addresses and the names in the thread for
                  placeholders on the way out, and puts them back here. It is
                  pattern matching, not anonymisation &mdash; a client mentioned
                  only by a nickname will go through untouched. Demo Mode sends
                  nothing at all, so this has nothing to do while that is on.
                </p>
              </div>
              <input
                id="redact"
                type="checkbox"
                aria-describedby="redact-hint"
                checked={settings.redact}
                onChange={(e) => patch({ redact: e.target.checked })}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
            </div>
          </section>
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
        </div>
      </div>
    </div>
  )
}
