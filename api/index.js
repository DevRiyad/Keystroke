// Vercel serverless entry. The whole Express API runs inside this one function;
// vercel.json rewrites /api/* to it and Express sees the original path (/api/health, ...).
// `npm run build:vercel` compiles server/src to server/dist first.
const { createApp } = require('../server/dist/app')
const { parseEnv } = require('../server/dist/config/env')
const { consoleLogger } = require('../server/dist/config/logger')
const { ensureDbConnection, isDbReady } = require('../server/dist/config/db')
const { mongoStore } = require('../server/dist/services/mongoStore')

const env = parseEnv(process.env)
const app = createApp({ env, store: mongoStore, isDbReady, logger: consoleLogger })

module.exports = async (req, res) => {
  // The connection is cached in module scope and reused while the instance stays warm.
  // If the database is unreachable the API answers 503 (persistence endpoints) and /api/health reports it.
  await ensureDbConnection(env.mongoUri, consoleLogger)
  return app(req, res)
}
