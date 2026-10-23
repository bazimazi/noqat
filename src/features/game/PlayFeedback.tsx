import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '../../i18n/index.tsx'
import { Button } from '../../components/ui.tsx'
import { useSettings } from '../../state/settingsStore.ts'
import { useGame, selectVisiblePosition } from '../../state/gameStore.ts'
import { experienceCopy } from '../experience.ts'
import { boardInsight, captureRun, edgeInsight } from './insights.ts'

export function MoveTimer() {
  const { locale, n } = useI18n()
  const deadline = useGame(s => s.moveDeadline)
  const status = useGame(s => s.status)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (deadline === null || status !== 'playing') return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [deadline, status])
  if (deadline === null || status !== 'playing') return null
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return <span className="nq-move-clock" data-urgent={seconds <= 3} aria-label={experienceCopy(locale).time}>{n(seconds)}s</span>
}

export function Coach({ edge }: { edge: number | null }) {
  const { locale, n } = useI18n()
  const copy = experienceCopy(locale)
  const game = useGame()
  const position = selectVisiblePosition(game)
  const showCoach = useSettings(s => s.showCoach)
  const insight = useMemo(() => boardInsight(position), [position])
  const preview = edge === null ? null : edgeInsight(position, edge)
  if (game.mode === 'online' || game.mode === 'daily') return null
  const message = preview === 'capture' ? copy.hoverCapture : preview === 'risk' ? copy.hoverRisk : preview === 'safe' ? copy.hoverSafe
    : game.rules.misere ? copy.coachReverse : !game.rules.extraTurnOnCapture ? copy.coachOneLine
    : position.ply === 0 ? copy.coachIntro : insight.captures > 0 ? copy.coachCapture : insight.safe > 0 ? copy.coachSafe : copy.coachEnd
  return <section className="nq-coach nq-panel" aria-label={copy.coach}>
    <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold"><span aria-hidden="true">✧ </span>{copy.coach}</h2><Button size="sm" variant="ghost" onClick={() => useSettings.getState().patch({showCoach: !showCoach})} aria-expanded={showCoach}>{showCoach ? copy.coachOff : copy.coachOn}</Button></div>
    {showCoach && <><p className="nq-coach-advice">{message}</p><div className="nq-coach-metrics"><div><strong>{n(insight.safe)}</strong><span>{copy.safe}</span></div><div><strong>{n(insight.captures)}</strong><span>{copy.captures}</span></div></div></>}
  </section>
}

export function CaptureCelebration() {
  const { locale, n } = useI18n()
  const copy = experienceCopy(locale)
  const game = useGame()
  const reducedMotion = useSettings(s => s.a11y.reducedMotion)
  const [show, setShow] = useState(false)
  const move = game.moves[game.cursor - 1]
  const isLive = game.cursor === game.moves.length
  useEffect(() => {
    if (!move?.captured.length || !isLive) { setShow(false); return }
    setShow(true)
    const timer = setTimeout(() => setShow(false), 1800)
    return () => clearTimeout(timer)
  }, [move, isLive])
  const count = captureRun(game.moves.slice(0, game.cursor))
  return <AnimatePresence>{show && move && <motion.div
    key={`${game.id}-${move.ply}`} className="nq-capture-toast" data-testid="capture-celebration"
    initial={reducedMotion ? {opacity:0} : {opacity:0,y:12,scale:.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0}}
    role="status" aria-live="polite">
    <span className="nq-capture-star" aria-hidden="true">✺</span>
    <div><strong>{count >= 3 ? copy.chain : move.captured.length === 2 ? copy.double : copy.bloom}</strong><span>{game.players[move.player]?.name} · +{n(count)} · {game.rules.extraTurnOnCapture ? copy.keepGoing : copy.nextTurn}</span></div>
  </motion.div>}</AnimatePresence>
}
