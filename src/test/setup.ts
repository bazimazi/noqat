import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom implements neither of these, and the UI leans on both.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame
}

/*
 * Web Audio mock.
 *
 * The audio engine is entirely procedural, so it drives a lot of AudioParam
 * surface. Rather than stubbing methods one crash at a time, every param gets
 * the full scheduling interface and every node gets connect/disconnect — the
 * engine then runs end to end under test and any real misuse still throws.
 */
function audioParam(value = 0) {
  return {
    value,
    defaultValue: value,
    minValue: -3.4e38,
    maxValue: 3.4e38,
    automationRate: 'a-rate' as const,
    setValueAtTime() { return this },
    linearRampToValueAtTime() { return this },
    exponentialRampToValueAtTime() { return this },
    setTargetAtTime() { return this },
    setValueCurveAtTime() { return this },
    cancelScheduledValues() { return this },
    cancelAndHoldAtTime() { return this },
  }
}

function audioNode<T extends object>(extra: T) {
  return {
    connect: (target: unknown) => target,
    disconnect() {},
    ...extra,
  }
}

class MockAudioContext {
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = audioNode({})
  listener = {}

  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.state = 'suspended'
    return Promise.resolve()
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }

  createGain() {
    return audioNode({ gain: audioParam(1) })
  }
  createOscillator() {
    return audioNode({
      type: 'sine',
      frequency: audioParam(440),
      detune: audioParam(0),
      start() {},
      stop() {},
    })
  }
  createBiquadFilter() {
    return audioNode({
      type: 'lowpass',
      frequency: audioParam(1000),
      Q: audioParam(1),
      gain: audioParam(0),
      detune: audioParam(0),
    })
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel: number) => data[channel] ?? data[0],
    }
  }
  createBufferSource() {
    return audioNode({
      buffer: null as unknown,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: audioParam(1),
      detune: audioParam(0),
      start() {},
      stop() {},
    })
  }
  createStereoPanner() {
    return audioNode({ pan: audioParam(0) })
  }
  createConvolver() {
    return audioNode({ buffer: null as unknown, normalize: true })
  }
  createDelay() {
    return audioNode({ delayTime: audioParam(0) })
  }
  createDynamicsCompressor() {
    return audioNode({
      threshold: audioParam(-24),
      knee: audioParam(30),
      ratio: audioParam(12),
      attack: audioParam(0.003),
      release: audioParam(0.25),
      reduction: 0,
    })
  }
  createAnalyser() {
    return audioNode({ fftSize: 2048, frequencyBinCount: 1024 })
  }
}

vi.stubGlobal('AudioContext', MockAudioContext)
vi.stubGlobal('webkitAudioContext', MockAudioContext)

// Node 22 defines a `localStorage` global that shadows jsdom's own and stays
// undefined unless the process was started with --localstorage-file, so the
// persisted stores would have nothing to write to. Hand them a memory-backed
// one instead of reaching for a flag that only some runners will pass.
if (!globalThis.localStorage) {
  const entries = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return entries.size
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  })
}

// jsdom has no layout, so it has no scrollIntoView.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

// Used by the online loopback transport.
if (!globalThis.BroadcastChannel) {
  globalThis.BroadcastChannel = class {
    name: string
    constructor(name: string) {
      this.name = name
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  } as unknown as typeof BroadcastChannel
}
