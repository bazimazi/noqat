/** Small, self-contained catalogue for the new rule variants. */
export { gardenOpening } from '../../core/garden.ts'

export const VARIANT_MODES = ['garden', 'misere', 'one-line'] as const
export type VariantMode = (typeof VARIANT_MODES)[number]

const COPY = {
  en: {
    garden: {
      name: 'Persian Garden',
      description: 'Mirrored paths inspired by the chahar bagh. Classic rules, a fresh garden every game.',
      rule: 'Most boxes wins · Close a box, play again',
      icon: '❋',
    },
    misere: {
      name: 'Reverse',
      description: 'Turn your instincts upside down: the fewest boxes wins. A capture still earns another turn.',
      rule: 'Fewest boxes wins · Close a box, play again',
      icon: '⇄',
    },
    'one-line': {
      name: 'One Line',
      description: 'One line, then pass—even after a capture. A tactical duel with no long capture streaks.',
      rule: 'Most boxes wins · Every move passes the turn',
      icon: '↗',
    },
    shuffle: 'New garden',
    opening: 'Paths are already drawn. Neither player owns them.',
    eyebrow: 'A different way to play',
  },
  fa: {
    garden: {
      name: 'باغ ایرانی',
      description: 'مسیرهای متقارن با الهام از چهارباغ؛ قانون‌های همیشگی، باغی تازه در هر بازی.',
      rule: 'خانه‌های بیشتر، پیروزی · با بستن خانه دوباره بازی کن',
      icon: '❋',
    },
    misere: {
      name: 'وارونه',
      description: 'این بار کمتر، بهتر است! کسی که خانه‌های کمتری بگیرد برنده است. بستن خانه همچنان نوبت اضافه دارد.',
      rule: 'خانه‌های کمتر، پیروزی · با بستن خانه دوباره بازی کن',
      icon: '⇄',
    },
    'one-line': {
      name: 'یک خط',
      description: 'یک خط بکش و نوبت را بده؛ حتی اگر خانه‌ای را ببندی. دوئلی فکری، بدون نوبت‌های زنجیره‌ای.',
      rule: 'خانه‌های بیشتر، پیروزی · بعد از هر خط نوبت عوض می‌شود',
      icon: '↗',
    },
    shuffle: 'باغ تازه',
    opening: 'این مسیرها از پیش کشیده شده‌اند و به هیچ بازیکنی تعلق ندارند.',
    eyebrow: 'جور دیگری بازی کن',
  },
} as const

export function variantUiCopy(locale: string) {
  return locale === 'fa' ? COPY.fa : COPY.en
}

export function isVariantMode(mode: string): mode is VariantMode {
  return (VARIANT_MODES as readonly string[]).includes(mode)
}

export function getVariantCopy(mode: VariantMode, locale: string) {
  return variantUiCopy(locale)[mode]
}
