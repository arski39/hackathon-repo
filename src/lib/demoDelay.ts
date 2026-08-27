/** Demo Mode: no network, no key, but not instant either — an answer that
 *  arrives in 0ms doesn't read as work being done. */
export const DEMO_DELAY_MS = 1400

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}
