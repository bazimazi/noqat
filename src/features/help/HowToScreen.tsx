/**
 * How to play.
 *
 * Three rules and one piece of real strategy, each illustrated by a tiny
 * animated board rather than a paragraph. The strategy note matters: most
 * people play Dots & Boxes for years without discovering that the endgame is
 * about *giving boxes away*, and that discovery is what makes the game deep.
 */
import { motion } from 'framer-motion'
import { BackIcon, IconButton, Panel } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'

export function HowToScreen() {
  const { t } = useI18n()
  const back = useUi((s) => s.back)

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('howto.title')}</h1>
      </header>

      <div className="mx-auto grid max-w-2xl gap-3 pb-10">
        <Rule text={t('howto.rule1')} diagram={<DrawLineDiagram />} />
        <Rule text={t('howto.rule2')} diagram={<CaptureDiagram />} />
        <Rule text={t('howto.rule3')} diagram={<FullBoardDiagram />} />

        <Panel className="mt-2" style={{ borderColor: 'var(--nq-accent)' }}>
          <h2 className="nq-display mb-1 text-base" style={{ color: 'var(--nq-accent)' }}>
            {t('game.chainWarning')}
          </h2>
          <p className="text-sm">{t('howto.tip')}</p>
          <ChainDiagram />
        </Panel>

        <Panel>
          <h2 className="mb-1 text-sm font-semibold">{t('a11y.keyboardHelp')}</h2>
        </Panel>
      </div>
    </div>
  )
}

function Rule({ text, diagram }: { text: string; diagram: React.ReactNode }) {
  return (
    <Panel className="flex items-center gap-4">
      <div className="shrink-0">{diagram}</div>
      <p className="text-sm">{text}</p>
    </Panel>
  )
}

const dotPositions = (rows: number, cols: number) => {
  const out: { x: number; y: number }[] = []
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) out.push({ x: c, y: r })
  return out
}

function Frame({ children, rows = 1, cols = 1 }: { children: React.ReactNode; rows?: number; cols?: number }) {
  return (
    <svg viewBox={`-0.35 -0.35 ${cols + 0.7} ${rows + 0.7}`} width="76" height="76" aria-hidden="true">
      {children}
      {dotPositions(rows, cols).map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={0.09} fill="var(--nq-dot)" />
      ))}
    </svg>
  )
}

function DrawLineDiagram() {
  return (
    <Frame>
      <motion.line
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stroke="var(--nq-p0-line)"
        strokeWidth={0.11}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.35, 0.8, 1] }}
      />
    </Frame>
  )
}

function CaptureDiagram() {
  return (
    <Frame>
      <motion.rect
        x={0.06}
        y={0.06}
        width={0.88}
        height={0.88}
        rx={0.1}
        fill="var(--nq-p0-fill)"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1, 1, 0.4] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.4, 0.55, 0.85, 1] }}
        style={{ transformOrigin: '0.5px 0.5px' }}
      />
      {[
        [0, 0, 1, 0],
        [0, 1, 1, 1],
        [0, 0, 0, 1],
      ].map(([x1, y1, x2, y2], index) => (
        <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--nq-p0-line)" strokeWidth={0.11} strokeLinecap="round" />
      ))}
      <motion.line
        x1={1}
        y1={0}
        x2={1}
        y2={1}
        stroke="var(--nq-p0-line)"
        strokeWidth={0.11}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 0, 1, 1, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.3, 0.5, 0.85, 1] }}
      />
    </Frame>
  )
}

function FullBoardDiagram() {
  return (
    <Frame rows={2} cols={2}>
      {[
        { x: 0, y: 0, p: 0 },
        { x: 1, y: 0, p: 0 },
        { x: 0, y: 1, p: 1 },
        { x: 1, y: 1, p: 0 },
      ].map((box, index) => (
        <rect
          key={index}
          x={box.x + 0.08}
          y={box.y + 0.08}
          width={0.84}
          height={0.84}
          rx={0.08}
          fill={`var(--nq-p${box.p}-fill)`}
        />
      ))}
    </Frame>
  )
}

/** A three-box chain: the shape you must learn to hand over gracefully. */
function ChainDiagram() {
  return (
    <svg viewBox="-0.4 -0.4 3.8 1.8" className="mt-3 h-20 w-full" aria-hidden="true">
      {[0, 1, 2].map((c) => (
        <g key={c}>
          <line x1={c} y1={0} x2={c + 1} y2={0} stroke="var(--nq-p0-line)" strokeWidth={0.09} strokeLinecap="round" />
          <line x1={c} y1={1} x2={c + 1} y2={1} stroke="var(--nq-p0-line)" strokeWidth={0.09} strokeLinecap="round" />
        </g>
      ))}
      {[1, 2].map((c) => (
        <line key={c} x1={c} y1={0} x2={c} y2={1} stroke="var(--nq-line-idle)" strokeWidth={0.07} strokeDasharray="0.08 0.1" />
      ))}
      {[0, 3].map((c) => (
        <motion.line
          key={c}
          x1={c}
          y1={0}
          x2={c}
          y2={1}
          stroke="#e4695f"
          strokeWidth={0.09}
          strokeLinecap="round"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 2, repeat: Infinity, delay: c * 0.2 }}
        />
      ))}
      {dotPositions(1, 3).map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={0.075} fill="var(--nq-dot)" />
      ))}
    </svg>
  )
}
