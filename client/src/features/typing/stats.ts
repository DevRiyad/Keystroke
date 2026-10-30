/**
 * Statistics. One function is used for live display and for the final result,
 * so both always follow the same rules.
 *
 * Counting policy
 *  - Character counts come from the FINAL state of each word (after corrections):
 *      correct   = positions where typed char == target char
 *      incorrect = positions where typed char != target char
 *      extra     = typed chars beyond the target word's length
 *      missed    = target chars never typed in a word that was committed with Space
 *                  (the word being typed right now is not "missed" yet)
 *      each Space that committed a word counts as 1 correct char if the word was
 *      fully correct, otherwise 1 incorrect char. The last word of a fixed text
 *      finished by typing it exactly has no trailing Space.
 *  - Net WPM  = correctChars / 5 / minutes
 *  - Raw WPM  = (all keystrokes, incl. mistakes and Space; Backspace excluded) / 5 / minutes
 *  - Accuracy = correct keystrokes / all keystrokes * 100. Keystroke-based, so a
 *               mistake that was corrected still lowers accuracy. 0 if nothing typed.
 *  - Consistency = based on per-second raw WPM (full seconds only):
 *      cov = stdev / mean;  consistency = 100 * (1 - tanh(cov + cov^3/3 + cov^5/5))
 *      null when fewer than 2 full seconds (or no typing) are available.
 *  - minutes = engine.elapsedMs() / 60000. Zero elapsed time => WPM values are 0.
 *  - Zen (free) mode: every keystroke is correct, so accuracy is 100 once anything is typed.
 */
import type { TypingEngine } from './engine'

export interface Stats {
  elapsedMs: number
  wpm: number
  rawWpm: number
  accuracy: number
  correctChars: number
  incorrectChars: number
  extraChars: number
  missedChars: number
  correctKeystrokes: number
  incorrectKeystrokes: number
  consistency: number | null
  rawPerSecond: number[]
  /** Correct keystrokes per second, expressed as WPM (for the results chart). */
  correctPerSecond: number[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeConsistency(rawPerSecond: number[]): number | null {
  if (rawPerSecond.length < 2) return null
  const mean = rawPerSecond.reduce((a, b) => a + b, 0) / rawPerSecond.length
  if (mean <= 0) return null
  const variance = rawPerSecond.reduce((a, b) => a + (b - mean) ** 2, 0) / rawPerSecond.length
  const cov = Math.sqrt(variance) / mean
  return round2(100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5)))
}

export function computeStats(e: TypingEngine): Stats {
  const elapsedMs = e.elapsedMs()
  let correct = 0
  let incorrect = 0
  let extra = 0
  let missed = 0

  const last = Math.min(e.wordIndex, e.words.length - 1)
  for (let i = 0; i <= last; i++) {
    const target = e.words[i]
    const input = e.inputs[i]
    const done = e.committed[i]
    if (input === '' && !done) continue
    const n = Math.min(target.length, input.length)
    let matches = 0
    for (let j = 0; j < n; j++) if (input[j] === target[j]) matches++
    correct += matches
    incorrect += n - matches
    if (input.length > target.length) extra += input.length - target.length
    if (done) {
      if (target.length > input.length) missed += target.length - input.length
      if (input === target) correct++
      else incorrect++
    }
  }

  const totalKeys = e.correctKeys + e.incorrectKeys
  const minutes = elapsedMs / 60000

  const seconds = Math.floor(elapsedMs / 1000)
  const rawPerSecond: number[] = []
  const correctPerSecond: number[] = []
  if (seconds >= 1) {
    const counts = new Array<number>(seconds).fill(0)
    const okCounts = new Array<number>(seconds).fill(0)
    for (let k = 0; k < e.strokeTimes.length; k++) {
      const b = Math.floor(e.strokeTimes[k] / 1000)
      if (b < seconds) {
        counts[b]++
        if (e.strokeOk[k]) okCounts[b]++
      }
    }
    for (let b = 0; b < seconds; b++) {
      rawPerSecond.push(round2(counts[b] * 12)) // keys/sec * 60 / 5
      correctPerSecond.push(round2(okCounts[b] * 12))
    }
  }

  return {
    elapsedMs,
    wpm: minutes > 0 ? round2(correct / 5 / minutes) : 0,
    rawWpm: minutes > 0 ? round2(totalKeys / 5 / minutes) : 0,
    accuracy: totalKeys > 0 ? round2((e.correctKeys / totalKeys) * 100) : 0,
    correctChars: correct,
    incorrectChars: incorrect,
    extraChars: extra,
    missedChars: missed,
    correctKeystrokes: e.correctKeys,
    incorrectKeystrokes: e.incorrectKeys,
    consistency: computeConsistency(rawPerSecond),
    rawPerSecond,
    correctPerSecond,
  }
}
