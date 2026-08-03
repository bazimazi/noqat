import { describe, expect, it } from 'vitest'
import { allThemes, getTheme, STARTER_THEMES, THEME_UNLOCKS, themesForLocale } from '../registry.ts'
import { DEFAULT_A11Y, resolvedPlayerPalette, themeToCssVars } from '../tokens.ts'

const HEX_OR_FUNC = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/

/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('theme registry', () => {
  it('registers every culture pack', () => {
    expect(allThemes()).toHaveLength(13)
  })

  it('falls back to a real theme for unknown ids', () => {
    expect(getTheme('does-not-exist').id).toBeTruthy()
  })

  it('gives every theme a unique id and a native name', () => {
    const ids = allThemes().map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const theme of allThemes()) {
      expect(theme.nativeName.length).toBeGreaterThan(0)
      expect(theme.inspiration.length).toBeGreaterThan(0)
    }
  })

  it('sorts locale-appropriate themes first', () => {
    expect(themesForLocale('fa')[0].id).toBe('persian')
    expect(themesForLocale('ja')[0].id).toBe('japanese')
    expect(themesForLocale('tr')[0].id).toBe('turkish')
  })

  it('unlocks the starter themes at level zero and nothing else', () => {
    for (const id of STARTER_THEMES) expect(THEME_UNLOCKS[id].level).toBe(0)
    const zeroLevel = Object.entries(THEME_UNLOCKS).filter(([, v]) => v.level === 0)
    expect(zeroLevel).toHaveLength(STARTER_THEMES.length)
  })
})

describe('theme palettes', () => {
  it.each(allThemes().map((t) => [t.id, t] as const))('%s uses valid colours', (_id, theme) => {
    const values = [
      theme.colors.bg,
      theme.colors.text,
      theme.colors.accent,
      ...theme.colors.players.flatMap((p) => [p.line, p.fill, p.glow, p.onFill]),
    ]
    for (const value of values) expect(value).toMatch(HEX_OR_FUNC)
  })

  it.each(allThemes().map((t) => [t.id, t] as const))(
    '%s keeps body text readable against the background (WCAG AA)',
    (_id, theme) => {
      expect(contrast(theme.colors.text, theme.colors.bg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(allThemes().map((t) => [t.id, t] as const))(
    '%s keeps captured-box labels readable on their own fill',
    (_id, theme) => {
      for (const player of theme.colors.players) {
        expect(contrast(player.onFill, player.fill)).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it.each(allThemes().map((t) => [t.id, t] as const))(
    '%s gives the four players visibly different line colours',
    (_id, theme) => {
      const lines = theme.colors.players.map((p) => p.line)
      expect(new Set(lines).size).toBe(4)
    },
  )
})

describe('theme audio', () => {
  it.each(allThemes().map((t) => [t.id, t] as const))('%s declares a playable scale', (_id, theme) => {
    expect(theme.audio.scale.length).toBeGreaterThanOrEqual(4)
    expect(theme.audio.scale[0]).toBe(0)
    for (const cents of theme.audio.scale) {
      expect(cents).toBeGreaterThanOrEqual(0)
      expect(cents).toBeLessThan(1200)
    }
    // Ascending order keeps the melody generator honest.
    expect([...theme.audio.scale]).toEqual([...theme.audio.scale].sort((a, b) => a - b))
    expect(theme.audio.root).toBeGreaterThan(50)
    expect(theme.audio.tempo).toBeGreaterThan(30)
  })

  it('includes quarter-tone scales for the maqam-based themes', () => {
    // A tuning that is not a multiple of 100 cents can only come from a
    // microtonal system — proof the scales are not just recoloured majors.
    const persian = getTheme('persian').audio.scale
    expect(persian.some((c) => c % 100 !== 0)).toBe(true)
    const turkish = getTheme('turkish').audio.scale
    expect(turkish.some((c) => c % 100 !== 0)).toBe(true)
  })
})

describe('css variable bridge', () => {
  it('emits a complete variable set', () => {
    const vars = themeToCssVars(getTheme('persian'))
    expect(vars['--nq-bg']).toBeTruthy()
    expect(vars['--nq-p0-line']).toBeTruthy()
    expect(vars['--nq-p3-on-fill']).toBeTruthy()
    expect(vars['--nq-dur']).toMatch(/ms$/)
  })

  it('collapses durations under reduced motion', () => {
    const vars = themeToCssVars(getTheme('neon'), { ...DEFAULT_A11Y, reducedMotion: true })
    expect(parseInt(vars['--nq-dur'], 10)).toBe(0)
  })

  it('forces maximum contrast in high-contrast mode', () => {
    const vars = themeToCssVars(getTheme('persian'), { ...DEFAULT_A11Y, highContrast: true })
    expect(contrast(vars['--nq-text'], vars['--nq-bg'])).toBeGreaterThan(15)
    expect(vars['--nq-glass']).toBe('none')
  })

  it('substitutes a colour-blind-safe palette', () => {
    const theme = getTheme('persian')
    const normal = resolvedPlayerPalette(theme, 0)
    const deutan = resolvedPlayerPalette(theme, 0, { ...DEFAULT_A11Y, colorblind: 'deuteranopia' })
    expect(deutan.line).not.toBe(normal.line)
    const vars = themeToCssVars(theme, { ...DEFAULT_A11Y, colorblind: 'deuteranopia' })
    expect(vars['--nq-p0-line']).toBe(deutan.line)
  })

  it('scales type with the large-UI setting', () => {
    const base = themeToCssVars(getTheme('minimal'))
    const large = themeToCssVars(getTheme('minimal'), { ...DEFAULT_A11Y, uiScale: 1.3 })
    expect(Number(large['--nq-type-scale'])).toBeCloseTo(Number(base['--nq-type-scale']) * 1.3, 5)
  })
})
