import { describe, expect, it } from 'vitest'
import { TypingEngine } from './engine'
import { computeConsistency, computeStats } from './stats'

const type = (e: TypingEngine, s: string) => {
  for (const ch of s) e.insert(ch)
}

describe('computeStats', () => {
  it('returns zeros for an empty test (no NaN / Infinity)', () => {
    const s = computeStats(new TypingEngine(['abc']))
    expect(s.elapsedMs).toBe(0)
    expect(s.wpm).toBe(0)
    expect(s.rawWpm).toBe(0)
    expect(s.accuracy).toBe(0)
    expect(s.consistency).toBeNull()
    expect(s.rawPerSecond).toEqual([])
  })

  it('handles zero elapsed time', () => {
    const e = new TypingEngine(['abc'], { now: () => 5 })
    type(e, 'ab')
    e.stop() // started and stopped at the same instant
    const s = computeStats(e)
    expect(s.elapsedMs).toBe(0)
    expect(s.wpm).toBe(0)
    expect(s.rawWpm).toBe(0)
    expect(Number.isFinite(s.accuracy)).toBe(true)
  })

  it('computes net WPM, raw WPM and accuracy', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['ab'], { now: () => t.v })
    e.insert('a') // t=0
    t.v = 1000
    e.insert('x') // wrong
    e.backspace()
    t.v = 2000
    e.insert('b') // finishes
    const s = computeStats(e)
    expect(e.status).toBe('finished')
    expect(s.elapsedMs).toBe(2000)
    expect(s.correctChars).toBe(2)
    expect(s.incorrectChars).toBe(0)
    expect(s.wpm).toBe(12) // 2 / 5 / (2000/60000)
    expect(s.rawWpm).toBe(18) // 3 keystrokes
    expect(s.accuracy).toBe(66.67) // 2 of 3 keystrokes
  })

  it('counts a perfect two-word test', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['hello', 'world'], { now: () => t.v })
    e.insert('h')
    t.v = 12000
    type(e, 'ello world')
    const s = computeStats(e)
    expect(s.correctChars).toBe(11) // 5 + space + 5
    expect(s.wpm).toBe(11)
    expect(s.rawWpm).toBe(11)
    expect(s.accuracy).toBe(100)
  })

  it('counts incorrect, extra and missed characters', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['cat', 'dog', 'end'], { now: () => t.v })
    type(e, 'cattt do ')
    t.v = 6000
    e.stop()
    const s = computeStats(e)
    expect(s.correctChars).toBe(5) // c a t + d o
    expect(s.extraChars).toBe(2)
    expect(s.missedChars).toBe(1) // 'g'
    expect(s.incorrectChars).toBe(2) // the two Spaces that closed wrong words
  })

  it('does not count the word in progress as missed', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['hello', 'world'], { now: () => t.v })
    type(e, 'hel')
    t.v = 1000
    e.stop()
    const s = computeStats(e)
    expect(s.correctChars).toBe(3)
    expect(s.missedChars).toBe(0)
  })

  it('gives 100% accuracy in zen mode', () => {
    const t = { v: 0 }
    const e = new TypingEngine([], { free: true, now: () => t.v })
    type(e, 'free text')
    t.v = 3000
    e.stop()
    const s = computeStats(e)
    expect(s.accuracy).toBe(100)
    expect(s.correctChars).toBe(9)
  })

  it('live stats and final stats use the same rules', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['ab', 'cd'], { now: () => t.v })
    type(e, 'ab c')
    t.v = 3000
    const live = computeStats(e) // still running, clock at 3000
    e.stop()
    const fin = computeStats(e)
    expect(live).toEqual(fin)
  })

  it('stays within the time limit when computed after expiry', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa', 'bbb'], { now: () => t.v, timeLimitMs: 2000 })
    e.insert('a')
    t.v = 90000
    e.tick()
    expect(computeStats(e).elapsedMs).toBe(2000)
  })
})

describe('consistency', () => {
  it('is 100 for perfectly even typing', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['a'.repeat(40)], { now: () => t.v })
    for (let sec = 0; sec < 4; sec++) {
      for (let k = 0; k < 5; k++) {
        t.v = sec * 1000 + k * 100
        e.insert('a')
      }
    }
    t.v = 4000
    e.stop()
    const s = computeStats(e)
    expect(s.rawPerSecond).toEqual([60, 60, 60, 60])
    expect(s.correctPerSecond).toEqual([60, 60, 60, 60])
    expect(s.consistency).toBe(100)
  })

  it('is low for bursty typing and null for too little data', () => {
    const low = computeConsistency([120, 0, 120, 0])
    expect(low !== null && low < 50).toBe(true)
    expect(computeConsistency([60])).toBeNull()
    expect(computeConsistency([0, 0, 0])).toBeNull()
  })
})
