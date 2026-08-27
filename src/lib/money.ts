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
