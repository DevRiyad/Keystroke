import { describe, expect, it } from 'vitest'
import { parseGuestId, parseLimit } from './common'
import { validateLeaderboardQuery } from './query'
import { validateResult } from './result'
import { validateSettings } from './settings'

const base = () => ({
  name: 'Ada',
  mode: 'time',
  duration: 60,
  punctuation: false,
  numbers: false,
  elapsedMs: 60000,
  correctChars: 300,
  incorrectChars: 5,
  extraChars: 1,
  missedChars: 2,
  correctKeystrokes: 310,
  incorrectKeystrokes: 10,
  consistency: 82.5,
  wpm: 60,
  rawWpm: 64,
  accuracy: 96.88,
})

const errorsOf = (body: unknown): string[] => {
  const r = validateResult(body)
  return r.ok ? [] : r.errors
}

describe('validateResult', () => {
  it('accepts a consistent result and recomputes the numbers on the server', () => {
    const r = validateResult({ ...base(), wpm: 60.4, rawWpm: 64.3 }) // within tolerance
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.wpm).toBe(60) // server value, not the claimed 60.4
      expect(r.value.rawWpm).toBe(64)
      expect(r.value.accuracy).toBe(96.88)
      expect(r.value.leaderboard).toBe(true)
      expect(r.value.name).toBe('Ada')
    }
  })

  it('rejects a wpm that does not match the submitted characters', () => {
    expect(errorsOf({ ...base(), wpm: 150 }).some((e) => e.includes('wpm does not match'))).toBe(true)
  })

  it('rejects accuracy and raw wpm that do not match the keystrokes', () => {
    expect(errorsOf({ ...base(), accuracy: 100 }).some((e) => e.includes('accuracy'))).toBe(true)
    expect(errorsOf({ ...base(), rawWpm: 200 }).some((e) => e.includes('rawWpm'))).toBe(true)
  })

  it('rejects implausible speed and keystroke rates', () => {
    const fast = { ...base(), correctChars: 2000, correctKeystrokes: 2010, incorrectKeystrokes: 0, wpm: 400, rawWpm: 402, accuracy: 100 }
    expect(errorsOf(fast).some((e) => e.includes('plausible maximum'))).toBe(true)
    const bursts = { ...base(), correctKeystrokes: 1700, incorrectKeystrokes: 0, correctChars: 300, wpm: 60, rawWpm: 340, accuracy: 100 }
    expect(errorsOf(bursts).some((e) => e.includes('not humanly plausible'))).toBe(true)
  })

  it('rejects more correct characters than correct keystrokes', () => {
    expect(errorsOf({ ...base(), correctChars: 400, correctKeystrokes: 310 }).length > 0).toBe(true)
  })

  it('checks time-mode duration against elapsed time', () => {
    expect(errorsOf({ ...base(), elapsedMs: 30000 }).some((e) => e.includes('duration'))).toBe(true)
    expect(errorsOf({ ...base(), duration: 45 }).some((e) => e.includes('duration must be'))).toBe(true)
  })

  it('validates types and ranges (strings, negatives, NaN-like, huge numbers)', () => {
    expect(errorsOf({ ...base(), correctChars: '300' }).length > 0).toBe(true)
    expect(errorsOf({ ...base(), incorrectChars: -1 }).length > 0).toBe(true)
    expect(errorsOf({ ...base(), elapsedMs: null }).length > 0).toBe(true)
    expect(errorsOf({ ...base(), extraChars: 1e12 }).length > 0).toBe(true)
    expect(errorsOf({ ...base(), consistency: 101 }).length > 0).toBe(true)
    expect(errorsOf({ ...base(), mode: 'hax' }).length > 0).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(errorsOf(null).length).toBe(1)
    expect(errorsOf([]).length).toBe(1)
    expect(errorsOf('x').length).toBe(1)
  })

  it('requires at least one keystroke', () => {
    expect(
      errorsOf({ ...base(), correctChars: 0, correctKeystrokes: 0, incorrectKeystrokes: 0, wpm: 0, rawWpm: 0, accuracy: 0 }).length > 0,
    ).toBe(true)
  })

  it('validates and sanitizes the nickname', () => {
    expect(errorsOf({ ...base(), name: '<script>alert(1)</script>' }).some((e) => e.includes('name'))).toBe(true)
    expect(errorsOf({ ...base(), name: 'x'.repeat(21) }).some((e) => e.includes('name'))).toBe(true)
    const r = validateResult({ ...base(), name: '  Ada   L.  ' })
    expect(r.ok && r.value.name).toBe('Ada L.')
    const anon = validateResult({ ...base(), name: undefined })
    expect(anon.ok && anon.value.name).toBe('anonymous')
  })

  it('keeps zen and custom results out of the leaderboard', () => {
    const z = validateResult({ ...base(), mode: 'zen', duration: undefined, punctuation: true })
    expect(z.ok && z.value.leaderboard).toBe(false)
    expect(z.ok && z.value.punctuation).toBe(false)
    const w = validateResult({ ...base(), mode: 'words', wordCount: 25, duration: undefined, elapsedMs: 20000, correctChars: 100, correctKeystrokes: 105, incorrectKeystrokes: 0, wpm: 60, rawWpm: 63, accuracy: 100 })
    expect(w.ok && w.value.leaderboard).toBe(true)
    expect(w.ok && w.value.wordCount).toBe(25)
  })
})

