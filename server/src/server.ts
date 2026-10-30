import { createApp } from './app'
import { isDbReady, startDbConnection } from './config/db'
import { loadEnvFiles, parseEnv } from './config/env'
import { consoleLogger as logger } from './config/logger'
import { mongoStore } from './services/mongoStore'

loadEnvFiles()
const env = parseEnv(process.env)

const db = startDbConnection(env.mongoUri, logger)
const app = createApp({ env, store: mongoStore, isDbReady, logger })

const server = app.listen(env.port, () => {
  logger.log('info', `listening on port ${env.port} (${env.nodeEnv})`)
})

const shutdown = (signal: string) => {
  logger.log('info', `${signal} received, shutting down`)
  server.close(() => {
    void db.stop().finally(() => process.exit(0))
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
