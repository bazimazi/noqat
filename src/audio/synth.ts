/**
 * Instrument models.
 *
 * Every sound in Noqat is synthesised at runtime: there is not one audio file
 * in the bundle. That is partly a size decision (thirteen themes' worth of
 * music and effects would be tens of megabytes) and partly a design one — a
 * synthesised santoor can be retuned to a quarter-tone scale, and a synthesised
 * click can take its brightness from the theme's palette.
 *
 * Each model is a plain function that schedules nodes on a shared context and
 * cleans up after itself.
 */
import type { InstrumentId } from '../themes/types.ts'

export interface VoiceOptions {
  readonly freq: number
  readonly when: number
  readonly duration: number
  /** 0..1 */
  readonly gain: number
  /** -1..1 stereo position. */
  readonly pan?: number
  /** Slight timbral variation, 0..1. */
  readonly color?: number
}

export interface VoiceContext {
  readonly ctx: AudioContext
  /** Dry destination for this voice. */
  readonly out: AudioNode
  /** Reverb send. */
  readonly send: AudioNode | null
}

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

function envelope(
  ctx: AudioContext,
  when: number,
  attack: number,
  decay: number,
  peak: number,
): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
  return gain
}

function connectOut(node: AudioNode, voice: VoiceContext, pan: number, sendLevel: number): void {
  const ctx = voice.ctx
  let tail: AudioNode = node
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner()
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime)
    tail.connect(panner)
    tail = panner
  }
  tail.connect(voice.out)
  if (voice.send && sendLevel > 0) {
    const sendGain = ctx.createGain()
    sendGain.gain.value = sendLevel
    tail.connect(sendGain)
    sendGain.connect(voice.send)
  }
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached
  const length = Math.floor(ctx.sampleRate * 1.2)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    // Lightly low-passed white noise reads as "air" rather than "hiss".
    const white = Math.random() * 2 - 1
    last = white * 0.35 + last * 0.65
    data[i] = last
  }
  noiseCache.set(ctx, buffer)
  return buffer
}

/* ------------------------------------------------------------------ *
 * Karplus–Strong plucked string
 * ------------------------------------------------------------------ */

const pluckCache = new Map<string, AudioBuffer>()

/**
 * Renders a plucked string offline with the Karplus–Strong algorithm: a burst
 * of noise circulated through a short delay line with a one-pole lowpass in the
 * feedback path. This is the santoor, koto, guzheng, sitar, oud and qanun —
 * the `damping` and `brightness` parameters are what distinguish them.
 */
function pluckBuffer(ctx: AudioContext, freq: number, damping: number, brightness: number): AudioBuffer {
  const key = `${Math.round(freq)}:${damping.toFixed(2)}:${brightness.toFixed(2)}:${ctx.sampleRate}`
  const cached = pluckCache.get(key)
  if (cached) return cached

  const sampleRate = ctx.sampleRate
  const period = Math.max(2, Math.floor(sampleRate / freq))
  const length = Math.floor(sampleRate * 2.2)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)

  const line = new Float32Array(period)
  for (let i = 0; i < period; i++) {
    // Exciting with a bright, slightly shaped burst rather than pure noise
    // gives the attack a plectrum character instead of a hiss.
    const t = i / period
    line[i] = (Math.random() * 2 - 1) * (1 - t * (1 - brightness))
  }

  let index = 0
  let previous = 0
  for (let i = 0; i < length; i++) {
    const current = line[index]
    const filtered = (current + previous) * 0.5
    previous = current
    line[index] = filtered * damping
    data[i] = current
    index = (index + 1) % period
  }

  // Fade the tail so buffers never click when truncated.
  const fade = Math.floor(sampleRate * 0.05)
  for (let i = 0; i < fade; i++) data[length - 1 - i] *= i / fade

  if (pluckCache.size > 220) pluckCache.clear()
  pluckCache.set(key, buffer)
  return buffer
}

/* ------------------------------------------------------------------ *
 * the instruments
 * ------------------------------------------------------------------ */

