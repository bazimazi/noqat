import { describe, expect, it } from 'vitest'
import { en, type MessageKey } from '../messages.ts'
import { LOCALES, LOCALE_META, detectLocale, isLocale, loadMessages } from '../locales.ts'
import { createTranslator } from '../index.tsx'
import {
  formatClock,
  formatDuration,
  formatNumber,
  formatPercent,
  formatScore,
  isolate,
} from '../format.ts'

const NON_EN = LOCALES.filter((l) => l !== 'en')

describe('locale metadata', () => {
  it('covers every declared locale', () => {
    expect(LOCALES).toHaveLength(11)
    for (const locale of LOCALES) expect(LOCALE_META[locale].code).toBe(locale)
  })

  it('marks Persian and Arabic as right-to-left', () => {
    expect(LOCALE_META.fa.dir).toBe('rtl')
    expect(LOCALE_META.ar.dir).toBe('rtl')
    expect(LOCALE_META.en.dir).toBe('ltr')
    // Exactly two of the eleven are RTL; a third would need layout review.
    expect(LOCALES.filter((l) => LOCALE_META[l].dir === 'rtl')).toEqual(['fa', 'ar'])
  })

  it('gives every locale a native name and a script-capable font stack', () => {
    for (const locale of LOCALES) {
      const meta = LOCALE_META[locale]
      expect(meta.nativeName.length).toBeGreaterThan(0)
      expect(meta.fontStack).toContain('sans-serif')
      expect(meta.lineHeight).toBeGreaterThan(1.3)
    }
  })

  it('detects the first supported browser preference', () => {
    expect(detectLocale(['pt-BR', 'fa-IR', 'en'])).toBe('fa')
    expect(detectLocale(['xx', 'yy'])).toBe('en')
    expect(detectLocale(['de-AT'])).toBe('de')
  })

  it('validates locale codes', () => {
    expect(isLocale('ja')).toBe(true)
    expect(isLocale('klingon')).toBe(false)
  })
})

describe('catalogues', () => {
  it.each(NON_EN)('%s translates every key in the English catalogue', async (locale) => {
    const messages = await loadMessages(locale)
    const missing = (Object.keys(en) as MessageKey[]).filter((key) => !(key in messages))
    expect(missing).toEqual([])
  })

  it.each(NON_EN)('%s keeps the same placeholders as English', async (locale) => {
    const messages = (await loadMessages(locale)) as Record<string, string>
    const problems: string[] = []
    for (const [key, source] of Object.entries(en)) {
      const translated = messages[key]
      if (!translated) continue
      const expected = new Set(source.match(/\{\w+\}/g) ?? [])
      const actual = new Set(translated.match(/\{\w+\}/g) ?? [])
      // Singular plural forms may express the count lexically instead of with
      // a numeral — Arabic says "مباراة واحدة", not "١ مباراة".
      const lexicalSingularAllowed = /\.(zero|one|two)$/.test(key)
      for (const placeholder of expected) {
        if (!actual.has(placeholder) && !(lexicalSingularAllowed && placeholder === '{n}')) {
          problems.push(`${key}: missing ${placeholder}`)
        }
      }
      for (const placeholder of actual) {
        if (!expected.has(placeholder)) problems.push(`${key}: unexpected ${placeholder}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('never leaves a message empty', async () => {
    for (const locale of NON_EN) {
      const messages = (await loadMessages(locale)) as Record<string, string>
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${locale}/${key}`).not.toBe('')
      }
    }
  })
})

describe('translator', () => {
  it('interpolates parameters', () => {
    const { t } = createTranslator('en', {})
    expect(t('common.player', { n: 2 })).toBe('Player 2')
  })

  it('falls back to English for a missing key', () => {
    const { t } = createTranslator('fr', { 'common.play': 'Jouer' })
    expect(t('common.play')).toBe('Jouer')
    expect(t('common.back')).toBe('Back')
  })

  it('shows the key itself when nothing matches, rather than blank space', () => {
    const { t } = createTranslator('en', {})
    expect(t('not.a.real.key' as MessageKey)).toBe('not.a.real.key')
  })

  it('selects plural forms through Intl.PluralRules', () => {
    const { tp } = createTranslator('en', {})
    expect(tp('boxes.count', 1)).toBe('1 box')
    expect(tp('boxes.count', 5)).toBe('5 boxes')
  })

  it('formats interpolated numbers in the locale digits', () => {
    const { t } = createTranslator('fa', { 'common.player': 'بازیکن {n}' })
    expect(t('common.player', { n: 2 })).toBe('بازیکن ۲')
  })
})

describe('formatting', () => {
  it('uses Eastern Arabic numerals for Persian', () => {
    expect(formatNumber('fa', 1234)).toContain('۱')
    expect(formatNumber('fa', 7)).toBe('۷')
  })

  it('uses Arabic-Indic numerals for Arabic', () => {
    expect(formatNumber('ar', 7)).toBe('٧')
  })

  it('keeps Latin digits for Hindi, Japanese and English', () => {
    expect(formatNumber('hi', 7)).toBe('7')
    expect(formatNumber('ja', 7)).toBe('7')
    expect(formatNumber('en', 7)).toBe('7')
  })

  it('can force Latin digits anywhere', () => {
    expect(formatNumber('fa', 7, { latinDigits: true })).toBe('7')
  })

  it('formats clocks with padded seconds in local digits', () => {
    expect(formatClock('en', 65)).toBe('1:05')
    expect(formatClock('fa', 65)).toBe('۱:۰۵')
    expect(formatClock('en', -5)).toBe('0:00')
  })

  it('picks a sensible duration unit', () => {
    expect(formatDuration('en', 820)).toBe('820 ms')
    expect(formatDuration('en', 2400)).toBe('2.4 s')
    expect(formatDuration('en', 65_000)).toBe('1:05')
  })

  it('formats percentages', () => {
    expect(formatPercent('en', 0.625, 1)).toBe('62.5%')
  })

  it('wraps bidirectional runs in isolate marks', () => {
    // U+2066 FIRST STRONG ISOLATE / U+2069 POP DIRECTIONAL ISOLATE.
    expect(isolate('x')).toBe('⁦x⁩')

    const score = formatScore('fa', 12, 9)
    expect(score.startsWith('⁦')).toBe(true)
    expect(score.endsWith('⁩')).toBe(true)
    expect(score).toContain('۱۲')
    expect(score).toContain('۹')
    expect(score).toContain('–') // en dash, not a hyphen
  })
})
