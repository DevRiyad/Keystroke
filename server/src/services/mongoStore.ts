import type { Store, PublicResult, LeaderboardEntry } from './store'
import { GuestSettingsModel } from '../models/GuestSettings'
import { ResultModel } from '../models/Result'
import type { ValidatedResult } from '../validation/result'
import type { SettingsData } from '../validation/settings'

interface ResultDoc extends ValidatedResult {
  _id: { toString(): string }
  createdAt: Date
}

const toPublic = (d: ResultDoc): PublicResult => ({
  id: d._id.toString(),
  name: d.name,
  mode: d.mode,
  duration: d.duration,
  wordCount: d.wordCount,
  punctuation: d.punctuation,
  numbers: d.numbers,
  elapsedMs: d.elapsedMs,
  correctChars: d.correctChars,
  incorrectChars: d.incorrectChars,
  extraChars: d.extraChars,
  missedChars: d.missedChars,
  correctKeystrokes: d.correctKeystrokes,
  incorrectKeystrokes: d.incorrectKeystrokes,
  consistency: d.consistency,
  wpm: d.wpm,
  rawWpm: d.rawWpm,
  accuracy: d.accuracy,
  leaderboard: d.leaderboard,
  createdAt: d.createdAt.toISOString(),
})

// All filter values come from validators (typed primitives / enums), never raw request objects.
export const mongoStore: Store = {
  async saveResult(guestId, result) {
    const doc = await ResultModel.create({ guestId, ...result })
    return toPublic(doc.toObject() as unknown as ResultDoc)
  },

  async history(guestId, limit) {
    const docs = await ResultModel.find({ guestId }).sort({ createdAt: -1 }).limit(limit).lean()
    return (docs as unknown as ResultDoc[]).map(toPublic)
  },

  async leaderboard(q) {
    const match: Record<string, unknown> = { leaderboard: true, mode: q.mode }
    if (q.mode === 'time') match.duration = q.duration
    else match.wordCount = q.wordCount
    const order = { wpm: -1, accuracy: -1, createdAt: 1 } as const
    const rows = await ResultModel.aggregate<{
      name: string
      wpm: number
      rawWpm: number
      accuracy: number
      consistency: number | null
      createdAt: Date
    }>([
      { $match: match },
      { $sort: order },
      { $group: { _id: '$guestId', doc: { $first: '$$ROOT' } } }, // best result per guest
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: order },
      { $limit: q.limit },
      { $project: { _id: 0, name: 1, wpm: 1, rawWpm: 1, accuracy: 1, consistency: 1, createdAt: 1 } },
    ])
    return rows.map(
      (r, i): LeaderboardEntry => ({
        rank: i + 1,
        name: r.name,
        wpm: r.wpm,
        rawWpm: r.rawWpm,
        accuracy: r.accuracy,
        consistency: r.consistency,
        createdAt: r.createdAt.toISOString(),
      }),
    )
  },

  async getSettings(guestId) {
    const doc = await GuestSettingsModel.findOne({ guestId }).lean()
    return doc ? (doc.data as SettingsData) : null
  },

  async putSettings(guestId, settings) {
    await GuestSettingsModel.findOneAndUpdate({ guestId }, { $set: { data: settings } }, { upsert: true })
  },
}
