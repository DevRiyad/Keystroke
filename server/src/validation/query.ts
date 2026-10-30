import { parseLimit, type Validation } from './common'
import { DURATIONS, WORD_COUNTS } from './result'

export interface LeaderboardQuery {
  mode: 'time' | 'words'
  duration: number | null
  wordCount: number | null
  limit: number
}

export function validateLeaderboardQuery(q: Record<string, unknown>): Validation<LeaderboardQuery> {
  const errors: string[] = []
  const mode = q.mode === undefined ? 'time' : q.mode
  if (mode !== 'time' && mode !== 'words') errors.push('mode must be time or words')

  let duration: number | null = null
  let wordCount: number | null = null
  if (mode === 'time') {
    const raw = q.duration === undefined ? 60 : Number(q.duration)
    duration = DURATIONS.find((d) => d === raw) ?? null
    if (duration === null) errors.push(`duration must be one of ${DURATIONS.join(', ')}`)
  } else if (mode === 'words') {
    const raw = q.wordCount === undefined ? 25 : Number(q.wordCount)
    wordCount = WORD_COUNTS.find((n) => n === raw) ?? null
    if (wordCount === null) errors.push(`wordCount must be one of ${WORD_COUNTS.join(', ')}`)
  }
  const limit = parseLimit(q.limit, 20, 100)
  if (limit === null) errors.push('limit must be an integer between 1 and 100')

  if (errors.length > 0 || limit === null) return { ok: false, errors }
  return { ok: true, value: { mode: mode as 'time' | 'words', duration, wordCount, limit } }
}
