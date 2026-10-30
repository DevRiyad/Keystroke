import cors from 'cors'
import express, { type Express, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { Env } from './config/env'
import { silentLogger, type Logger } from './config/logger'
import { createController } from './controllers/api'
import { errorBody, HttpError } from './errors'
import { errorHandler, notFound } from './middleware/errorHandler'
import { originGuard, requireDb, requireGuest, wrap } from './middleware/guards'
import type { Store } from './services/store'

export interface AppDeps {
  env: Env
  store: Store
  isDbReady: () => boolean
  logger?: Logger
}

export function createApp({ env, store, isDbReady, logger = silentLogger }: AppDeps): Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.trustProxy)

  // request log: method, path (no query string), status, duration. Never bodies or headers.
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => logger.log('info', 'request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }))
    next()
  })

  // API responses are JSON only: forbid sniffing/framing/caching and give them an empty CSP.
  app.use('/api', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    next()
  })
  app.use('/api', originGuard(env.clientOrigins))
  // Writes must be JSON (blocks form-style cross-site posts and gives clear errors).
  app.use('/api', (req, _res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && !/^application\/json\b/i.test(req.headers['content-type'] ?? '')) {
      return next(new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json'))
    }
    next()
  })
  app.use(
    cors({
      origin: env.clientOrigins, // same-origin requests need no CORS headers
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Guest-Id'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '10kb' }))

  // health is never rate limited or database gated: it reports the database state instead
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', database: isDbReady() ? 'up' : 'down', uptimeSeconds: Math.round(process.uptime()) })
  })

  const tooMany = (_req: Request, res: Response) => {
    res.status(429).json(errorBody('rate_limited', 'Too many requests, slow down'))
  }
  const limiter = (max: number) =>
    rateLimit({ windowMs: env.rateLimitWindowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, handler: tooMany })
  const readLimit = limiter(env.rateLimitMax)
  const writeLimit = limiter(env.writeLimitMax)

  const c = createController(store)
  const db = requireDb(isDbReady)

  app.get('/api/leaderboard', readLimit, db, wrap(c.leaderboard))
  app.get('/api/history', readLimit, db, requireGuest, wrap(c.history))
  app.get('/api/settings', readLimit, db, requireGuest, wrap(c.getSettings))
  app.post('/api/results', writeLimit, db, requireGuest, wrap(c.saveResult))
  app.put('/api/settings', writeLimit, db, requireGuest, wrap(c.putSettings))

  app.use(notFound)
  app.use(errorHandler(logger))
  return app
}
