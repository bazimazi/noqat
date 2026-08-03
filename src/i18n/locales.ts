/**
 * Locale metadata.
 *
 * A locale is more than a message file. It carries writing direction, the
 * numbering system its readers actually expect to see (Persian uses
 * ۰۱۲۳۴۵۶۷۸۹, Arabic ٠١٢٣٤٥٦٧٨٩), a font stack that can render its script, and
 * a line-height that suits it — Devanagari and Arabic need more leading than
 * Latin, and CJK needs less letter-spacing.
 */
import type { PartialMessages } from './messages.ts'

export const LOCALES = [
  'en',
  'fa',
  'ar',
  'tr',
  'hi',
  'ja',
  'zh',
  'ko',
  'fr',
  'es',
  'de',
] as const

export type Locale = (typeof LOCALES)[number]

export type Direction = 'ltr' | 'rtl'

export interface LocaleMeta {
  readonly code: Locale
  /** Name in the language itself — never translate this. */
  readonly nativeName: string
  readonly englishName: string
  readonly dir: Direction
  /** BCP-47 numbering system for `Intl.NumberFormat`. */
  readonly numberingSystem: string
  /** Whether to render digits in the local system by default. */
  readonly localizedDigitsByDefault: boolean
  /** Font stack able to render this script. */
  readonly fontStack: string
  /** Multiplier on the base line-height. */
  readonly lineHeight: number
  /** Extra letter-spacing (em) — negative tightens. */
  readonly tracking: string
  readonly flag: string
}

const LATIN = '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: LATIN,
    lineHeight: 1.5,
    tracking: '0',
    flag: '🇬🇧',
  },
  fa: {
    code: 'fa',
    nativeName: 'فارسی',
    englishName: 'Persian',
    dir: 'rtl',
    numberingSystem: 'arabext',
    localizedDigitsByDefault: true,
    fontStack: '"Vazirmatn", "Iranian Sans", "Noto Naskh Arabic", "Tahoma", sans-serif',
    lineHeight: 1.85,
    tracking: '0',
    flag: '🇮🇷',
  },
  ar: {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    numberingSystem: 'arab',
    localizedDigitsByDefault: true,
    fontStack: '"Noto Naskh Arabic", "Amiri", "Segoe UI", "Tahoma", sans-serif',
    lineHeight: 1.9,
    tracking: '0',
    flag: '🇸🇦',
  },
  tr: {
    code: 'tr',
    nativeName: 'Türkçe',
    englishName: 'Turkish',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: LATIN,
    lineHeight: 1.55,
    tracking: '0',
    flag: '🇹🇷',
  },
  hi: {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", sans-serif',
    lineHeight: 1.8,
    tracking: '0',
    flag: '🇮🇳',
  },
  ja: {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif',
    lineHeight: 1.7,
    tracking: '0.02em',
    flag: '🇯🇵',
  },
  zh: {
    code: 'zh',
    nativeName: '中文',
    englishName: 'Chinese',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    lineHeight: 1.7,
    tracking: '0.02em',
    flag: '🇨🇳',
  },
  ko: {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    lineHeight: 1.72,
    tracking: '-0.01em',
    flag: '🇰🇷',
  },
  fr: {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: LATIN,
    lineHeight: 1.55,
    tracking: '0',
    flag: '🇫🇷',
  },
  es: {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    fontStack: LATIN,
    lineHeight: 1.55,
    tracking: '0',
    flag: '🇪🇸',
  },
  de: {
    code: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    dir: 'ltr',
    numberingSystem: 'latn',
    localizedDigitsByDefault: false,
    // German compounds run long; a slightly tighter stack keeps buttons intact.
    fontStack: LATIN,
    lineHeight: 1.55,
    tracking: '-0.005em',
    flag: '🇩🇪',
  },
}

/** Lazily imported so a session only downloads the language it uses. */
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: PartialMessages }>> = {
  fa: () => import('./locales/fa.ts'),
  ar: () => import('./locales/ar.ts'),
  tr: () => import('./locales/tr.ts'),
  hi: () => import('./locales/hi.ts'),
  ja: () => import('./locales/ja.ts'),
  zh: () => import('./locales/zh.ts'),
  ko: () => import('./locales/ko.ts'),
  fr: () => import('./locales/fr.ts'),
  es: () => import('./locales/es.ts'),
  de: () => import('./locales/de.ts'),
}

export async function loadMessages(locale: Locale): Promise<PartialMessages> {
  if (locale === 'en') return {}
  const loader = loaders[locale]
  if (!loader) return {}
  try {
    return (await loader()).default
  } catch {
    return {}
  }
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** Best supported match for the browser's preferences. */
export function detectLocale(preferences: readonly string[] = navigator.languages ?? ['en']): Locale {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return 'en'
}
