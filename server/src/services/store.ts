import type { LeaderboardQuery } from '../validation/query'
import type { SettingsData } from '../validation/settings'
import type { ValidatedResult } from '../validation/result'

/** What clients may see. Never includes the guest id. */
export interface PublicResult extends ValidatedResult {
  id: string
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  name: string
  wpm: number
  rawWpm: number
  accuracy: number
  consistency: number | null
  createdAt: string
}

/** Persistence boundary: Mongo in production, an in-memory fake in tests. */
export interface Store {
  saveResult(guestId: string, result: ValidatedResult): Promise<PublicResult>
  history(guestId: string, limit: number): Promise<PublicResult[]>
  leaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]>
  getSettings(guestId: string): Promise<SettingsData | null>
  putSettings(guestId: string, settings: SettingsData): Promise<void>
}
