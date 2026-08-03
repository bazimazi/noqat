/**
 * Ambient particles and weather.
 *
 * One `<canvas>` for everything, one rAF loop, no React state per particle.
 * Density scales with viewport area (not particle count), the loop pauses when
 * the tab is hidden, and the whole layer disappears under reduced motion —
 * ambience must never cost the board a frame.
 */
import { useEffect, useRef } from 'react'
import type { ThemeParticles, WeatherKind } from '../../themes/types.ts'
import { createRng } from '../../lib/rng.ts'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  alpha: number
  color: string
  phase: number
}

export interface ParticleFieldProps {
  readonly particles: ThemeParticles
  readonly weather: WeatherKind
  readonly enabled: boolean
  readonly reducedMotion: boolean
  /** Bumped to trigger a celebratory burst. */
  readonly burst?: { at: number; colors: readonly string[]; kind: string } | null
}

export function ParticleField({
  particles,
  weather,
  enabled,
  reducedMotion,
  burst,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ ambient: Particle[]; confetti: Particle[] }>({ ambient: [], confetti: [] })
  const burstRef = useRef<number>(0)

  useEffect(() => {
    if (!burst || !enabled || reducedMotion) return
    if (burst.at === burstRef.current) return
    burstRef.current = burst.at
    const canvas = canvasRef.current
    if (!canvas) return
    const rng = createRng(burst.at)
    const width = canvas.clientWidth
    const count = Math.min(220, Math.round(width / 5))
    for (let i = 0; i < count; i++) {
      const angle = rng.range(-Math.PI * 0.85, -Math.PI * 0.15)
      const speed = rng.range(3.5, 11)
      stateRef.current.confetti.push({
        x: rng.range(width * 0.15, width * 0.85),
        y: canvas.clientHeight * rng.range(0.45, 0.7),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rng.range(4, 11),
        rotation: rng.range(0, Math.PI * 2),
        spin: rng.range(-0.22, 0.22),
        alpha: 1,
        color: burst.colors.length ? rng.pick(burst.colors) : '#ffffff',
        phase: rng.range(0, Math.PI * 2),
      })
    }
  }, [burst, enabled, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!enabled || reducedMotion) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      stateRef.current.ambient = []
      stateRef.current.confetti = []
      return
    }

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    const rng = createRng(0x5eed)

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    const targetCount = () => {
      const area = (width * height) / 100_000
      const themeCount = particles.kind === 'none' ? 0 : particles.density * area
      const weatherCount = weatherDensity(weather) * area
      return Math.min(340, Math.round(themeCount + weatherCount))
    }

    const spawn = (fromTop: boolean): Particle => {
      const useWeather = weather !== 'none' && rng.bool(0.55)
      const palette = useWeather ? weatherColors(weather) : particles.colors
      const [minSize, maxSize] = useWeather ? weatherSize(weather) : particles.size
      const speed = useWeather ? weatherSpeed(weather) : particles.speed
      const drift = useWeather ? Math.PI / 2 : particles.drift
      return {
        x: rng.range(-40, width + 40),
        y: fromTop ? rng.range(-height, 0) : rng.range(0, height),
        vx: Math.cos(drift) * speed * rng.range(0.5, 1.6),
        vy: Math.sin(drift) * speed * rng.range(0.5, 1.6),
        size: rng.range(minSize, maxSize),
        rotation: rng.range(0, Math.PI * 2),
        spin: rng.range(-0.02, 0.02),
        alpha: rng.range(0.25, 0.85),
        color: palette.length ? rng.pick(palette) : '#ffffff',
        phase: rng.range(0, Math.PI * 2),
      }
    }

    const seed = () => {
      const target = targetCount()
      const list = stateRef.current.ambient
      while (list.length > target) list.pop()
      while (list.length < target) list.push(spawn(false))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let raf = 0
    let last = performance.now()
    let running = true

    const onVisibility = () => {
      running = !document.hidden
      if (running) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const kind = particles.kind
    const frame = (now: number) => {
      if (!running) return
      const dt = Math.min(48, now - last)
      last = now
      ctx.clearRect(0, 0, width, height)

      for (const p of stateRef.current.ambient) {
        p.phase += dt * 0.0016
        // A little lateral sway sells "drifting" far better than straight fall.
        p.x += (p.vx + Math.sin(p.phase) * 0.22) * dt * 0.06
        p.y += p.vy * dt * 0.06
        p.rotation += p.spin * dt * 0.06

        if (p.y > height + 30) {
          p.y = -20
          p.x = rng.range(-40, width + 40)
        } else if (p.y < -40) {
          p.y = height + 20
        }
        if (p.x > width + 50) p.x = -40
        else if (p.x < -50) p.x = width + 40

        drawParticle(ctx, p, kind, weather)
      }

      const confetti = stateRef.current.confetti
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i]
        p.vy += 0.32 * (dt / 16)
        p.vx *= 0.995
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.rotation += p.spin * (dt / 16)
        p.alpha -= 0.0038 * (dt / 16)
        if (p.alpha <= 0 || p.y > height + 60) {
          confetti.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [particles, weather, enabled, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      data-testid="particle-field"
    />
  )
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  kind: ThemeParticles['kind'],
  weather: WeatherKind,
): void {
  ctx.save()
  ctx.globalAlpha = p.alpha
  ctx.translate(p.x, p.y)
  ctx.fillStyle = p.color
  ctx.strokeStyle = p.color

  if (weather === 'rain' && p.size < 3) {
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-1.5, p.size * 4)
    ctx.stroke()
    ctx.restore()
    return
  }

  ctx.rotate(p.rotation)
  switch (kind) {
    case 'sakura':
    case 'petals':
    case 'leaves': {
      // A single teardrop petal: two quadratics meeting at the tip.
      ctx.beginPath()
      ctx.moveTo(0, -p.size / 2)
      ctx.quadraticCurveTo(p.size / 2, 0, 0, p.size / 2)
      ctx.quadraticCurveTo(-p.size / 2, 0, 0, -p.size / 2)
      ctx.fill()
      break
    }
    case 'confetti':
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      break
    case 'sparks':
      ctx.fillRect(-p.size / 6, -p.size, p.size / 3, p.size * 2)
      break
    case 'snow':
    case 'bubbles':
    case 'fireflies':
    case 'embers':
    case 'sand':
    case 'dust':
    default:
      ctx.beginPath()
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
      break
  }
  ctx.restore()
}

function weatherDensity(weather: WeatherKind): number {
  switch (weather) {
    case 'rain':
      return 22
    case 'snow':
      return 12
    case 'autumn':
      return 5
    case 'fireflies':
      return 3
    case 'stars':
      return 8
    case 'wind':
      return 4
    default:
      return 0
  }
}

function weatherColors(weather: WeatherKind): string[] {
  switch (weather) {
    case 'rain':
      return ['rgba(180,210,255,0.55)']
    case 'snow':
      return ['#ffffff', '#e8f2ff']
    case 'autumn':
      return ['#d98324', '#b3541e', '#e6b325']
    case 'fireflies':
      return ['#ffe066', '#c9f299']
    case 'stars':
      return ['#ffffff', '#ffe9c4']
    case 'wind':
      return ['rgba(255,255,255,0.35)']
    default:
      return []
  }
}

function weatherSize(weather: WeatherKind): [number, number] {
  switch (weather) {
    case 'rain':
      return [1, 2.4]
    case 'snow':
      return [1.6, 4.2]
    case 'autumn':
      return [5, 11]
    case 'fireflies':
      return [2, 3.6]
    case 'stars':
      return [0.8, 2]
    default:
      return [1, 3]
  }
}

function weatherSpeed(weather: WeatherKind): number {
  switch (weather) {
    case 'rain':
      return 3.6
    case 'snow':
      return 0.5
    case 'autumn':
      return 0.6
    case 'fireflies':
      return 0.14
    case 'stars':
      return 0.02
    default:
      return 0.3
  }
}
