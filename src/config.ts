// Single source of truth for the assumptions the user can check and change.
// Never hardcode any of these in a component.

/** Finland's general VAT rate. Editable in settings; shown as a set-aside
 *  estimate, never as tax advice. */
export const VAT_RATE_PERCENT = 25.5

/** Invoice due date default: net 14 from issue date. */
export const DEFAULT_NET_DAYS = 14

/** No multi-currency yet — that's a stretch goal, not Phase 0. */
export const DEFAULT_CURRENCY = 'EUR' as const

/** Locale used for money and date formatting. */
export const LOCALE = 'fi-FI'

/** Extraction and drafting model. Verify against
 *  https://docs.claude.com/en/docs/about-claude/models before the first
 *  live call; fall back to FAST_MODEL if demo latency becomes a problem. */
export const MODEL = 'claude-sonnet-5'
export const FAST_MODEL = 'claude-haiku-4-5-20251001'

export const MAX_TOKENS = 4096

/** Browser-direct calls need this header alongside the API version. */
export const ANTHROPIC_API_VERSION = '2023-06-01'
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
