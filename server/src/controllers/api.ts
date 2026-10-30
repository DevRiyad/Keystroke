import type { Request, Response } from 'express'
import { badRequest } from '../errors'
import type { Store } from '../services/store'
import { parseLimit } from '../validation/common'
import { validateLeaderboardQuery } from '../validation/query'
import { validateResult } from '../validation/result'
import { validateSettings } from '../validation/settings'

const guest = (res: Response) => res.locals.guestId as string

export function createController(store: Store) {
  return {
    async saveResult(req: Request, res: Response) {
      const v = validateResult(req.body)
      if (!v.ok) throw badRequest('Invalid result', v.errors)
      const saved = await store.saveResult(guest(res), v.value)
      res.status(201).json({ result: saved })
    },

    async history(req: Request, res: Response) {
      const limit = parseLimit(req.query.limit, 50, 100)
      if (limit === null) throw badRequest('limit must be an integer between 1 and 100')
      res.json({ results: await store.history(guest(res), limit) })
    },

    async leaderboard(req: Request, res: Response) {
      const v = validateLeaderboardQuery(req.query as Record<string, unknown>)
      if (!v.ok) throw badRequest('Invalid query', v.errors)
      res.json({ entries: await store.leaderboard(v.value) })
    },

    async getSettings(_req: Request, res: Response) {
      res.json({ settings: await store.getSettings(guest(res)) })
    },

    async putSettings(req: Request, res: Response) {
      const v = validateSettings(req.body)
      if (!v.ok) throw badRequest('Invalid settings', v.errors)
      await store.putSettings(guest(res), v.value)
      res.json({ settings: v.value })
    },
  }
}
