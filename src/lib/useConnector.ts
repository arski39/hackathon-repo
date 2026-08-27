import { useLayoutEffect, useState } from 'react'

export type Connector = { d: string; to: [number, number] }

/**
 * The hairline between a field and the sentence it came from.
 *
 * Geometry has to be read after layout, so this is one of the few places an
 * effect is genuinely the right tool — it is synchronising with the DOM, not
 * with React state. useLayoutEffect rather than useEffect so the line is never
 * painted at last frame's coordinates.
 *
 * Only drawn when the two columns are actually side by side. Stacked on a
 * phone, a line looping down the page would be noise, and the highlight plus
 * the button's pressed state already carry the meaning.
 */
export function useConnector(
  frame: React.RefObject<HTMLElement | null>,
  mark: React.RefObject<HTMLElement | null>,
  rows: React.RefObject<Map<string, HTMLElement>>,
  activeKey: string | null,
) {
  const [connector, setConnector] = useState<Connector | null>(null)

  useLayoutEffect(() => {
    function measure() {
      const frameEl = frame.current
      const markEl = mark.current
      const rowEl = activeKey ? rows.current.get(activeKey) : undefined

      if (
        !frameEl ||
        !markEl ||
        !rowEl ||
        !window.matchMedia('(min-width: 1024px)').matches
      ) {
        setConnector(null)
        return
      }

      const base = frameEl.getBoundingClientRect()
      const m = markEl.getBoundingClientRect()
      const r = rowEl.getBoundingClientRect()

      // The thread column scrolls independently — don't leave a line pointing
      // at a highlight that has scrolled out of the box.
      if (m.bottom < base.top || m.top > base.bottom) {
        setConnector(null)
        return
      }

      const fromX = m.right - base.left
      const fromY = m.top + m.height / 2 - base.top
      const toX = r.left - base.left
      const toY = r.top + Math.min(28, r.height / 2) - base.top
      const midX = fromX + (toX - fromX) / 2

      setConnector({
        d: `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`,
        to: [toX, toY],
      })
    }

    measure()
    window.addEventListener('resize', measure)
    // Capture phase, so the thread column's own scrolling counts too.
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [frame, mark, rows, activeKey])

  return connector
}
