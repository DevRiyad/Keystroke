import mongoose from 'mongoose'
import type { Logger } from './logger'
import { redact } from './logger'

export function isDbReady(): boolean {
  return mongoose.connection.readyState === 1
}

let connecting: Promise<void> | null = null

/**
 * Serverless variant (Vercel): connect lazily on the first request of an instance and reuse the
 * connection while the instance is warm. No background timers (they do not survive between invocations).
 */
export async function ensureDbConnection(uri: string | null, logger: Logger): Promise<void> {
  if (!uri || isDbReady()) return
  if (!connecting) {
    mongoose.set('bufferCommands', false)
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 })
      .then(() => undefined)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        logger.log('error', `database connection failed: ${redact(msg).slice(0, 200)}`)
      })
  }
  try {
    await connecting
  } finally {
    if (!isDbReady()) connecting = null // try again on the next request
  }
}

/**
 * Connect in the background. The HTTP server never waits for (or dies because of) the database:
 * if the first attempt fails it retries with backoff, and Mongoose reconnects by itself later.
 */
export function startDbConnection(uri: string | null, logger: Logger): { stop: () => Promise<void> } {
  if (!uri) {
    logger.log('warn', 'MONGODB_URI is not set: running without persistence')
    return { stop: async () => {} }
  }
  mongoose.set('bufferCommands', false) // fail fast instead of queueing queries while disconnected
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let delay = 2000

  mongoose.connection.on('connected', () => logger.log('info', 'database connected'))
  mongoose.connection.on('disconnected', () => logger.log('warn', 'database disconnected'))

  const attempt = async () => {
    if (stopped) return
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.log('error', `database connection failed: ${redact(msg).slice(0, 200)}; retrying in ${delay}ms`)
      timer = setTimeout(() => void attempt(), delay)
      delay = Math.min(delay * 2, 60_000)
    }
  }
  void attempt()

  return {
    stop: async () => {
      stopped = true
      if (timer) clearTimeout(timer)
      await mongoose.disconnect()
    },
  }
}
