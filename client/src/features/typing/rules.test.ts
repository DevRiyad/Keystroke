import { describe, expect, it } from 'vitest'
import { TypingEngine } from './engine'
import { computeStats } from './stats'

const type = (e: TypingEngine, s: string) => {
  for (const ch of s) e.insert(ch)
}

describe('strict mode', () => {
  it('rejects wrong keys but counts them as mistakes', () => {
    const e = new TypingEngine(['cat'], { strict: true })
    expect(e.insert('x')).toBe(false)
    expect(e.inputs[0]).toBe('')
    expect(e.status).toBe('running') // a wrong first key still starts the test
    expect(e.incorrectKeys).toBe(1)
    expect(e.insert('c')).toBe(true)
    expect(e.inputs[0]).toBe('c')
  })

  it('rejects extra characters and Space on an unfinished word', () => {
    const e = new TypingEngine(['ab', 'cd'], { strict: true })
    type(e, 'a ')
    expect(e.wordIndex).toBe(0)
    type(e, 'b')
    expect(e.insert('z')).toBe(false)
    expect(e.inputs[0]).toBe('ab')
    e.insert(' ')
    expect(e.wordIndex).toBe(1)
  })

  it('lowers accuracy through rejected keys', () => {
    const t = { v: 0 }
    const e = new TypingEngine(['ab'], { strict: true, now: () => t.v })
    e.insert('a')
    t.v = 1000
    e.insert('x')
    t.v = 2000
    e.insert('b')
    expect(computeStats(e).accuracy).toBe(66.67)
  })

  it('can be switched on mid-test with setRules', () => {
    const e = new TypingEngine(['ab'])
    e.insert('a')
    e.setRules({ strict: true })
    expect(e.insert('x')).toBe(false)
    e.setRules({ strict: false })
    expect(e.insert('x')).toBe(true)
  })
})

describe('confidence mode', () => {
  it('never returns to a previous word', () => {
    const e = new TypingEngine(['ab', 'cd'], { confidence: true })
    type(e, 'ax ')
    expect(e.wordIndex).toBe(1)
    expect(e.backspace()).toBe(false)
    expect(e.deleteWord()).toBe(false)
    expect(e.wordIndex).toBe(1)
  })

  it('still allows corrections inside the current word', () => {
    const e = new TypingEngine(['ab'], { confidence: true })
    type(e, 'ax')
    expect(e.backspace()).toBe(true)
    expect(e.inputs[0]).toBe('a')
  })
})
