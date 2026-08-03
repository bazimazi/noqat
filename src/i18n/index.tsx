/**
 * The i18n runtime: a translator, a React context and the document-level side
 * effects (direction, language attribute, font stack) that a locale implies.
 *
 * It is deliberately hand-rolled and ~150 lines rather than a library — the app
 * needs exactly four things (interpolation, plurals, lazy catalogues and RTL),
 * and owning them keeps the bundle small and the numeral handling correct.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type MessageKey, type PartialMessages } from './messages.ts'
import { LOCALE_META, detectLocale, isLocale, loadMessages, type Direction, type Locale } from './locales.ts'
import { formatNumber } from './format.ts'

export type TranslateParams = Record<string, string | number>

export interface I18n {
  readonly locale: Locale
  readonly dir: Direction
  readonly meta: (typeof LOCALE_META)[Locale]
  /** Translate a key, interpolating `{placeholders}`. */
  readonly t: (key: MessageKey, params?: TranslateParams) => string
  /** Translate a pluralised key: looks up `key.one`, `key.other`, … */
  readonly tp: (key: string, count: number, params?: TranslateParams) => string
  /** Locale-aware number, using the locale's own digits where appropriate. */
  readonly n: (value: number, options?: Intl.NumberFormatOptions) => string
  readonly setLocale: (locale: Locale) => void
  readonly ready: boolean
}

function interpolate(template: string, params: TranslateParams | undefined, locale: Locale): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined) return match
    return typeof value === 'number' ? formatNumber(locale, value) : value
  })
}

export function createTranslator(locale: Locale, catalogue: PartialMessages) {
  const plurals = new Intl.PluralRules(locale)

  const lookup = (key: string): string | undefined =>
    (catalogue as Record<string, string | undefined>)[key] ??
    (en as Record<string, string | undefined>)[key]

  const t = (key: MessageKey, params?: TranslateParams): string => {
    const template = lookup(key)
    // A missing key must never render as blank space — showing the key itself
    // makes the gap obvious in review instead of invisible in production.
    if (template === undefined) return key
    return interpolate(template, params, locale)
  }

  const tp = (key: string, count: number, params?: TranslateParams): string => {
    const category = plurals.select(count)
    const template = lookup(`${key}.${category}`) ?? lookup(`${key}.other`) ?? key
    return interpolate(template, { n: count, ...params }, locale)
  }

  return { t, tp }
}

const I18nContext = createContext<I18n | null>(null)

const STORAGE_KEY = 'noqat.locale'

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? readStoredLocale() ?? detectLocale(),
  )
  const [catalogue, setCatalogue] = useState<PartialMessages>({})
  const [ready, setReady] = useState(locale === 'en')

  useEffect(() => {
    let cancelled = false
    if (locale === 'en') {
      setCatalogue({})
      setReady(true)
      return
    }
    setReady(false)
    void loadMessages(locale).then((messages) => {
      if (cancelled) return
      setCatalogue(messages)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  const meta = LOCALE_META[locale]

  // Direction, language and script metrics live on <html> so that CSS logical
  // properties, text selection and screen readers all agree.
  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = meta.dir
    root.style.setProperty('--nq-font-locale', meta.fontStack)
    root.style.setProperty('--nq-line-height', String(meta.lineHeight))
    root.style.setProperty('--nq-locale-tracking', meta.tracking)
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* private mode */
    }
  }, [locale, meta])

  const value = useMemo<I18n>(() => {
    const { t, tp } = createTranslator(locale, catalogue)
    return {
      locale,
      dir: meta.dir,
      meta,
      t,
      tp,
      n: (v, options) => formatNumber(locale, v, options),
      setLocale: setLocaleState,
      ready,
    }
  }, [locale, catalogue, meta, ready])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) {
    // Falling back rather than throwing keeps isolated component tests and
    // Storybook stories working without a provider.
    const { t, tp } = createTranslator('en', {})
    return {
      locale: 'en',
      dir: 'ltr',
      meta: LOCALE_META.en,
      t,
      tp,
      n: (v, options) => formatNumber('en', v, options),
      setLocale: () => {},
      ready: true,
    }
  }
  return context
}

/** Convenience hook for components that only need the translate function. */
export function useT(): I18n['t'] {
  return useI18n().t
}

export { LOCALES, LOCALE_META, detectLocale, isLocale } from './locales.ts'
export type { Locale, Direction, LocaleMeta } from './locales.ts'
export type { MessageKey } from './messages.ts'
export * from './format.ts'
