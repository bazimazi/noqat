/**
 * The result screen.
 *
 * It does three jobs in order of importance: say who won in one glance, pay out
 * progression, and offer the one action most people want next (rematch). The
 * theme's victory palette drives the confetti burst, so winning a Persian game
 * and winning a Nordic one do not feel the same.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button, Panel, Stat } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { formatScore } from '../../i18n/format.ts'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { selectLivePosition, selectOutcome, useGame } from '../../state/gameStore.ts'
import { useProfile, xpForGame } from '../../state/profileStore.ts'
import { getTheme } from '../../themes/registry.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { putReplay, recordGame } from '../../persistence/repositories.ts'
import { DIFFICULTY_PROFILES } from '../../ai/types.ts'
import { encodeShareCode } from '../../core/serialization.ts'

export interface ResultScreenProps {
  readonly onBurst: (burst: { at: number; colors: readonly string[]; kind: string }) => void
}

export function ResultScreen({ onBurst }: ResultScreenProps) {
  const { t, n, locale } = useI18n()
  const go = useUi((s) => s.go)
  const toast = useUi((s) => s.toast)
  const themeId = useSettings((s) => s.themeId)
  const theme = useMemo(() => getTheme(themeId), [themeId])
  const game = useGame()
  const profile = useProfile()
  const position = selectLivePosition(game)
  const result = selectOutcome(game)
  const [xpAwarded, setXpAwarded] = useState<number | null>(null)
  const settling = useRef(false)

  const localSeat = game.players.findIndex((p) => p.kind === 'human')
  const seat = localSeat >= 0 ? localSeat : 0
  const won = result.kind === 'win' && (result.winners as readonly number[]).includes(seat)
  const drawn = result.kind === 'draw'
  const opponent = game.players.find((_, i) => i !== seat)
  const opponentElo = opponent?.difficulty ? DIFFICULTY_PROFILES[opponent.difficulty].elo : 1000
  const totalBoxes = position.boxes.length
  // Pass-and-play has no "you": both seats are at the same table, so the screen
  // names the winner instead of telling one of them they lost.
  const shared = game.players.length > 1 && game.players.every((p) => p.kind === 'human')
  const winnerName =
    result.kind === 'win' ? (game.players[result.winners[0]]?.name ?? '') : ''

  // Settle once per game: pay XP, record statistics, store the replay, fire the
  // burst. The guard lives in the store, not in a ref, because this screen is
  // remounted every time the player comes back from watching the replay.
  useEffect(() => {
    if (settling.current || game.resultRecorded || game.status !== 'finished') return
    settling.current = true
    useGame.getState().markResultRecorded()

    const engine = getAudioEngine()
    engine.play(won ? 'victory' : drawn ? 'draw' : 'defeat')

    if (won || drawn) {
      onBurst({ at: Date.now(), colors: theme.victory.colors, kind: theme.victory.kind })
    }

    const perfect = won && (position.scores[1 - seat] ?? 0) === 0
    const amount = xpForGame({
      won,
      drawn,
      boxes: position.scores[seat] ?? 0,
      totalBoxes,
      opponentElo,
      perfect,
    })
    setXpAwarded(amount)

    void (async () => {
      const outcomeValue = won ? 1 : drawn ? 0 : -1
      const stats = await recordGame({
        size: game.size,
        themeId,
        mode: game.mode,
        ...(opponent?.difficulty ? { difficulty: opponent.difficulty } : {}),
        result: outcomeValue as 1 | 0 | -1,
        boxesWon: position.scores[seat] ?? 0,
        boxesLost: position.scores[1 - seat] ?? 0,
        moves: game.moves.length,
        thinkMs: game.moves.reduce((sum, move) => sum + (move.thinkMs ?? 0), 0),
        playedEdges: game.moves.filter((m) => m.player === seat).map((m) => m.edge),
        at: Date.now(),
      })

      await putReplay({
        id: game.id || `r_${Date.now()}`,
        createdAt: Date.now(),
        game: game.serialize(),
        players: game.players.map((p) => ({
          kind: p.kind,
          name: p.name,
          ...(p.difficulty ? { difficulty: p.difficulty } : {}),
        })),
        finalScores: Array.from(position.scores),
        winner: result.kind === 'win' ? result.winners[0] : null,
        mode: game.mode,
        themeId,
        durationMs: (game.finishedAt ?? Date.now()) - game.startedAt,
      })

      // Mode payouts. Without these the campaign never unlocks past level one
      // and the daily streak can never start.
      const { campaignLevelId, dailyDate, par } = game.context
      if (campaignLevelId && (won || drawn)) {
        const mine = position.scores[seat] ?? 0
        const theirs = position.scores[1 - seat] ?? 0
        const stars = mine === totalBoxes ? 3 : mine - theirs >= Math.max(2, totalBoxes * 0.25) ? 2 : 1
        await profile.recordCampaign(campaignLevelId, stars, mine)
      }
      if (dailyDate) {
        await profile.recordDaily(dailyDate, position.scores[seat] ?? 0, par ?? 0, won)
      }
      if (opponent?.kind === 'ai') {
        await profile.updateElo(opponentElo, won ? 1 : drawn ? 0.5 : 0)
      }

      const { leveledTo, unlocked } = await profile.addXp(amount)
      // Counters are cumulative totals, not increments — the achievement takes
      // the highest value it has seen.
      await profile.bumpAchievement('games', stats.gamesPlayed)
      if (won) await profile.bumpAchievement('wins', stats.wins)
      await profile.bumpAchievement('streak', stats.longestStreak)
      if (perfect) await profile.bumpAchievement('perfect', 1)
      if (won && opponent?.difficulty === 'grandmaster') await profile.bumpAchievement('grandmaster', 1)
      if (leveledTo) toast(t('result.newLevel', { n: leveledTo }), 'success')
      for (const id of unlocked) {
        toast(t('result.unlocked', { name: getTheme(id).name }), 'success')
        getAudioEngine().play('unlock')
      }
    })()
  }, [
    game,
    won,
    drawn,
    position,
    seat,
    totalBoxes,
    opponentElo,
    themeId,
    theme,
    opponent,
    profile,
    result,
    toast,
    t,
    onBurst,
  ])

  const share = async () => {
    const code = encodeShareCode(game.serialize())
    const url = `${location.origin}${location.pathname}?replay=${code}`
    try {
      if (navigator.share) await navigator.share({ title: t('app.title'), url })
      else {
        await navigator.clipboard.writeText(url)
        toast(t('common.copied'), 'success')
      }
    } catch {
      /* the user dismissed the sheet */
    }
  }

  const rematch = () => {
    useGame.getState().start({
      size: game.size,
      players: game.players,
      mode: game.mode,
      themeId,
      rules: game.rules,
      context: game.context,
    })
    go('game')
  }

  const headline = drawn
    ? t('result.draw')
    : shared && winnerName
      ? t('result.winner', { name: winnerName })
      : won
        ? t('result.victory')
        : t('result.defeat')

  return (
    <div className="nq-scroll grid h-full place-items-center p-6">
      <div className="w-full max-w-md">
        <motion.h1
          className="nq-display mb-1 text-center text-4xl"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{ color: won ? 'var(--nq-accent)' : 'var(--nq-text)' }}
        >
          {headline}
        </motion.h1>

        <motion.p
          className="nq-numeric mb-5 text-center text-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {formatScore(locale, position.scores[0] ?? 0, position.scores[1] ?? 0)}
        </motion.p>

        {won && (position.scores[1 - seat] ?? 0) === 0 && (
          <p className="mb-4 text-center text-sm" style={{ color: 'var(--nq-accent)' }}>
            {t('result.perfect')}
          </p>
        )}

        <Panel className="mb-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('game.moves')} value={n(game.moves.length)} />
            <Stat
              label={t('stats.avgMoveTime')}
              value={
                game.moves.length
                  ? `${n(
                      Math.round(
                        game.moves.reduce((sum, m) => sum + (m.thinkMs ?? 0), 0) / game.moves.length / 100,
                      ) / 10,
                    )}s`
                  : '—'
              }
            />
            <Stat
              label={t('profile.xp')}
              value={
                xpAwarded !== null
                  ? t('result.xpEarned', { n: xpAwarded })
                  : // Already settled on an earlier visit — coming back from the
                    // replay must not look like the payout is still pending.
                    game.resultRecorded
                    ? '—'
                    : '…'
              }
            />
          </div>
        </Panel>

        <div className="grid gap-2">
          <Button variant="primary" size="lg" block onClick={rematch}>
            {t('result.rematch')}
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button block onClick={() => go('setup')}>
              {t('result.newGame')}
            </Button>
            <Button
              block
              onClick={() => {
                useGame.getState().watchReplay()
                go('game')
              }}
            >
              {t('result.viewReplay')}
            </Button>
            <Button block onClick={share}>
              {t('result.share')}
            </Button>
          </div>
          <Button block variant="ghost" onClick={() => go('menu')}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    </div>
  )
}
