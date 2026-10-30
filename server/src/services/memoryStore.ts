import type { LeaderboardEntry, PublicResult, Store } from './store'
import type { SettingsData } from '../validation/settings'

/** In-memory Store for tests (and local experiments). Not used in production. */
export function createMemoryStore(): Store {
  const results: (PublicResult & { guestId: string })[] = []
  const settings = new Map<string, SettingsData>()
  let seq = 0

  return {
    async saveResult(guestId, r) {
      const row = { ...r, guestId, id: String(++seq), createdAt: new Date(1_700_000_000_000 + seq * 1000).toISOString() }
      results.push(row)
      const { guestId: _omit, ...pub } = row
      void _omit
      return pub
    },
    async history(guestId, limit) {
      return results
        .filter((r) => r.guestId === guestId)
        .reverse()
        .slice(0, limit)
        .map(({ guestId: _g, ...pub }) => {
          void _g
          return pub
        })
    },
    async leaderboard(q) {
      const best = new Map<string, PublicResult & { guestId: string }>()
      for (const r of results) {
        if (!r.leaderboard || r.mode !== q.mode) continue
        if (q.mode === 'time' ? r.duration !== q.duration : r.wordCount !== q.wordCount) continue
        const cur = best.get(r.guestId)
        if (!cur || r.wpm > cur.wpm) best.set(r.guestId, r)
      }
      return [...best.values()]
        .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy)
        .slice(0, q.limit)
        .map(
          (r, i): LeaderboardEntry => ({
            rank: i + 1,
            name: r.name,
            wpm: r.wpm,
            rawWpm: r.rawWpm,
            accuracy: r.accuracy,
            consistency: r.consistency,
            createdAt: r.createdAt,
          }),
        )
    },
    async getSettings(guestId) {
      return settings.get(guestId) ?? null
    },
    async putSettings(guestId, s) {
      settings.set(guestId, s)
    },
  }
}
