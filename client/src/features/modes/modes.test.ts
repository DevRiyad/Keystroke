import { describe, expect, it } from 'vitest'
import { TypingEngine } from '../typing/engine'
import { buildTest, configKey, DEFAULT_CONFIG, MAX_CUSTOM_CHARS, normalizeCustomText, type TestConfig } from './config'
import { generateWords } from './words'
import { QUOTES } from './quotes'

const lcg = (seed = 1) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
const cfg = (patch: Partial<TestConfig>): TestConfig => ({ ...DEFAULT_CONFIG, ...patch })

describe('generateWords', () => {
  it('returns the requested number of lowercase words by default', () => {
    const w = generateWords({ count: 50, rng: lcg(3) })
    expect(w.length).toBe(50)
    expect(w.every((x) => /^[a-z]+$/.test(x))).toBe(true)
  })

  it('avoids repeating a word within the last three', () => {
    const w = generateWords({ count: 300, rng: lcg(7) })
    let repeats = 0
    for (let i = 1; i < w.length; i++) if (w.slice(Math.max(0, i - 3), i).includes(w[i])) repeats++
    expect(repeats).toBe(0)
  })

  it('adds punctuation and capitalizes after sentence ends', () => {
    const w = generateWords({ count: 300, punctuation: true, rng: lcg(11) })
    expect(/^[A-Z]/.test(w[0])).toBe(true)
    expect(w.some((x) => /[.,?!]$/.test(x))).toBe(true)
    for (let i = 1; i < w.length; i++) if (/[.?!]$/.test(w[i - 1])) expect(/^[A-Z]/.test(w[i])).toBe(true)
  })

  it('adds numbers only when enabled', () => {
    const on = generateWords({ count: 300, numbers: true, rng: lcg(5) })
    const off = generateWords({ count: 300, rng: lcg(5) })
    expect(on.some((x) => /^[0-9]+$/.test(x))).toBe(true)
    expect(off.some((x) => /[0-9]/.test(x))).toBe(false)
  })
})

describe('normalizeCustomText', () => {
  it('rejects empty and whitespace-only input', () => {
    expect(normalizeCustomText('').ok).toBe(false)
    expect(normalizeCustomText('  \n\t ').ok).toBe(false)
  })
  it('collapses whitespace and strips control characters', () => {
    expect(normalizeCustomText('  hello \n\n world\t!\u0007 ')).toEqual({ ok: true, text: 'hello world !' })
  })
  it('rejects excessively long text and giant words', () => {
    expect(normalizeCustomText('a '.repeat(MAX_CUSTOM_CHARS)).ok).toBe(false)
    expect(normalizeCustomText('x'.repeat(41)).ok).toBe(false)
  })
})

describe('buildTest (mode switching)', () => {
  it('time mode: sets the limit, has a refill and a fresh word buffer', () => {
    const t = buildTest(cfg({ mode: 'time', duration: 30 }), lcg(1))
    expect(t.options.timeLimitMs).toBe(30000)
    expect(typeof t.options.refill).toBe('function')
    expect(t.words.length).toBe(100)
  })
  it('words mode: exact word count, no limit', () => {
    const t = buildTest(cfg({ mode: 'words', wordCount: 25 }), lcg(1))
    expect(t.words.length).toBe(25)
    expect(t.options.timeLimitMs === undefined).toBe(true)
  })
  it('quote mode: a known quote, and avoids repeating the previous one', () => {
    const t = buildTest(cfg({ mode: 'quote' }), lcg(2))
    expect(QUOTES.some((q) => q.text === t.words.join(' '))).toBe(true)
    for (let i = 0; i < 20; i++) {
      const next = buildTest(cfg({ mode: 'quote' }), lcg(i), t.words.join(' '))
      expect(next.words.join(' ') === t.words.join(' ')).toBe(false)
    }
  })
  it('custom mode: splits the user text', () => {
    expect(buildTest(cfg({ mode: 'custom', customText: 'one two three' })).words).toEqual(['one', 'two', 'three'])
  })
  it('zen mode: free typing', () => {
    const t = buildTest(cfg({ mode: 'zen' }))
    expect(t.options.free).toBe(true)
    expect(t.words).toEqual([''])
  })
  it('a new engine after a mode change carries nothing over', () => {
    const a = buildTest(cfg({ mode: 'words', wordCount: 10 }), lcg(1))
    const ea = new TypingEngine(a.words, a.options)
    ea.insert(a.words[0][0])
    const b = buildTest(cfg({ mode: 'time', duration: 15 }), lcg(2))
    const eb = new TypingEngine(b.words, b.options)
    expect(eb.status).toBe('idle')
    expect(eb.startedAt).toBeNull()
    expect(eb.timeLimitMs).toBe(15000)
    expect(eb.correctKeys + eb.incorrectKeys).toBe(0)
  })
  it('configKey changes with every setting that resets the test', () => {
    const base = configKey(DEFAULT_CONFIG)
    expect(configKey(cfg({ duration: 30 })) === base).toBe(false)
    expect(configKey(cfg({ punctuation: true })) === base).toBe(false)
    expect(configKey(cfg({ numbers: true })) === base).toBe(false)
    expect(configKey(cfg({ mode: 'zen' })) === base).toBe(false)
    expect(configKey({ ...DEFAULT_CONFIG }) === base).toBe(true)
  })
})