function playPluck(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const color = o.color ?? 0.5
  const source = ctx.createBufferSource()
  source.buffer = pluckBuffer(ctx, o.freq, 0.994 - color * 0.01, 0.35 + color * 0.5)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(o.gain, o.when)
  gain.gain.exponentialRampToValueAtTime(0.0001, o.when + Math.max(0.2, o.duration))
  source.connect(gain)
  connectOut(gain, voice, o.pan ?? 0, 0.4)
  source.start(o.when)
  source.stop(o.when + Math.max(0.25, o.duration) + 0.05)
}

/** FM bell: a carrier modulated at a non-integer ratio, with a long tail. */
function playBell(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const carrier = ctx.createOscillator()
  const modulator = ctx.createOscillator()
  const modGain = ctx.createGain()
  carrier.type = 'sine'
  modulator.type = 'sine'
  carrier.frequency.setValueAtTime(o.freq, o.when)
  modulator.frequency.setValueAtTime(o.freq * 2.76, o.when) // inharmonic = metallic
  modGain.gain.setValueAtTime(o.freq * 1.8, o.when)
  modGain.gain.exponentialRampToValueAtTime(1, o.when + o.duration * 0.6)

  const amp = envelope(ctx, o.when, 0.004, Math.max(0.6, o.duration * 1.6), o.gain)
  modulator.connect(modGain)
  modGain.connect(carrier.frequency)
  carrier.connect(amp)
  connectOut(amp, voice, o.pan ?? 0, 0.65)

  modulator.start(o.when)
  carrier.start(o.when)
  const stop = o.when + Math.max(0.7, o.duration * 1.7) + 0.1
  modulator.stop(stop)
  carrier.stop(stop)
}

/** Breathy end-blown flute: ney and shakuhachi. */
function playFlute(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const tone = ctx.createOscillator()
  tone.type = 'sine'
  tone.frequency.setValueAtTime(o.freq, o.when)
  // A small pitch scoop into the note is most of what makes a flute breathe.
  tone.frequency.setValueAtTime(o.freq * 0.985, o.when)
  tone.frequency.linearRampToValueAtTime(o.freq, o.when + 0.09)

  const breath = ctx.createBufferSource()
  breath.buffer = noiseBuffer(ctx)
  breath.loop = true
  const breathFilter = ctx.createBiquadFilter()
  breathFilter.type = 'bandpass'
  breathFilter.frequency.setValueAtTime(o.freq * 2.2, o.when)
  breathFilter.Q.setValueAtTime(1.4, o.when)
  const breathGain = ctx.createGain()
  breathGain.gain.setValueAtTime(o.gain * 0.22, o.when)

  const amp = envelope(ctx, o.when, Math.min(0.22, o.duration * 0.3), o.duration, o.gain * 0.8)
  tone.connect(amp)
  breath.connect(breathFilter)
  breathFilter.connect(breathGain)
  breathGain.connect(amp)
  connectOut(amp, voice, o.pan ?? 0, 0.55)

  tone.start(o.when)
  breath.start(o.when)
  const stop = o.when + o.duration + 0.4
  tone.stop(stop)
  breath.stop(stop)
}

/** Bowed string: saw through a moving lowpass, with vibrato. */
function playBow(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(o.freq, o.when)

  const vibrato = ctx.createOscillator()
  const vibratoGain = ctx.createGain()
  vibrato.frequency.setValueAtTime(5.2, o.when)
  vibratoGain.gain.setValueAtTime(o.freq * 0.007, o.when)
  vibrato.connect(vibratoGain)
  vibratoGain.connect(osc.frequency)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(o.freq * 2.4, o.when)
  filter.frequency.exponentialRampToValueAtTime(o.freq * 5, o.when + o.duration * 0.4)
  filter.Q.setValueAtTime(1.1, o.when)

  const amp = envelope(ctx, o.when, Math.min(0.28, o.duration * 0.35), o.duration, o.gain * 0.55)
  osc.connect(filter)
  filter.connect(amp)
  connectOut(amp, voice, o.pan ?? 0, 0.5)

  osc.start(o.when)
  vibrato.start(o.when)
  const stop = o.when + o.duration + 0.4
  osc.stop(stop)
  vibrato.stop(stop)
}

