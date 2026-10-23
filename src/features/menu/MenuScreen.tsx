import { useEffect, useState } from 'react'
import { Button } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useProfile, levelFromXp, countDailyStreak } from '../../state/profileStore.ts'
import { AUTOSAVE_ID, getSave } from '../../persistence/repositories.ts'
import type { SavedGame } from '../../persistence/db.ts'
import { GAME_MODES, useGame, type GameMode } from '../../state/gameStore.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { dailyChallenge } from '../modes/library.ts'
import { experienceCopy } from '../experience.ts'
import { GardenArt } from './GardenArt.tsx'

export function MenuScreen() {
  const { t, n, locale } = useI18n()
  const copy = experienceCopy(locale)
  const go = useUi((s) => s.go)
  const configureSetup = useUi((s) => s.configureSetup)
  const online = useUi((s) => s.online)
  const themeId = useSettings((s) => s.themeId)
  const playerName = useSettings((s) => s.playerName)
  const xp = useProfile((s) => s.xp)
  const dailyResults = useProfile((s) => s.dailyResults)
  const [resumable, setResumable] = useState<SavedGame | null>(null)
  useEffect(() => { void getSave(AUTOSAVE_ID).then(save => setResumable(save && !save.finished && save.game.moves.length > 0 ? save : null)) }, [])

  const { level, into, needed } = levelFromXp(xp)
  const daily = dailyChallenge()
  const dailyResult = dailyResults[daily.isoDate]
  const streak = countDailyStreak(dailyResults)
  const enterWithSound = (action: () => void) => () => {
    void getAudioEngine().unlock()
    getAudioEngine().play('select')
    action()
  }
  const resume = enterWithSound(() => {
    if (!resumable) return
    useGame.getState().start({
      size: { rows: resumable.game.rows, cols: resumable.game.cols },
      players: resumable.players.map(p => ({ kind: p.kind as 'human' | 'ai', name: p.name, ...(p.difficulty ? { difficulty: p.difficulty } : {}) })),
      mode: GAME_MODES.includes(resumable.mode as GameMode) ? resumable.mode as GameMode : 'classic',
      resume: resumable.game, themeId, context: resumable.context, resultRecorded: resumable.resultRecorded,
      clocks: resumable.clocks, startedAt: resumable.createdAt,
    })
    go('game')
  })
  const startDaily = enterWithSound(() => {
    useGame.getState().start({
      size: daily.size, mode: 'daily', themeId, seed: daily.seed,
      players: [{ kind: 'human', name: playerName || t('common.you') }, { kind: 'ai', name: t(`difficulty.${daily.difficulty}` as 'difficulty.medium'), difficulty: daily.difficulty }],
      rules: { preplacedEdges: daily.preplacedEdges }, context: { dailyDate: daily.isoDate, par: daily.par },
    })
    go('game')
  })

  return <div className="nq-scroll nq-home h-full"><div className="nq-home-inner">
    <header className="nq-home-header">
      <span className="nq-wordmark"><span aria-hidden="true">⁙</span> {t('app.title')}</span>
      <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={enterWithSound(() => go('howto'))}>{t('menu.howToPlay')}</Button><Button size="sm" onClick={enterWithSound(() => go('settings'))}>{t('common.settings')}</Button></div>
    </header>
    <section className="nq-home-hero">
      <div className="nq-home-intro">
        <p className="nq-eyebrow">{copy.eyebrow}</p>
        <h1 className="nq-display nq-home-title">{t('app.title')}<span aria-hidden="true">.</span></h1>
        <h2 className="nq-display nq-home-invitation">{copy.invitation}</h2>
        <p className="nq-home-description">{copy.intro}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {resumable ? <Button variant="primary" size="lg" onClick={resume}>{t('menu.continueGame')} <span aria-hidden="true">↗</span></Button> : <Button variant="primary" size="lg" onClick={enterWithSound(() => configureSetup({}))}>{t('menu.quickPlay')} <span aria-hidden="true">↗</span></Button>}
          <Button size="lg" onClick={enterWithSound(() => configureSetup({ opponent: 'human' }))}>{t('menu.passAndPlay')}</Button>
        </div>
        <p className="nq-home-craft"><span aria-hidden="true">✧</span> {copy.craft}</p>
      </div>
      <div className="nq-home-art"><GardenArt/><span className="nq-art-caption" lang="fa" dir="rtl">هر نقطه، یک آغاز</span></div>
    </section>
    <nav aria-label={copy.explore} className="nq-discovery">
      <div className="nq-section-heading"><h2>{copy.explore}</h2><span aria-hidden="true">✦ ─── ✦</span></div>
      <div className="nq-feature-grid">
        <button className="nq-feature-card nq-daily-card" onClick={startDaily}>
          <div className="flex items-center justify-between gap-2"><span className="nq-eyebrow">{copy.daily}</span><span className="nq-card-icon" aria-hidden="true">☀</span></div>
          <h3 className="nq-display">{t('menu.daily')}</h3><p>{copy.dailyDesc}</p>
          <div className="nq-card-footer"><span>{dailyResult ? `✓ ${copy.completed} · ${copy.best} ${n(dailyResult.score)}` : `${n(daily.size.rows)}×${n(daily.size.cols)} · ${t(`difficulty.${daily.difficulty}` as 'difficulty.medium')}`}</span><span aria-hidden="true">↗</span></div>
        </button>
        <button className="nq-feature-card nq-garden-card" onClick={enterWithSound(() => configureSetup({ mode: 'garden' }))}>
          <div className="flex items-center justify-between gap-2"><span className="nq-eyebrow" lang="fa">چهارباغ</span><span className="nq-card-icon" aria-hidden="true">❋</span></div>
          <h3 className="nq-display">{copy.garden}</h3><p>{copy.gardenDesc}</p><div className="nq-card-footer"><span>{copy.play}</span><span aria-hidden="true">↗</span></div>
        </button>
        <div className="nq-twist-stack">
          <button className="nq-twist-card" onClick={enterWithSound(() => configureSetup({ mode: 'misere' }))}><span aria-hidden="true">↶</span><div><h3>{copy.reverse}</h3><p>{copy.reverseDesc}</p></div><span aria-hidden="true">↗</span></button>
          <button className="nq-twist-card" onClick={enterWithSound(() => configureSetup({ mode: 'one-line' }))}><span aria-hidden="true">⌁</span><div><h3>{copy.oneLine}</h3><p>{copy.oneLineDesc}</p></div><span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <div className="nq-paths-grid">{([
        ['◈', t('menu.vsAi'), copy.aiDesc, () => configureSetup({ opponent: 'ai' }), false],
        ['◎', t('menu.online'), copy.onlineDesc, () => go('online'), !online],
        ['⌘', t('menu.puzzles'), copy.puzzleDesc, () => go('puzzles'), false],
        ['♜', t('menu.campaign'), copy.campaignDesc, () => go('campaign'), false],
        ['✧', t('menu.trainer'), copy.trainerDesc, () => go('trainer'), false],
      ] as const).map(([icon,label,desc,action,disabled]) => <button key={label} className="nq-path-card" onClick={enterWithSound(action)} disabled={disabled} title={disabled ? t('online.offline') : undefined}><span aria-hidden="true">{icon}</span><div><h3>{label}</h3><p>{desc}</p></div></button>)}</div>
    </nav>
    <footer className="nq-home-footer">
      <div className="nq-level-track"><span>{t('common.level', {n:level})}</span><div role="progressbar" aria-label={t('common.level', {n:level})} aria-valuenow={into} aria-valuemin={0} aria-valuemax={needed}><i style={{width:`${into/needed*100}%`}}/></div><span>{n(into)}/{n(needed)}</span></div>
      {streak > 0 && <span className="nq-streak">✦ {n(streak)} {copy.streak}</span>}
      <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={enterWithSound(() => go('themes'))}>{t('menu.themes')}</Button><Button size="sm" variant="ghost" onClick={enterWithSound(() => go('stats'))}>{t('menu.stats')}</Button></div>
    </footer>
  </div></div>
}
