/**
 * Locale-aware formatting.
 *
 * The interesting cases are numerals and bidirectional text. A Persian player
 * expects to read ۱۲ – ۹, not 12 – 9; an Arabic player expects ١٢. And a score
 * like "12 – 9" embedded in RTL prose needs isolation marks or the dash ends up
 * on the wrong side.
 */
import { LOCALE_META, type Locale } from './locales.ts'

const numberFormatters = new Map<string, Intl.NumberFormat>()

export interface NumberOptions extends Intl.NumberFormatOptions {
  /** Force Latin digits regardless of the locale default. */
  readonly latinDigits?: boolean
}

export function formatNumber(locale: Locale, value: number, options: NumberOptions = {}): string {
  const meta = LOCALE_META[locale]
  const useLocalDigits = options.latinDigits ? false : meta.localizedDigitsByDefault
  const numberingSystem = useLocalDigits ? meta.numberingSystem : 'latn'
  const { latinDigits: _ignored, ...intlOptions } = options
  const key = `${locale}:${numberingSystem}:${JSON.stringify(intlOptions)}`
  let formatter = numberFormatters.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(`${locale}-u-nu-${numberingSystem}`, intlOptions)
    } catch {
      formatter = new Intl.NumberFormat(locale, intlOptions)
    }
    numberFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

export function formatPercent(locale: Locale, ratio: number, digits = 0): string {
  return formatNumber(locale, ratio, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Compact "1:05" / "0:09" clock, with locale digits. */
export function formatClock(locale: Locale, seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  const m = formatNumber(locale, minutes, { useGrouping: false })
  const s = formatNumber(locale, rest, { useGrouping: false, minimumIntegerDigits: 2 })
  return `${m}:${s}`
}

/** "2.4 s" / "820 ms", chosen by magnitude. */
export function formatDuration(locale: Locale, ms: number): string {
  if (ms < 1000) return `${formatNumber(locale, Math.round(ms))} ms`
  if (ms < 60_000) return `${formatNumber(locale, ms / 1000, { maximumFractionDigits: 1 })} s`
  return formatClock(locale, ms / 1000)
}

const relativeFormatters = new Map<Locale, Intl.RelativeTimeFormat>()

export function formatRelativeTime(locale: Locale, timestamp: number, now = Date.now()): string {
  let formatter = relativeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeFormatters.set(locale, formatter)
  }
  const deltaSeconds = Math.round((timestamp - now) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit)
    }
  }
  return formatter.format(deltaSeconds, 'second')
}

export function formatDate(locale: Locale, timestamp: number): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(timestamp)
}

/**
 * Wraps a run of text in Unicode isolates so it keeps its own direction inside
 * a paragraph of the opposite direction. Without this, "Noqat 12 – 9" renders
 * as "9 – 12 Noqat" in a Persian sentence.
 */
export function isolate(text: string): string {
  // U+2066 FIRST STRONG ISOLATE ... U+2069 POP DIRECTIONAL ISOLATE.
  return '\u2066' + text + '\u2069'
}

/** A score pair that survives being dropped into RTL prose. */
export function formatScore(locale: Locale, a: number, b: number): string {
  const dash = '\u2009\u2013\u2009' // thin space, en dash, thin space
  return isolate(formatNumber(locale, a) + dash + formatNumber(locale, b))
}

const listFormatters = new Map<string, Intl.ListFormat>()

export function formatList(
  locale: Locale,
  items: readonly string[],
  type: 'conjunction' | 'disjunction' = 'conjunction',
): string {
  const key = `${locale}:${type}`
  let formatter = listFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { style: 'long', type })
    listFormatters.set(key, formatter)
  }
  return formatter.format(items)
}