describe('validateSettings', () => {
  const ok = {
    theme: 'dark',
    fontSize: 'large',
    font: 'system',
    cursorStyle: 'block',
    cursorAnimation: false,
    typingMode: 'strict',
    sound: false,
    blind: true,
    liveWpm: true,
    confirmRestart: false,
  }
  it('accepts a full valid object and drops unknown fields', () => {
    const r = validateSettings({ ...ok, evil: '$where' })
    expect(r.ok).toBe(true)
    expect(r.ok && 'evil' in r.value).toBe(false)
  })
  it('rejects invalid or missing fields', () => {
    expect(validateSettings({ ...ok, theme: 'neon' }).ok).toBe(false)
    expect(validateSettings({ ...ok, sound: 'yes' }).ok).toBe(false)
    expect(validateSettings({ theme: 'dark' }).ok).toBe(false)
    expect(validateSettings(null).ok).toBe(false)
  })
})

describe('query and header parsing', () => {
  it('leaderboard query defaults and validation', () => {
    expect(validateLeaderboardQuery({})).toEqual({ ok: true, value: { mode: 'time', duration: 60, wordCount: null, limit: 20 } })
    expect(validateLeaderboardQuery({ mode: 'words', wordCount: '50', limit: '5' })).toEqual({
      ok: true,
      value: { mode: 'words', duration: null, wordCount: 50, limit: 5 },
    })
    expect(validateLeaderboardQuery({ mode: 'zen' }).ok).toBe(false)
    expect(validateLeaderboardQuery({ duration: '45' }).ok).toBe(false)
    expect(validateLeaderboardQuery({ limit: '0' }).ok).toBe(false)
    expect(validateLeaderboardQuery({ limit: '101' }).ok).toBe(false)
    expect(validateLeaderboardQuery({ mode: ['time', 'words'] }).ok).toBe(false)
  })
  it('parseLimit', () => {
    expect(parseLimit(undefined, 50, 100)).toBe(50)
    expect(parseLimit('10', 50, 100)).toBe(10)
    expect(parseLimit('abc', 50, 100)).toBeNull()
    expect(parseLimit('-1', 50, 100)).toBeNull()
  })
  it('parseGuestId accepts random ids and rejects junk', () => {
    expect(parseGuestId('3f2b8c1e-7a4d-4e1b-9c3a-0d5e6f7a8b9c')).toBe('3f2b8c1e-7a4d-4e1b-9c3a-0d5e6f7a8b9c')
    expect(parseGuestId('short')).toBeNull()
    expect(parseGuestId('{"$ne":""}')).toBeNull()
    expect(parseGuestId(undefined)).toBeNull()
    expect(parseGuestId('a'.repeat(65))).toBeNull()
  })
})
