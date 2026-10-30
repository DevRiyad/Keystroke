import { isRecord, round2, type Validation } from './common'

export const MODES = ['time', 'words', 'quote', 'zen', 'custom'] as const
export const DURATIONS = [15, 30, 60, 120] as const
export const WORD_COUNTS = [10, 25, 50, 100, 200] as const
export type Mode = (typeof MODES)[number]

/** Plausibility limits. They stop garbage, not determined cheaters (see README). */
export const LIMITS = {
  maxWpm: 350,
  maxKeysPerSecond: 25,
  minElapsedMs: 1000,
  maxElapsedMs: 3_600_000,
  maxCount: 1_000_000,
  wpmTolerance: 1,
  accuracyTolerance: 0.5,
  timeModeToleranceMs: 500,
  nameMax: 20,
} as const

export interface ValidatedResult {
  name: string
  mode: Mode
  duration: number | null
  wordCount: number | null
  punctuation: boolean
  numbers: boolean
  elapsedMs: number
  correctChars: number
  incorrectChars: number
  extraChars: number
  missedChars: number
  correctKeystrokes: number
  incorrectKeystrokes: number
  consistency: number | null
  /** Recomputed by the server from the counts above (client values are only cross-checked). */
  wpm: number
  rawWpm: number
  accuracy: number
  /** Eligible for the public leaderboard (fixed, comparable tests only). */
  leaderboard: boolean
}

const NAME_PATTERN = /^[A-Za-z0-9 _.\-]+$/

function count(body: Record<string, unknown>, key: string, errors: string[]): number {
  const v = body[key]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > LIMITS.maxCount) {
    errors.push(`${key} must be an integer between 0 and ${LIMITS.maxCount}`)
    return 0
  }
  return v
}

function num(body: Record<string, unknown>, key: string, errors: string[]): number {
  const v = body[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${key} must be a number`)
    return 0
  }
  return v
}

export function validateResult(body: unknown): Validation<ValidatedResult> {
  if (!isRecord(body)) return { ok: false, errors: ['body must be a JSON object'] }
  const errors: string[] = []

  const mode = MODES.find((m) => m === body.mode)
  if (!mode) errors.push(`mode must be one of ${MODES.join(', ')}`)

  let duration: number | null = null
  let wordCount: number | null = null
  if (mode === 'time') {
    duration = DURATIONS.find((d) => d === body.duration) ?? null
    if (duration === null) errors.push(`duration must be one of ${DURATIONS.join(', ')} for time mode`)
  } else if (mode === 'words') {
    wordCount = WORD_COUNTS.find((n) => n === body.wordCount) ?? null
    if (wordCount === null) errors.push(`wordCount must be one of ${WORD_COUNTS.join(', ')} for words mode`)
  }

  let name = 'anonymous'
  if (body.name !== undefined && body.name !== null && body.name !== '') {
    if (typeof body.name !== 'string') errors.push('name must be a string')
    else {
      const n = body.name.trim().replace(/\s+/g, ' ')
      if (n.length > LIMITS.nameMax || !NAME_PATTERN.test(n)) {
        errors.push(`name must be at most ${LIMITS.nameMax} characters: letters, digits, space, _ . -`)
      } else if (n) name = n
    }
  }

  const elapsedMs = num(body, 'elapsedMs', errors)
  const correctChars = count(body, 'correctChars', errors)
  const incorrectChars = count(body, 'incorrectChars', errors)
  const extraChars = count(body, 'extraChars', errors)
  const missedChars = count(body, 'missedChars', errors)
  const ck = count(body, 'correctKeystrokes', errors)
  const ik = count(body, 'incorrectKeystrokes', errors)
  const claimedWpm = num(body, 'wpm', errors)
  const claimedRaw = num(body, 'rawWpm', errors)
  const claimedAcc = num(body, 'accuracy', errors)

  let consistency: number | null = null
  if (body.consistency !== null && body.consistency !== undefined) {
    const c = body.consistency
    if (typeof c !== 'number' || !Number.isFinite(c) || c < 0 || c > 100) errors.push('consistency must be null or a number from 0 to 100')
    else consistency = c
  }

  if (errors.length > 0) return { ok: false, errors }

  // ---- plausibility and cross-checks (all on numbers we validated above)
  if (elapsedMs < LIMITS.minElapsedMs || elapsedMs > LIMITS.maxElapsedMs) {
    errors.push(`elapsedMs must be between ${LIMITS.minElapsedMs} and ${LIMITS.maxElapsedMs}`)
  }
  if (mode === 'time' && duration !== null && Math.abs(elapsedMs - duration * 1000) > LIMITS.timeModeToleranceMs) {
    errors.push('elapsedMs does not match the time-mode duration')
  }
  const totalKeys = ck + ik
  if (totalKeys < 1) errors.push('at least one keystroke is required')
  if (correctChars > ck) errors.push('correctChars cannot exceed correctKeystrokes')
  if (errors.length > 0) return { ok: false, errors }

  const minutes = elapsedMs / 60000
  const wpm = round2(correctChars / 5 / minutes)
  const rawWpm = round2(totalKeys / 5 / minutes)
  const accuracy = round2((ck / totalKeys) * 100)

  if (wpm > LIMITS.maxWpm) errors.push(`wpm above the plausible maximum of ${LIMITS.maxWpm}`)
  if (totalKeys / (elapsedMs / 1000) > LIMITS.maxKeysPerSecond) errors.push('keystroke rate is not humanly plausible')
  if (Math.abs(claimedWpm - wpm) > LIMITS.wpmTolerance) errors.push('wpm does not match the submitted characters and time')
  if (Math.abs(claimedRaw - rawWpm) > LIMITS.wpmTolerance) errors.push('rawWpm does not match the submitted keystrokes and time')
  if (Math.abs(claimedAcc - accuracy) > LIMITS.accuracyTolerance) errors.push('accuracy does not match the submitted keystrokes')
  if (errors.length > 0) return { ok: false, errors }

  const fixed = mode === 'time' || mode === 'words'
  return {
    ok: true,
    value: {
      name,
      mode: mode as Mode,
      duration,
      wordCount,
      punctuation: fixed && body.punctuation === true,
      numbers: fixed && body.numbers === true,
      elapsedMs,
      correctChars,
      incorrectChars,
      extraChars,
      missedChars,
      correctKeystrokes: ck,
      incorrectKeystrokes: ik,
      consistency,
      wpm,
      rawWpm,
      accuracy,
      leaderboard: fixed && wpm > 0,
    },
  }
}
