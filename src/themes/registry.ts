/**
 * Theme registry.
 *
 * Themes register themselves here; nothing else in the app knows the list. A
 * community pack only has to call `registerTheme` to become selectable, which
 * is the seam a future marketplace or mod loader would plug into.
 */
import type { ThemeId, ThemePack } from './types.ts'

import { persianTheme } from './packs/persian.ts'
import { japaneseTheme } from './packs/japanese.ts'
import { chineseTheme } from './packs/chinese.ts'
import { indianTheme } from './packs/indian.ts'
import { arabicTheme } from './packs/arabic.ts'
import { turkishTheme } from './packs/turkish.ts'
import { greekTheme } from './packs/greek.ts'
import { nordicTheme } from './packs/nordic.ts'
import { mexicanTheme } from './packs/mexican.ts'
import { africanTheme } from './packs/african.ts'
import { europeanTheme } from './packs/european.ts'
import { neonTheme } from './packs/neon.ts'
import { minimalTheme } from './packs/minimal.ts'

const registry = new Map<string, ThemePack>()

export function registerTheme(pack: ThemePack): void {
  registry.set(pack.id, pack)
}

for (const pack of [
  persianTheme,
  japaneseTheme,
  chineseTheme,
  indianTheme,
  arabicTheme,
  turkishTheme,
  greekTheme,
  nordicTheme,
  mexicanTheme,
  africanTheme,
  europeanTheme,
  neonTheme,
  minimalTheme,
]) {
  registerTheme(pack)
}

export const DEFAULT_THEME: ThemeId = 'persian'

export function getTheme(id: string): ThemePack {
  return registry.get(id) ?? registry.get(DEFAULT_THEME) ?? minimalTheme
}

export function allThemes(): ThemePack[] {
  return Array.from(registry.values())
}

export function themeIds(): string[] {
  return Array.from(registry.keys())
}

/** Themes a given locale is likely to feel at home in, best match first. */
export function themesForLocale(locale: string): ThemePack[] {
  const base = locale.split('-')[0]
  return allThemes().sort((a, b) => {
    const aMatch = a.suggestedLocales?.includes(base) ? 0 : 1
    const bMatch = b.suggestedLocales?.includes(base) ? 0 : 1
    return aMatch - bMatch
  })
}

/**
 * Themes are unlocked by play. The first three are always available so a new
 * player has a real choice; the rest arrive as progression rewards.
 */
export const STARTER_THEMES: readonly ThemeId[] = ['persian', 'minimal', 'japanese']

export const THEME_UNLOCKS: Record<ThemeId, { level: number; hint: string }> = {
  persian: { level: 0, hint: 'available from the start' },
  minimal: { level: 0, hint: 'available from the start' },
  japanese: { level: 0, hint: 'available from the start' },
  turkish: { level: 2, hint: 'reach level 2' },
  arabic: { level: 3, hint: 'reach level 3' },
  indian: { level: 4, hint: 'reach level 4' },
  chinese: { level: 5, hint: 'reach level 5' },
  greek: { level: 6, hint: 'reach level 6' },
  nordic: { level: 8, hint: 'reach level 8' },
  mexican: { level: 10, hint: 'reach level 10' },
  african: { level: 12, hint: 'reach level 12' },
  european: { level: 14, hint: 'reach level 14' },
  neon: { level: 16, hint: 'reach level 16' },
}
