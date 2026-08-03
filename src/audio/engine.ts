/**
 * The audio engine: graph, buses, scheduler and the adaptive soundtrack.
 *
 *   voices ──┬─► dry ─────────────┐
 *            └─► send ─► reverb ──┤
 *                                 ├─► bus (music / sfx / ambience)
 *                                 └─► master ─► compressor ─► out
 *
 * Music is composed at play time from the theme's scale and tempo, and reacts
 * to the game: the melody thins out while a player is thinking, and thickens
 * when chains start falling. Nothing loops, so nothing gets tiresome.
 */
import type { ThemeAudio } from '../themes/types.ts'
import { createRng, type Rng } from '../lib/rng.ts'
import { createImpulseResponse, playVoice, type VoiceContext } from './synth.ts'
import { beatDuration, degreeToFreq } from './tuning.ts'

export interface AudioLevels {
  readonly master: number
  readonly music: number
  readonly effects: number
  readonly muted: boolean
}

export const DEFAULT_LEVELS: AudioLevels = {
  master: 0.8,
  music: 0.45,
  effects: 0.75,
  muted: false,
}

export type SfxName =
  | 'hover'
  | 'place'
  | 'capture'
  | 'doubleCapture'
  | 'turnChange'
  | 'victory'
  | 'defeat'
  | 'draw'
  | 'select'
  | 'back'
  | 'error'
  | 'tick'
  | 'unlock'

interface Bus {
  readonly gain: GainNode
  readonly send: GainNode
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private music: Bus | null = null
  private sfx: Bus | null = null
  private ambience: Bus | null = null
  private ambienceSource: AudioBufferSourceNode | null = null
  private reverb: ConvolverNode | null = null
  private levels: AudioLevels = DEFAULT_LEVELS
  private theme: ThemeAudio | null = null
  private rng: Rng = createRng(0xa11ce)

  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private nextNoteTime = 0
  private step = 0
  private intensity = 0.4
  private musicPlaying = false
  private lastHoverAt = 0

  get available(): boolean {
    return this.ctx !== null && this.ctx.state !== 'closed'
  }

  get running(): boolean {
    return this.ctx?.state === 'running'
  }

