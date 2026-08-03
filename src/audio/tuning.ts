/**
 * Tuning maths.
 *
 * Noqat's music is generated, not sampled, which means it can be tuned
 * properly. Several of the themes are built on maqām/dastgāh systems whose
 * degrees fall between the piano keys — the Persian *koron* second sits about
 * a quarter-tone flat, and Turkish makam uses Holdrian commas. Working in cents
 * rather than semitones is what makes those themes sound like themselves
 * instead of like a Western minor scale wearing a hat.
 */

/** Frequency of a pitch `cents` above `root`. */
export function centsToFreq(root: number, cents: number): number {
  return root * Math.pow(2, cents / 1200)
}

/**
 * Resolves scale degree `index` (which may be negative or beyond the scale
 * length) to a frequency, wrapping into octaves as needed.
 */
export function degreeToFreq(root: number, scale: readonly number[], index: number): number {
  const n = scale.length
  const octave = Math.floor(index / n)
  const degree = ((index % n) + n) % n
  return centsToFreq(root, scale[degree] + octave * 1200)
}

/** Nearest scale degree to a frequency — used to snap SFX pitches into key. */
export function freqToNearestDegree(root: number, scale: readonly number[], freq: number): number {
  const cents = 1200 * Math.log2(freq / root)
  const octave = Math.floor(cents / 1200)
  const within = cents - octave * 1200
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < scale.length; i++) {
    const d = Math.abs(scale[i] - within)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return octave * scale.length + best
}

/** Beat length in seconds. */
export function beatDuration(tempo: number): number {
  return 60 / tempo
}
