import { DEFAULT_CURRENCY, LOCALE } from '../config'

// All money is integer cents. Never floats, never a Number that has been
// through a division without rounding.

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
})

/** Format integer cents as euros: 200000 -> "2 000,00 €" */
export function formatEuros(cents: number): string {
  return formatter.format(cents / 100)
}

/** Parse a user-typed euro amount into integer cents. Accepts "2 000,50",
 *  "2000.50", "€2000". Returns null on anything unparseable. */
export function centsFromEuros(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(/\s/g, '')
  if (cleaned === '' || cleaned === '-') return null
  // Whichever separator comes last is the decimal one.
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalAt = Math.max(lastComma, lastDot)
  const normalised =
    decimalAt === -1
      ? cleaned.replace(/[,.]/g, '')
      : cleaned.slice(0, decimalAt).replace(/[,.]/g, '') +
        '.' +
        cleaned.slice(decimalAt + 1).replace(/[,.]/g, '')
  const value = Number(normalised)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

/**
 * A price that may not have been decided yet — CLAUDE.md §6.
 *
 * `null` is not zero. Printing "0,00 €" where nobody has decided puts a number
 * in the user's mouth, and on a document a client reads it agrees to free work
 * on their behalf. This is the only place that distinction should need writing.
 */
export function formatPrice(cents: number | null, gap = 'price not set'): string {
  return cents === null ? gap : formatEuros(cents)
}

/** The line total, or null when the line has no price yet. */
export function lineTotalOf(quantity: number, unitPrice: number | null): number | null {
  return unitPrice === null ? null : quantity * unitPrice
}
