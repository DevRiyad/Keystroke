import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { parseEnv } from './config/env'
import { createMemoryStore } from './services/memoryStore'

const GUEST_A = 'guest-aaaaaaaaaaaaaaaa'
const GUEST_B = 'guest-bbbbbbbbbbbbbbbb'
const ORIGIN = 'http://localhost:5173'

const result = (over: Record<string, unknown> = {}) => ({
  name: 'Ada',
  mode: 'time',
  duration: 60,
  punctuation: false,
  numbers: false,
  elapsedMs: 60000,
  correctChars: 300,
  incorrectChars: 5,
  extraChars: 1,
  missedChars: 2,
  correctKeystrokes: 310,
  incorrectKeystrokes: 10,
  consistency: 82.5,
  wpm: 60,
  rawWpm: 64,
  accuracy: 96.88,
  ...over,
})

let dbUp = true
let server: Server
let url = ''

beforeAll(async () => {
  const env = parseEnv({ WRITE_LIMIT_MAX: '1000', RATE_LIMIT_MAX: '1000' })
  const app = createApp({ env, store: createMemoryStore(), isDbReady: () => dbUp })
  await new Promise<void>((r) => {
    server = app.listen(0, r)
  })
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const call = (path: string, init: RequestInit & { guest?: string | null } = {}) => {
  const { guest = GUEST_A, headers, ...rest } = init
  return fetch(url + path, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(guest ? { 'x-guest-id': guest } : {}), ...(headers as Record<string, string>) },
  })
}
const post = (path: string, body: unknown, guest: string | null = GUEST_A) => call(path, { method: 'POST', body: JSON.stringify(body), guest })

describe('health', () => {
  it('reports the database state and always answers 200', async () => {
    let r = await call('/api/health')
    expect(r.status).toBe(200)
    expect((await r.json()).database).toBe('up')
    dbUp = false
    r = await call('/api/health')
    expect(r.status).toBe(200)
    expect((await r.json()).database).toBe('down')
    dbUp = true
  })
})

describe('database unavailable', () => {
  it('answers 503 for persistence endpoints', async () => {
    dbUp = false
    for (const r of [await post('/api/results', result()), await call('/api/history'), await call('/api/leaderboard')]) {
      expect(r.status).toBe(503)
      expect((await r.json()).error.code).toBe('database_unavailable')
    }
    dbUp = true
  })
})

describe('results and history', () => {
  it('saves a valid result without exposing the guest id', async () => {
    const r = await post('/api/results', result())
    expect(r.status).toBe(201)
    const body = await r.json()
    expect(body.result.wpm).toBe(60)
    expect(JSON.stringify(body)).not.toContain(GUEST_A)
  })

  it('rejects invalid results with details', async () => {
    const r = await post('/api/results', result({ wpm: 200 }))
    expect(r.status).toBe(400)
    const body = await r.json()
    expect(body.error.code).toBe('invalid_request')
    expect(body.error.details.length > 0).toBe(true)
  })

  it('requires a valid guest id', async () => {
    expect((await post('/api/results', result(), null)).status).toBe(400)
    expect((await post('/api/results', result(), 'short')).status).toBe(400)
  })

  it('returns only the caller\'s history, newest first', async () => {
    await post('/api/results', result({ name: 'First' }), GUEST_B)
    await post('/api/results', result({ name: 'Second' }), GUEST_B)
    const r = await call('/api/history?limit=10', { guest: GUEST_B })
    const names = (await r.json()).results.map((x: { name: string }) => x.name)
    expect(names).toEqual(['Second', 'First'])
    expect((await call('/api/history?limit=0')).status).toBe(400)
  })

  it('rejects malformed and oversized bodies', async () => {
    const bad = await call('/api/results', { method: 'POST', body: '{nope' })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('invalid_json')
    const big = await call('/api/results', { method: 'POST', body: JSON.stringify({ x: 'a'.repeat(20000) }) })
    expect(big.status).toBe(413)
  })
})

describe('leaderboard', () => {
  it('ranks the best result per guest and skips zen', async () => {
    const fast = result({ name: 'Fast', correctChars: 400, correctKeystrokes: 410, wpm: 80, rawWpm: 84, accuracy: 97.62 })
    await post('/api/results', fast, 'guest-cccccccccccccccc')
    await post('/api/results', result({ mode: 'zen', duration: undefined }), 'guest-dddddddddddddddd')
    const r = await call('/api/leaderboard?mode=time&duration=60&limit=5')
    expect(r.status).toBe(200)
    const entries = (await r.json()).entries as { rank: number; name: string; wpm: number }[]
    expect(entries[0].name).toBe('Fast')
    expect(entries[0].rank).toBe(1)
    expect(entries.every((e) => !('guestId' in e))).toBe(true)
    expect((await call('/api/leaderboard?mode=zen')).status).toBe(400)
  })
})

describe('settings', () => {
  const settings = {
    theme: 'light',
    fontSize: 'medium',
    font: 'jetbrains',
    cursorStyle: 'line',
    cursorAnimation: true,
    typingMode: 'normal',
    sound: false,
    blind: false,
    liveWpm: true,
    confirmRestart: false,
  }
  it('is null until saved, then round-trips', async () => {
    const guest = 'guest-eeeeeeeeeeeeeeee'
    expect((await (await call('/api/settings', { guest })).json()).settings).toBeNull()
    expect((await call('/api/settings', { method: 'PUT', body: JSON.stringify(settings), guest })).status).toBe(200)
    expect((await (await call('/api/settings', { guest })).json()).settings.theme).toBe('light')
  })
  it('rejects invalid settings', async () => {
    expect((await call('/api/settings', { method: 'PUT', body: JSON.stringify({ ...settings, theme: 'neon' }) })).status).toBe(400)
  })
})

describe('hardening', () => {
  it('sets security headers on API responses', async () => {
    const r = await call('/api/health')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(r.headers.get('x-powered-by')).toBeNull()
  })
  it('rejects non-JSON write requests with 415', async () => {
    const r = await fetch(url + '/api/results', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-guest-id': GUEST_A }, body: 'x' })
    expect(r.status).toBe(415)
  })
})

describe('http behaviour', () => {
  it('404s unknown routes with the error format', async () => {
    const r = await call('/api/nope')
    expect(r.status).toBe(404)
    expect((await r.json()).error.code).toBe('not_found')
  })
  it('allows same-origin browser requests without any configuration', async () => {
    const r = await call('/api/health', { headers: { origin: url } })
    expect(r.status).toBe(200)
  })
  it('blocks origins that are not allowed and allows the configured one', async () => {
    expect((await call('/api/health', { headers: { origin: 'https://evil.example' } })).status).toBe(403)
    const ok = await call('/api/health', { headers: { origin: ORIGIN } })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN)
  })
})

describe('rate limiting', () => {
  it('answers 429 once the write limit is exceeded', async () => {
    const env = parseEnv({ WRITE_LIMIT_MAX: '2' })
    const app = createApp({ env, store: createMemoryStore(), isDbReady: () => true })
    const s = await new Promise<Server>((r) => {
      const x = app.listen(0, () => r(x))
    })
    const u = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/results`
    const send = () => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-id': GUEST_A }, body: JSON.stringify(result()) })
    const statuses = [(await send()).status, (await send()).status, (await send()).status]
    expect(statuses).toEqual([201, 201, 429])
    await new Promise<void>((r) => s.close(() => r()))
  })
})