/** Marimba / balafon: sine fundamental plus a bright fourth partial. */
function playMarimba(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const amp = envelope(ctx, o.when, 0.004, Math.max(0.24, o.duration * 0.7), o.gain)
  for (const [ratio, level] of [
    [1, 1],
    [4, 0.32],
    [9.2, 0.1],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(o.freq * ratio, o.when)
    const partial = ctx.createGain()
    partial.gain.setValueAtTime(level, o.when)
    osc.connect(partial)
    partial.connect(amp)
    osc.start(o.when)
    osc.stop(o.when + Math.max(0.3, o.duration) + 0.1)
  }
  connectOut(amp, voice, o.pan ?? 0, 0.35)
}

/** Slow detuned pad — the harmonic bed under everything. */
function playPad(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const amp = envelope(ctx, o.when, Math.min(1.4, o.duration * 0.4), o.duration, o.gain * 0.4)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(o.freq * 3.4, o.when)
  filter.Q.setValueAtTime(0.6, o.when)
  for (const detune of [-7, 0, 7]) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(o.freq, o.when)
    osc.detune.setValueAtTime(detune, o.when)
    osc.connect(filter)
    osc.start(o.when)
    osc.stop(o.when + o.duration + 1.6)
  }
  filter.connect(amp)
  connectOut(amp, voice, o.pan ?? 0, 0.7)
}

/** Resonant subtractive synth lead. */
function playSynth(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(o.freq, o.when)
  const sub = ctx.createOscillator()
  sub.type = 'square'
  sub.frequency.setValueAtTime(o.freq / 2, o.when)
  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.3, o.when)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.setValueAtTime(9, o.when)
  filter.frequency.setValueAtTime(o.freq * 8, o.when)
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, o.freq * 1.4), o.when + o.duration)

  const amp = envelope(ctx, o.when, 0.006, Math.max(0.16, o.duration), o.gain * 0.7)
  osc.connect(filter)
  sub.connect(subGain)
  subGain.connect(filter)
  filter.connect(amp)
  connectOut(amp, voice, o.pan ?? 0, 0.4)

  osc.start(o.when)
  sub.start(o.when)
  const stop = o.when + Math.max(0.2, o.duration) + 0.2
  osc.stop(stop)
  sub.stop(stop)
}

/**
 * Ceramic click — a glazed tile being set into place. A very short noise burst
 * through a high-Q bandpass, with a tiny pitched "ring" on top.
 */
function playCeramic(voice: VoiceContext, o: VoiceOptions): void {
  const { ctx } = voice
  const burst = ctx.createBufferSource()
  burst.buffer = noiseBuffer(ctx)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.setValueAtTime(o.freq * 3.2, o.when)
  band.Q.setValueAtTime(6 + (o.color ?? 0.5) * 8, o.when)

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(o.gain, o.when)
  amp.gain.exponentialRampToValueAtTime(0.0001, o.when + 0.09)

  const ring = ctx.createOscillator()
  ring.type = 'triangle'
  ring.frequency.setValueAtTime(o.freq * 2, o.when)
  const ringGain = ctx.createGain()
  ringGain.gain.setValueAtTime(o.gain * 0.28, o.when)
  ringGain.gain.exponentialRampToValueAtTime(0.0001, o.when + 0.14)

  burst.connect(band)
  band.connect(amp)
  ring.connect(ringGain)
  connectOut(amp, voice, o.pan ?? 0, 0.25)
  connectOut(ringGain, voice, o.pan ?? 0, 0.25)

  burst.start(o.when)
  burst.stop(o.when + 0.12)
  ring.start(o.when)
  ring.stop(o.when + 0.16)
}

const VOICES: Record<InstrumentId, (voice: VoiceContext, o: VoiceOptions) => void> = {
  pluck: playPluck,
  bell: playBell,
  flute: playFlute,
  bow: playBow,
  marimba: playMarimba,
  pad: playPad,
  synth: playSynth,
  ceramic: playCeramic,
}

export function playVoice(instrument: InstrumentId, voice: VoiceContext, options: VoiceOptions): void {
  const fn = VOICES[instrument] ?? playCeramic
  try {
    fn(voice, options)
  } catch {
    // A dropped note must never take the game down with it.
  }
}

/** Generates a decaying-noise impulse response for the convolution reverb. */
export function createImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const t = i / length
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
    }
  }
  return impulse
}
