import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'
import { redact } from './logger'

describe('parseEnv', () => {
  it('has safe defaults and no database', () => {
    const e = parseEnv({})
    expect(e.port).toBe(4000)
    expect(e.mongoUri).toBeNull()
    expect(e.clientOrigins).toEqual(['http://localhost:5173'])
    expect(e.trustProxy).toBe(0)
  })
  it('parses origins (comma separated, trailing slash removed) and the Mongo URI', () => {
    const e = parseEnv({ CLIENT_ORIGIN: 'https://a.com/, https://b.com', MONGODB_URI: 'mongodb://localhost/x', PORT: '8080' })
    expect(e.clientOrigins).toEqual(['https://a.com', 'https://b.com'])
    expect(e.mongoUri).toBe('mongodb://localhost/x')
    expect(e.port).toBe(8080)
  })
  it('trusts one proxy hop by default on Vercel, none elsewhere, and honours an explicit value', () => {
    expect(parseEnv({ VERCEL: '1' }).trustProxy).toBe(1)
    expect(parseEnv({}).trustProxy).toBe(0)
    expect(parseEnv({ VERCEL: '1', TRUST_PROXY: '2' }).trustProxy).toBe(2)
  })
  it('treats an empty MONGODB_URI as not configured', () => {
    expect(parseEnv({ MONGODB_URI: '  ' }).mongoUri).toBeNull()
  })
  it('throws clear errors for invalid numbers', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow('PORT')
    expect(() => parseEnv({ PORT: '70000' })).toThrow('PORT')
    expect(() => parseEnv({ RATE_LIMIT_MAX: '0' })).toThrow('RATE_LIMIT_MAX')
  })
})

describe('redact', () => {
  it('hides credentials in connection strings and query-style secrets', () => {
    expect(redact('failed: mongodb+srv://user:p4ss@cluster.example.net/db')).toBe('failed: mongodb+srv://[redacted]@cluster.example.net/db')
    expect(redact('x?password=abc&y=1')).toBe('x?password=[redacted]&y=1')
  })
})
