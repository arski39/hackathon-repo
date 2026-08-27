import { useEffect, useRef } from 'react'
import type { ActiveSource } from '../lib/provenance'
import type { Message } from '../types'

type Props = {
  messages: Message[]
  active: ActiveSource | null
  markRef: React.RefObject<HTMLElement | null>
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/** Render the body, wrapping the active quote in a <mark>. If the quote isn't
 *  in this body the text renders untouched — validateDeal already refuses
 *  quotes it can't find, so this is belt and braces. */
function renderBody(
  body: string,
  quote: string | null,
  markRef: React.RefObject<HTMLElement | null>,
) {
  if (!quote) return body
  const at = body.indexOf(quote)
  if (at === -1) return body
  return (
    <>
      {body.slice(0, at)}
      <mark
        ref={markRef}
        className="rounded-sm bg-overdue/12 text-ink shadow-[inset_0_-1.5px_0_0] shadow-overdue/60"
      >
        {quote}
      </mark>
      {body.slice(at + quote.length)}
    </>
  )
}

export function ThreadColumn({ messages, active, markRef, scrollRef }: Props) {
  const lastKey = useRef<string | null>(null)

  // Bring the highlight into view when a new field is selected, but never
  // yank the column around while the user is only moving the mouse over it.
  useEffect(() => {
    if (!active || active.key === lastKey.current) return
    lastKey.current = active.key
    const mark = markRef.current
    const box = scrollRef.current
    if (!mark || !box) return
    const markBox = mark.getBoundingClientRect()
    const boxBox = box.getBoundingClientRect()
    if (markBox.top >= boxBox.top && markBox.bottom <= boxBox.bottom) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({
      top: box.scrollTop + (markBox.top - boxBox.top) - boxBox.height / 2 + markBox.height / 2,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [active, markRef, scrollRef])

  useEffect(() => {
    if (!active) lastKey.current = null
  }, [active])

  return (
    <section aria-label="The thread you pasted" className="min-w-0">
      <h2 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
        What they sent
      </h2>
      <div
        ref={scrollRef}
        className="mt-3 max-h-[32rem] overflow-y-auto rounded-lg border border-line bg-white/60 lg:max-h-[calc(100dvh-16rem)]"
      >
        <ol className="divide-y divide-line">
          {messages.map((message) => (
            <li key={message.id} className="px-4 py-4 sm:px-5">
              <p className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{message.sender}</span>
                <span className="text-slate">
                  {message.from === 'client' ? 'client' : 'you'}
                </span>
              </p>
              <p className="mt-2 leading-relaxed whitespace-pre-wrap">
                {renderBody(
                  message.body,
                  active?.messageId === message.id ? active.quote : null,
                  markRef,
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
