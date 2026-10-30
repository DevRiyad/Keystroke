import { describe, expect, it } from 'vitest'
import { REFILL_CHUNK, TypingEngine } from './engine'

const type = (e: TypingEngine, s: string) => {
  for (const ch of s) e.insert(ch)
}

describe('time limit', () => {
  it('finishes exactly at startedAt + limit when the clock is checked', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa', 'bbb', 'ccc'], { now: () => t.v, timeLimitMs: 5000 })
    t.v = 1000
    e.insert('a')
    t.v = 5999
    e.tick()
    expect(e.status).toBe('running')
    t.v = 6000
    e.tick()
    expect(e.status).toBe('finished')
    expect(e.finishedAt).toBe(6000)
    expect(e.elapsedMs()).toBe(5000)
  })

  it('uses the clock, not tick counts (late callback in a throttled tab)', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa', 'bbb'], { now: () => t.v, timeLimitMs: 5000 })
    t.v = 1000
    e.insert('a')
    t.v = 60000 // tab was throttled; first tick arrives a minute later
    e.tick()
    expect(e.status).toBe('finished')
    expect(e.finishedAt).toBe(6000)
    expect(e.elapsedMs()).toBe(5000)
  })

  it('rejects a key that arrives after expiry', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa', 'bbb'], { now: () => t.v, timeLimitMs: 1000 })
    e.insert('a')
    t.v = 1500
    expect(e.insert('a')).toBe(false)
    expect(e.status).toBe('finished')
    expect(e.inputs[0]).toBe('a')
    expect(e.finishedAt).toBe(1000)
  })

  it('does not start the clock before the first keystroke', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa'], { now: () => t.v, timeLimitMs: 1000 })
    t.v = 99999
    e.tick()
    expect(e.status).toBe('idle')
    expect(e.elapsedMs()).toBe(0)
  })

  it('notifies listeners when time runs out', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['aaa'], { now: () => t.v, timeLimitMs: 1000 })
    let n = 0
    e.insert('a')
    e.subscribe(() => n++)
    t.v = 1000
    e.tick()
    expect(n).toBe(1)
    e.tick() // already finished: no duplicate notification
    expect(n).toBe(1)
  })
})

describe('refill (time mode)', () => {
  it('appends words when fewer than the threshold remain', () => {
    const words = Array.from({ length: 35 }, () => 'a')
    let calls = 0
    const e = new TypingEngine(words, {
      timeLimitMs: 60000,
      refill: (n) => {
        calls++
        return Array.from({ length: n }, () => 'z')
      },
    })
    type(e, 'a '.repeat(5)) // 30 left -> not below threshold yet
    expect(calls).toBe(0)
    type(e, 'a ')
    expect(calls).toBe(1)
    expect(e.words.length).toBe(35 + REFILL_CHUNK)
    expect(e.inputs.length).toBe(e.words.length)
  })
})

describe('stop / early termination', () => {
  it('stops a running test and keeps the clock', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['abc', 'def'], { now: () => t.v })
    e.insert('a')
    t.v = 800
    e.stop()
    expect(e.status).toBe('finished')
    expect(e.elapsedMs()).toBe(800)
  })

  it('does nothing when idle', () => {
    const e = new TypingEngine(['abc'])
    e.stop()
    expect(e.status).toBe('idle')
  })
})

describe('free (zen) mode', () => {
  it('treats everything typed as correct and grows the word list', () => {
    const e = new TypingEngine([], { free: true })
    type(e, 'hi yo')
    expect(e.words).toEqual(['hi', 'yo'])
    expect(e.inputs).toEqual(['hi', 'yo'])
    expect(e.status).toBe('running')
    expect(e.incorrectKeys).toBe(0)
  })

  it('never auto-finishes and can go back to a previous word', () => {
    const e = new TypingEngine([], { free: true })
    type(e, 'hi ')
    expect(e.backspace()).toBe(true)
    expect(e.wordIndex).toBe(0)
    expect(e.status).toBe('running')
  })

  it('reset clears the typed text', () => {
    const e = new TypingEngine([], { free: true })
    type(e, 'hi yo')
    e.reset()
    expect(e.words).toEqual([''])
    expect(e.status).toBe('idle')
  })
})

describe('keystroke log', () => {
  it('records correctness and ignores Backspace', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['ab', 'cd'], { now: () => t.v })
    e.insert('a')
    t.v = 100
    e.insert('x')
    e.backspace()
    t.v = 250
    e.insert('b')
    expect(e.strokeTimes).toEqual([0, 100, 250])
    expect(e.strokeOk).toEqual([true, false, true])
    expect(e.correctKeys).toBe(2)
    expect(e.incorrectKeys).toBe(1)
  })

  it('clears on reset', () => {
    const e = new TypingEngine(['ab'])
    e.insert('a')
    e.reset()
    expect(e.strokeTimes).toEqual([])
    expect(e.correctKeys).toBe(0)
  })
})
