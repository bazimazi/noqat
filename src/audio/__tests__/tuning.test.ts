import { describe, expect, it } from 'vitest'
import { beatDuration, centsToFreq, degreeToFreq, freqToNearestDegree } from '../tuning.ts'

const EQUAL = [0, 200, 400, 500, 700, 900, 1100]
const SHUR = [0, 150, 300, 500, 700, 800, 1000] // Persian, with the koron second

describe('tuning', () => {
  it('doubles frequency at the octave', () => {
    expect(centsToFreq(220, 1200)).toBeCloseTo(440, 6)
    expect(centsToFreq(220, -1200)).toBeCloseTo(110, 6)
  })

  it('matches equal temperament for whole semitones', () => {
    expect(centsToFreq(440, 700)).toBeCloseTo(659.255, 2) // E5
  })

  it('renders quarter tones that equal temperament cannot', () => {
    const koron = centsToFreq(220, 150)
    const minorSecond = centsToFreq(220, 100)
    const majorSecond = centsToFreq(220, 200)
    expect(koron).toBeGreaterThan(minorSecond)
    expect(koron).toBeLessThan(majorSecond)
  })

  it('wraps scale degrees into octaves in both directions', () => {
    const base = degreeToFreq(220, EQUAL, 0)
    expect(degreeToFreq(220, EQUAL, EQUAL.length)).toBeCloseTo(base * 2, 6)
    expect(degreeToFreq(220, EQUAL, -EQUAL.length)).toBeCloseTo(base / 2, 6)
  })

  it('keeps degrees ascending within an octave', () => {
    const freqs = SHUR.map((_, i) => degreeToFreq(196, SHUR, i))
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))
  })

  it('snaps a frequency back to its nearest degree', () => {
    const freq = degreeToFreq(220, SHUR, 4)
    expect(freqToNearestDegree(220, SHUR, freq)).toBe(4)
    // Slightly sharp of degree 4 still resolves to degree 4.
    expect(freqToNearestDegree(220, SHUR, freq * 1.005)).toBe(4)
  })

  it('converts tempo to beat length', () => {
    expect(beatDuration(60)).toBe(1)
    expect(beatDuration(120)).toBe(0.5)
  })
})
