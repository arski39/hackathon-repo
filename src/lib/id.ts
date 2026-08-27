/** Stable-enough ids for local objects. crypto.randomUUID needs a secure
 *  context, which localhost and Pages both are — but fall back anyway. */
export function newId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${raw}` : raw
}