  /**
   * Must be called from a user gesture. Browsers refuse to start an
   * AudioContext otherwise, so every entry point (first tap, menu button,
   * settings toggle) funnels through here.
   */
  async unlock(): Promise<boolean> {
    if (typeof AudioContext === 'undefined') return false
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        this.buildGraph()
      } catch {
        this.ctx = null
        return false
      }
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        return false
      }
    }
    return this.ctx.state === 'running'
  }

  private buildGraph(): void {
    const ctx = this.ctx
    if (!ctx) return

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-16, ctx.currentTime)
    compressor.knee.setValueAtTime(24, ctx.currentTime)
    compressor.ratio.setValueAtTime(3.2, ctx.currentTime)
    compressor.attack.setValueAtTime(0.006, ctx.currentTime)
    compressor.release.setValueAtTime(0.22, ctx.currentTime)
    compressor.connect(ctx.destination)

    const master = ctx.createGain()
    master.gain.value = this.levels.muted ? 0 : this.levels.master
    master.connect(compressor)
    this.master = master

    const reverb = ctx.createConvolver()
    reverb.buffer = createImpulseResponse(ctx, 2.6, 3.4)
    reverb.connect(master)
    this.reverb = reverb

    const makeBus = (level: number): Bus => {
      const gain = ctx.createGain()
      gain.gain.value = level
      gain.connect(master)
      const send = ctx.createGain()
      send.gain.value = 0.3
      send.connect(reverb)
      return { gain, send }
    }

    this.music = makeBus(this.levels.music)
    this.sfx = makeBus(this.levels.effects)
    this.ambience = makeBus(this.levels.effects * 0.5)
  }

  setLevels(levels: AudioLevels): void {
    this.levels = levels
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    this.master.gain.setTargetAtTime(levels.muted ? 0 : levels.master, now, 0.05)
    this.music?.gain.gain.setTargetAtTime(levels.music, now, 0.08)
    this.sfx?.gain.gain.setTargetAtTime(levels.effects, now, 0.05)
    this.ambience?.gain.gain.setTargetAtTime(
      levels.effects * (this.theme?.ambienceLevel ?? 0) * 2,
      now,
      0.4,
    )
  }

  setTheme(theme: ThemeAudio, seed = 1): void {
    const changed = this.theme?.lead !== theme.lead || this.theme?.root !== theme.root
    this.theme = theme
    this.rng = createRng(seed)
    const ctx = this.ctx
    if (ctx && this.reverb) {
      this.reverb.buffer = createImpulseResponse(ctx, 1.2 + theme.reverb * 3, 2.4 + theme.reverb * 2)
    }
    if (this.music) this.music.send.gain.value = theme.reverb
    if (this.sfx) this.sfx.send.gain.value = theme.reverb * 0.6
    this.startAmbience()
    if (changed && this.musicPlaying) {
      this.stopMusic()
      void this.startMusic()
    }
  }

  /** 0..1 — how tense the game is right now. Drives density and register. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value))
  }

  private voiceContext(bus: Bus | null): VoiceContext | null {
    if (!this.ctx || !bus) return null
    return { ctx: this.ctx, out: bus.gain, send: bus.send }
  }

  /* ---------------------------------------------------------------- *
   * sound effects
   * ---------------------------------------------------------------- */

  play(name: SfxName, options: { player?: number; pan?: number; intensity?: number } = {}): void {
    const ctx = this.ctx
    const theme = this.theme
    const voice = this.voiceContext(this.sfx)
    if (!ctx || !theme || !voice || this.levels.muted) return

    const now = ctx.currentTime + 0.001
    const pan = options.pan ?? 0
    // Each player gets their own register, so you can hear whose move it was.
    const playerOffset = (options.player ?? 0) * 2
    const scale = theme.scale

    switch (name) {
      case 'hover': {
        // Rate-limited: pointer moves fire this dozens of times a second.
        if (now - this.lastHoverAt < 0.045) return
        this.lastHoverAt = now
        playVoice(theme.place, voice, {
          freq: degreeToFreq(theme.root, scale, 12 + playerOffset),
          when: now,
          duration: 0.05,
          gain: 0.06,
          pan,
          color: 0.3,
        })
        break
      }
      case 'place':
        playVoice(theme.place, voice, {
          freq: degreeToFreq(theme.root, scale, 7 + playerOffset + this.rng.int(3)),
          when: now,
          duration: 0.16,
          gain: 0.3,
          pan,
          color: 0.5,
        })
        break
      case 'capture':
        // A rising two-note flourish in the theme's own scale.
        playVoice(theme.capture, voice, {
          freq: degreeToFreq(theme.root, scale, 9 + playerOffset),
          when: now,
          duration: 0.35,
          gain: 0.3,
          pan,
        })
        playVoice(theme.capture, voice, {
          freq: degreeToFreq(theme.root, scale, 12 + playerOffset),
          when: now + 0.07,
          duration: 0.5,
          gain: 0.24,
          pan,
        })
        break
      case 'doubleCapture':
        for (let i = 0; i < 3; i++) {
          playVoice(theme.capture, voice, {
            freq: degreeToFreq(theme.root, scale, 9 + playerOffset + i * 2),
            when: now + i * 0.06,
            duration: 0.5,
            gain: 0.26,
            pan,
          })
        }
        break
      case 'turnChange':
        playVoice(theme.place, voice, {
          freq: degreeToFreq(theme.root, scale, 4 + playerOffset),
          when: now,
          duration: 0.12,
          gain: 0.12,
          pan,
          color: 0.2,
        })
        break
      case 'select':
        playVoice(theme.place, voice, {
          freq: degreeToFreq(theme.root, scale, 10),
          when: now,
          duration: 0.09,
          gain: 0.16,
          color: 0.7,
        })
        break
      case 'back':
        playVoice(theme.place, voice, {
          freq: degreeToFreq(theme.root, scale, 3),
          when: now,
          duration: 0.11,
          gain: 0.14,
          color: 0.2,
        })
        break
      case 'error':
        playVoice('ceramic', voice, { freq: theme.root * 0.7, when: now, duration: 0.1, gain: 0.2, color: 0.9 })
        break
      case 'tick':
        playVoice('ceramic', voice, {
          freq: theme.root * 4,
          when: now,
          duration: 0.03,
          gain: 0.08,
          color: 0.8,
        })
        break
      case 'unlock':
        for (let i = 0; i < 4; i++) {
          playVoice('bell', voice, {
            freq: degreeToFreq(theme.root, scale, 7 + i * 2),
            when: now + i * 0.1,
            duration: 0.6,
            gain: 0.2,
          })
        }
        break
      case 'victory':
        this.playFanfare(voice, now, true)
        break
      case 'defeat':
        this.playFanfare(voice, now, false)
        break
      case 'draw':
        for (const degree of [7, 9, 7]) {
          playVoice(theme.capture, voice, {
            freq: degreeToFreq(theme.root, scale, degree),
            when: now + (degree === 9 ? 0.18 : 0),
            duration: 0.6,
            gain: 0.2,
          })
        }
        break
    }
  }

  private playFanfare(voice: VoiceContext, now: number, triumphant: boolean): void {
    const theme = this.theme
    if (!theme) return
    const degrees = triumphant ? [0, 2, 4, 7, 9, 11] : [11, 7, 4, 2, 0]
    degrees.forEach((degree, i) => {
      playVoice(triumphant ? theme.capture : theme.pad, voice, {
        freq: degreeToFreq(theme.root, theme.scale, degree + (triumphant ? 7 : 0)),
        when: now + i * (triumphant ? 0.11 : 0.19),
        duration: triumphant ? 0.7 : 1.1,
        gain: triumphant ? 0.26 : 0.2,
        pan: (i % 2 === 0 ? -1 : 1) * 0.25,
      })
    })
  }

  /* ---------------------------------------------------------------- *
   * ambience
   * ---------------------------------------------------------------- */

  private startAmbience(): void {
    const ctx = this.ctx
    const theme = this.theme
    if (!ctx || !theme || !this.ambience) return
    this.ambienceSource?.stop()
    this.ambienceSource = null
    if (theme.ambience === 'none' || theme.ambienceLevel <= 0) return

    const seconds = 4
    const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate)
    // Each ambience is a different noise colour: 'air' is bright and sparse,
    // 'wind' has slow amplitude swells, 'water' is band-limited and rippling.
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let last = 0
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1
        const smoothing =
          theme.ambience === 'air' ? 0.72 : theme.ambience === 'city' ? 0.9 : 0.96
        last = white * (1 - smoothing) + last * smoothing
        const swell =
          theme.ambience === 'wind'
            ? 0.6 + 0.4 * Math.sin((i / ctx.sampleRate) * 0.7 + channel)
            : theme.ambience === 'water'
              ? 0.7 + 0.3 * Math.sin((i / ctx.sampleRate) * 2.3 + channel * 1.7)
              : 1
        data[i] = last * swell * 4
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = theme.ambience === 'air' ? 'highpass' : 'lowpass'
    filter.frequency.value = theme.ambience === 'air' ? 2200 : 900
    const gain = ctx.createGain()
    gain.gain.value = theme.ambienceLevel
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.ambience.gain)
    source.start()
    this.ambienceSource = source
  }

  /* ---------------------------------------------------------------- *
   * generative soundtrack
   * ---------------------------------------------------------------- */

  async startMusic(): Promise<void> {
    if (this.musicPlaying) return
    if (!(await this.unlock())) return
    const ctx = this.ctx
    if (!ctx || !this.theme) return
    this.musicPlaying = true
    this.nextNoteTime = ctx.currentTime + 0.15
    this.step = 0
    // Lookahead scheduling: the timer only queues notes, the audio clock plays
    // them, so tab throttling cannot make the music stutter.
    this.schedulerTimer = setInterval(() => this.scheduleAhead(), 40)
  }

  stopMusic(): void {
    this.musicPlaying = false
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
  }

  private scheduleAhead(): void {
    const ctx = this.ctx
    const theme = this.theme
    const voice = this.voiceContext(this.music)
    if (!ctx || !theme || !voice || !this.musicPlaying) return

    const beat = beatDuration(theme.tempo)
    const horizon = ctx.currentTime + 0.35

    while (this.nextNoteTime < horizon) {
      this.scheduleStep(voice, theme, this.nextNoteTime, beat)
      this.nextNoteTime += beat / 2
      this.step++
    }
  }

  private scheduleStep(voice: VoiceContext, theme: ThemeAudio, when: number, beat: number): void {
    const bar = Math.floor(this.step / 8)
    const inBar = this.step % 8

    // Drone / pad: one long chord at the top of each bar.
    if (inBar === 0) {
      const rootDegree = bar % 4 === 2 ? 3 : 0
      playVoice(theme.pad, voice, {
        freq: degreeToFreq(theme.root, theme.scale, rootDegree - theme.scale.length),
        when,
        duration: beat * 4,
        gain: 0.16 + this.intensity * 0.05,
        pan: -0.15,
      })
    }

    // Melody: denser and higher as the game gets tense.
    const density = 0.24 + this.intensity * 0.4
    if (this.rng.bool(density)) {
      const register = this.intensity > 0.66 ? 14 : this.intensity > 0.33 ? 7 : 7
      const contour = [0, 2, 1, 4, 3, 5, 4, 2][inBar]
      const degree = register + contour + (this.rng.bool(0.22) ? theme.scale.length : 0)
      playVoice(theme.lead, voice, {
        freq: degreeToFreq(theme.root, theme.scale, degree),
        when,
        duration: beat * (this.rng.bool(0.3) ? 1.4 : 0.7),
        gain: 0.15 + this.intensity * 0.08,
        pan: (this.rng.next() - 0.5) * 0.5,
        color: this.rng.next(),
      })
    }

    // Percussion: a light pulse, only on themes that asked for one.
    if (theme.percussion && inBar % 4 === 0 && this.intensity > 0.2) {
      playVoice(theme.percussion, voice, {
        freq: theme.root * (inBar === 0 ? 0.5 : 1.5),
        when,
        duration: 0.12,
        gain: 0.1 + this.intensity * 0.06,
        color: 0.8,
      })
    }
  }

  dispose(): void {
    this.stopMusic()
    this.ambienceSource?.stop()
    this.ambienceSource = null
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.music = null
    this.sfx = null
    this.ambience = null
  }
}

let engine: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine()
  return engine
}
