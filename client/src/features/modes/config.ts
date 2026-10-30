import type { EngineOptions } from '../typing/engine'
import { generateWords } from './words'
import { QUOTES } from './quotes'

export type Mode = 'time' | 'words' | 'quote' | 'zen' | 'custom'

export const DURATIONS = [15, 30, 60, 120] as const
export const WORD_COUNTS = [10, 25, 50, 100, 200] as const
export const MAX_CUSTOM_CHARS = 3000
export const MAX_CUSTOM_WORD_LENGTH = 40
export const INITIAL_TIME_WORDS = 100

export interface TestConfig {
  mode: Mode
  duration: number
  wordCount: number
  punctuation: boolean
  numbers: boolean
  customText: string
}

export const DEFAULT_CONFIG: TestConfig = {
  mode: 'time',
  duration: 60,
  wordCount: 25,
  punctuation: false,
  numbers: false,
  customText: '',
}

export function supportsTextOptions(mode: Mode): boolean {
  return mode === 'time' || mode === 'words'
}

/** Changing any of these fields resets the test (a fresh engine is created). */
export function configKey(c: TestConfig): string {
  return [c.mode, c.duration, c.wordCount, c.punctuation, c.numbers, c.customText].join('|')
}

export type CustomTextResult = { ok: true; text: string } | { ok: false; error: string }

export function normalizeCustomText(raw: string): CustomTextResult {
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f\u200b]/g, ' ').replace(/\s+/g, ' ').trim()
  if (text === '') return { ok: false, error: 'Enter some text to practice.' }
  if (text.length > MAX_CUSTOM_CHARS) {
    return { ok: false, error: `Text is too long (${text.length} characters, max ${MAX_CUSTOM_CHARS}).` }
  }
  if (text.split(' ').some((w) => w.length > MAX_CUSTOM_WORD_LENGTH)) {
    return { ok: false, error: `A word is longer than ${MAX_CUSTOM_WORD_LENGTH} characters.` }
  }
  return { ok: true, text }
}

export interface BuiltTest {
  words: string[]
  options: EngineOptions
}

/** Turn a config into the words + engine options for that mode. `avoid` prevents repeating the same quote. */
export function buildTest(config: TestConfig, rng: () => number = Math.random, avoid?: string): BuiltTest {
  const gen = (count: number, recent?: string[]) =>
    generateWords({ count, punctuation: config.punctuation, numbers: config.numbers, rng, recent })

  switch (config.mode) {
    case 'time':
      return {
        words: gen(INITIAL_TIME_WORDS),
        options: { timeLimitMs: config.duration * 1000, refill: (n, recent) => gen(n, recent) },
      }
    case 'words':
      return { words: gen(config.wordCount), options: {} }
    case 'quote': {
      const pool = QUOTES.filter((q) => q.text !== avoid)
      const q = (pool.length > 0 ? pool : QUOTES)[Math.floor(rng() * (pool.length > 0 ? pool.length : QUOTES.length))]
      return { words: q.text.split(' '), options: {} }
    }
    case 'custom':
      return { words: config.customText.split(' ').filter(Boolean), options: {} }
    case 'zen':
      return { words: [''], options: { free: true } }
  }
}

/** Short label for results / sharing, e.g. "time 60 · punctuation". */
export function describeConfig(c: TestConfig): string {
  const parts: string[] = []
  if (c.mode === 'time') parts.push(`time ${c.duration}`)
  else if (c.mode === 'words') parts.push(`words ${c.wordCount}`)
  else parts.push(c.mode)
  if (supportsTextOptions(c.mode)) {
    if (c.punctuation) parts.push('punctuation')
    if (c.numbers) parts.push('numbers')
  }
  return parts.join(' · ')
}
