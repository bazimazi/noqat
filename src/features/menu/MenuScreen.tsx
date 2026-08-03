/**
 * The main menu.
 *
 * A single primary action ("continue" if there is a game to continue, otherwise
 * "quick play") and everything else at one level below it. The logo is drawn
 * from the board itself — four dots and three lines completing a box — which is
 * both the game's rules and its mark.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useProfile, levelFromXp } from '../../state/profileStore.ts'
import { AUTOSAVE_ID, getSave } from '../../persistence/repositories.ts'
import type { SavedGame } from '../../persistence/db.ts'
import { useGame } from '../../state/gameStore.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { dailyChallenge } from '../modes/library.ts'

export function MenuScreen() {
  const { t, n, locale } = useI18n()
  const go = useUi((s) => s.go)
  const online = useUi((s) => s.online)
  const themeId = useSettings((s) => s.themeId)
  const xp = useProfile((s) => s.xp)
  const [resumable, setResumable] = useState<SavedGame | null>(null)

  useEffect(() => {
    void getSave(AUTOSAVE_ID).then((save) => {
      setResumable(save && !save.finished && save.game.moves.length > 0 ? save : null)
    })
  }, [])

  const { level, into, needed } = levelFromXp(xp)
  const daily = dailyChallenge()

  const enterWithSound = (action: () => void) => () => {
    void getAudioEngine().unlock()
    getAudioEngine().play('select')
    action()
  }

  const resume = enterWithSound(() => {
    if (!resumable) return
    useGame.getState().start({
      size: { rows: resumable.game.rows, cols: resumable.game.cols },
      players: resumable.players.map((p) => ({
        kind: p.kind as 'human' | 'ai',
        name: p.name,
        ...(p.difficulty ? { difficulty: p.difficulty } : {}),
      })),
      mode: resumable.mode as 'classic',
      resume: resumable.game,
      themeId,
    })
    go('game')
  })

  return (
    <div className="nq-scroll flex h-full flex-col items-center justify-center gap-6 p-6">
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Logo />
        <h1 className="nq-display text-4xl sm:text-5xl">{t('app.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--nq-text-muted)' }}>
          {t('app.tagline')}
        </p>
      </motion.div>

      <motion.nav
        className="grid w-full max-w-sm gap-2.5"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        aria-label={t('app.title')}
      >
        {resumable ? (
          <Button variant="primary" size="lg" block onClick={resume}>
            {t('menu.continueGame')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={enterWithSound(() => go('setup'))}>
            {t('menu.quickPlay')}
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Button block onClick={enterWithSound(() => go('setup'))}>
            {t('menu.vsAi')}
          </Button>
          <Button block onClick={enterWithSound(() => go('setup'))}>
            {t('menu.passAndPlay')}
          </Button>
          <Button block onClick={enterWithSound(() => go('online'))} disabled={!online} title={online ? undefined : t('online.offline')}>
            {t('menu.online')}
          </Button>
          <Button block onClick={enterWithSound(() => go('puzzles'))}>
            {t('menu.puzzles')}
          </Button>
          <Button block onClick={enterWithSound(() => go('campaign'))}>
            {t('menu.campaign')}
          </Button>
          <Button block onClick={enterWithSound(() => go('trainer'))}>
            {t('menu.trainer')}
          </Button>
        </div>

        <Button block onClick={enterWithSound(() => go('setup'))} className="justify-between">
          <span>{t('menu.daily')}</span>
          <span className="nq-numeric text-xs" style={{ color: 'var(--nq-text-muted)' }}>
            {n(daily.size.rows)}×{n(daily.size.cols)} · {t(`difficulty.${daily.difficulty}` as 'difficulty.medium')}
          </span>
        </Button>

        <div className="grid grid-cols-3 gap-2.5">
          <Button block size="sm" onClick={enterWithSound(() => go('themes'))}>
            {t('menu.themes')}
          </Button>
          <Button block size="sm" onClick={enterWithSound(() => go('stats'))}>
            {t('menu.stats')}
          </Button>
          <Button block size="sm" onClick={enterWithSound(() => go('settings'))}>
            {t('common.settings')}
          </Button>
        </div>

        <Button block size="sm" variant="ghost" onClick={enterWithSound(() => go('howto'))}>
          {t('menu.howToPlay')}
        </Button>
      </motion.nav>

      <motion.div
        className="flex w-full max-w-sm items-center gap-3 text-xs"
        style={{ color: 'var(--nq-text-muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <span className="nq-numeric">{t('common.level', { n: level })}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--nq-surface-alt)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${(into / needed) * 100}%`, background: 'var(--nq-accent)' }}
          />
        </div>
        <span className="nq-numeric">
          {n(into)}/{n(needed)}
        </span>
        <span aria-hidden="true">·</span>
        <span>{locale.toUpperCase()}</span>
      </motion.div>
    </div>
  )
}

/** The mark: four dots, three sides drawn, one waiting. */
function Logo() {
  return (
    <svg viewBox="-14 -14 88 88" width="72" height="72" aria-hidden="true">
      <motion.line
        x1="0" y1="0" x2="60" y2="0"
        stroke="var(--nq-p0-line)" strokeWidth="7" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
      />
      <motion.line
        x1="60" y1="0" x2="60" y2="60"
        stroke="var(--nq-p1-line)" strokeWidth="7" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.28 }}
      />
      <motion.line
        x1="60" y1="60" x2="0" y2="60"
        stroke="var(--nq-p0-line)" strokeWidth="7" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.46 }}
      />
      <line x1="0" y1="60" x2="0" y2="0" stroke="var(--nq-line-idle)" strokeWidth="7" strokeLinecap="round" strokeDasharray="4 9" />
      {[
        [0, 0],
        [60, 0],
        [0, 60],
        [60, 60],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="var(--nq-dot)" />
      ))}
    </svg>
  )
}
