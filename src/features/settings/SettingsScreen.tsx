/**
 * Settings.
 *
 * Grouped by what the player is trying to achieve rather than by which
 * subsystem owns the flag. Accessibility is a first-class section, not an
 * afterthought at the bottom, and every control takes effect immediately —
 * there is no Apply button and no way to lose a change.
 */
import { useEffect, useState } from 'react'
import { BackIcon, Button, IconButton, Modal, Panel, Segmented, Select, Slider, Toggle } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { LOCALES, LOCALE_META } from '../../i18n/locales.ts'
import { useUi } from '../../state/uiStore.ts'
import { useSettings, systemA11yDefaults } from '../../state/settingsStore.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { clearAllData, estimateUsage } from '../../persistence/db.ts'
import { allThemes } from '../../themes/registry.ts'

export function SettingsScreen() {
  const { t, n, locale, setLocale } = useI18n()
  const go = useUi((s) => s.go)
  const back = useUi((s) => s.back)
  const toast = useUi((s) => s.toast)
  const installAvailable = useUi((s) => s.installPromptAvailable)
  const settings = useSettings()
  const [confirmClear, setConfirmClear] = useState(false)
  const [usage, setUsage] = useState<string | null>(null)

  useEffect(() => {
    void estimateUsage().then((estimate) => {
      if (estimate) setUsage(`${(estimate.usage / 1024 / 1024).toFixed(1)} MB`)
    })
  }, [])

  const previewSound = () => {
    void getAudioEngine().unlock().then(() => getAudioEngine().play('capture'))
  }

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('settings.title')}</h1>
      </header>

      <div className="mx-auto grid max-w-2xl gap-4 pb-10">
        <Panel as="section" aria-labelledby="s-appearance">
          <h2 id="s-appearance" className="mb-2 text-sm font-semibold">
            {t('settings.appearance')}
          </h2>

          <label className="mb-1 block text-sm font-medium" htmlFor="locale-select">
            {t('settings.language')}
          </label>
          <Select
            id="locale-select"
            className="mb-3"
            value={locale}
            onChange={(event) => {
              const next = event.target.value as (typeof LOCALES)[number]
              setLocale(next)
              settings.setLocale(next)
            }}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_META[code].flag} {LOCALE_META[code].nativeName} — {LOCALE_META[code].englishName}
              </option>
            ))}
          </Select>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t('settings.theme')}</span>
            <Button size="sm" onClick={() => go('themes')}>
              {allThemes().find((theme) => theme.id === settings.themeId)?.name ?? t('themes.title')}
            </Button>
          </div>

          <Toggle
            label={t('settings.weather')}
            checked={settings.weather !== 'off'}
            onChange={(value) => settings.setWeather(value ? 'auto' : 'off')}
          />
          <Toggle
            label={t('themes.preview')}
            description={t('settings.appearance')}
            checked={settings.particles}
            onChange={(particles) => settings.patch({ particles })}
          />
        </Panel>

        <Panel as="section" aria-labelledby="s-audio">
          <h2 id="s-audio" className="mb-2 text-sm font-semibold">
            {t('settings.audio')}
          </h2>
          <Toggle
            label={t('settings.mute')}
            checked={settings.audio.muted}
            onChange={(muted) => settings.setAudio({ muted })}
          />
          <Slider
            label={t('settings.master')}
            min={0}
            max={1}
            step={0.05}
            value={settings.audio.master}
            valueLabel={n(Math.round(settings.audio.master * 100))}
            onChange={(master) => settings.setAudio({ master })}
          />
          <Slider
            label={t('settings.music')}
            min={0}
            max={1}
            step={0.05}
            value={settings.audio.music}
            valueLabel={n(Math.round(settings.audio.music * 100))}
            onChange={(music) => settings.setAudio({ music })}
          />
          <Slider
            label={t('settings.effects')}
            min={0}
            max={1}
            step={0.05}
            value={settings.audio.effects}
            valueLabel={n(Math.round(settings.audio.effects * 100))}
            onChange={(effects) => {
              settings.setAudio({ effects })
              previewSound()
            }}
          />
          <Toggle
            label={t('mode.classic')}
            description={t('settings.music')}
            checked={settings.musicEnabled}
            onChange={(musicEnabled) => settings.patch({ musicEnabled })}
          />
        </Panel>

        <Panel as="section" aria-labelledby="s-a11y">
          <h2 id="s-a11y" className="mb-2 text-sm font-semibold">
            {t('settings.accessibility')}
          </h2>
          <Toggle
            label={t('settings.highContrast')}
            checked={settings.a11y.highContrast}
            onChange={(highContrast) => settings.setA11y({ highContrast })}
          />
          <Toggle
            label={t('settings.reducedMotion')}
            checked={settings.a11y.reducedMotion}
            onChange={(reducedMotion) => settings.setA11y({ reducedMotion })}
          />
          <Toggle
            label={t('settings.largeUi')}
            checked={settings.a11y.uiScale > 1}
            onChange={(large) => settings.setA11y({ uiScale: large ? 1.25 : 1 })}
          />
          <Toggle
            label={t('settings.haptics')}
            checked={settings.haptics}
            onChange={(haptics) => settings.patch({ haptics })}
          />
          <Toggle
            label={t('settings.confirmMoves')}
            checked={settings.confirmMoves}
            onChange={(confirmMoves) => settings.patch({ confirmMoves })}
          />
          <Toggle
            label={t('game.chainWarning')}
            checked={settings.showChainWarnings}
            onChange={(showChainWarnings) => settings.patch({ showChainWarnings })}
          />
          <Toggle
            label={t('settings.keyboardHints')}
            description={t('a11y.keyboardHelp')}
            checked={settings.showKeyboardHints}
            onChange={(showKeyboardHints) => settings.patch({ showKeyboardHints })}
          />

          <div className="mt-3">
            <span className="mb-1.5 block text-sm font-medium">{t('settings.colorblind')}</span>
            <Segmented
              label={t('settings.colorblind')}
              value={settings.a11y.colorblind}
              onChange={(colorblind) => settings.setA11y({ colorblind })}
              options={[
                { value: 'off', label: t('settings.colorblindOff') },
                { value: 'deuteranopia', label: 'Deuter.' },
                { value: 'protanopia', label: 'Protan.' },
                { value: 'tritanopia', label: 'Tritan.' },
              ]}
            />
          </div>

          <Slider
            label={t('settings.animationSpeed')}
            min={0.25}
            max={2}
            step={0.25}
            value={settings.a11y.animationSpeed}
            valueLabel={`${n(settings.a11y.animationSpeed)}×`}
            onChange={(animationSpeed) => settings.setA11y({ animationSpeed })}
          />

          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              settings.setA11y(systemA11yDefaults())
              toast(t('common.done'), 'success')
            }}
          >
            {t('common.confirm')} — {t('settings.accessibility')}
          </Button>
        </Panel>

        <Panel as="section" aria-labelledby="s-data">
          <h2 id="s-data" className="mb-2 text-sm font-semibold">
            {t('settings.data')}
          </h2>
          {usage && (
            <p className="mb-2 text-xs" style={{ color: 'var(--nq-text-muted)' }}>
              {usage}
            </p>
          )}
          {installAvailable && (
            <Button
              size="sm"
              block
              className="mb-2"
              onClick={() => window.dispatchEvent(new CustomEvent('noqat:install'))}
            >
              {t('settings.install')}
            </Button>
          )}
          <Button size="sm" variant="danger" block onClick={() => setConfirmClear(true)}>
            {t('settings.clearData')}
          </Button>
        </Panel>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('settings.clearData')}
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData()
                settings.reset()
                setConfirmClear(false)
                toast(t('common.done'), 'success')
                go('menu')
              }}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        {t('settings.clearDataConfirm')}
      </Modal>
    </div>
  )
}
