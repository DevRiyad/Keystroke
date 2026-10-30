import { existsSync } from 'node:fs'

export interface Env {
  nodeEnv: string
  port: number
  /** null = run without persistence (typing test still works; persistence endpoints answer 503). */
  mongoUri: string | null
  clientOrigins: string[]
  /** Number of reverse proxies in front of the app (for correct client IPs behind a host/CDN). */
  trustProxy: number
  rateLimitWindowMs: number
  rateLimitMax: number
  writeLimitMax: number
}

type Source = Record<string, string | undefined>

function int(source: Source, key: string, fallback: number, min: number, max: number): number {
  const raw = source[key]
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${key} must be an integer between ${min} and ${max}`)
  return n
}

/** Pure parser (testable). Throws a clear error for invalid configuration. */
export function parseEnv(source: Source): Env {
  const origins = (source.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const uri = source.MONGODB_URI?.trim()
  return {
    nodeEnv: source.NODE_ENV ?? 'development',
    port: int(source, 'PORT', 4000, 1, 65535),
    mongoUri: uri ? uri : null,
    clientOrigins: origins,
    // On Vercel every request comes through one proxy hop, so trust it by default (correct client IPs for rate limits).
    trustProxy: int(source, 'TRUST_PROXY', source.VERCEL ? 1 : 0, 0, 10),
    rateLimitWindowMs: int(source, 'RATE_LIMIT_WINDOW_MS', 60_000, 1000, 3_600_000),
    rateLimitMax: int(source, 'RATE_LIMIT_MAX', 120, 1, 100_000),
    writeLimitMax: int(source, 'WRITE_LIMIT_MAX', 20, 1, 100_000),
  }
}

/** Load the first .env found (server/.env, then repo-root .env). Existing environment variables win. */
export function loadEnvFiles(): void {
  for (const p of ['.env', '../.env']) {
    if (existsSync(p)) {
      process.loadEnvFile(p)
      return
    }
  }
}
