import { describe, expect, it } from 'vitest'
import { isAllowedOrigin } from './origin'

const allowed = ['https://app.example.com']

describe('isAllowedOrigin', () => {
  it('allows requests without an Origin header', () => {
    expect(isAllowedOrigin(undefined, 'x.vercel.app', allowed)).toBe(true)
  })
  it('allows listed origins', () => {
    expect(isAllowedOrigin('https://app.example.com', 'api.other.com', allowed)).toBe(true)
  })
  it('allows same-origin requests (production, preview and custom domains on Vercel)', () => {
    expect(isAllowedOrigin('https://typing-git-main-me.vercel.app', 'typing-git-main-me.vercel.app', [])).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173', 'localhost:5173', [])).toBe(true)
  })
  it('blocks other sites, other ports and the null origin', () => {
    expect(isAllowedOrigin('https://evil.example', 'typing.vercel.app', allowed)).toBe(false)
    expect(isAllowedOrigin('https://typing.vercel.app:8443', 'typing.vercel.app', [])).toBe(false)
    expect(isAllowedOrigin('null', 'typing.vercel.app', [])).toBe(false)
    expect(isAllowedOrigin('https://typing.vercel.app.evil.example', 'typing.vercel.app', [])).toBe(false)
    expect(isAllowedOrigin('ftp://typing.vercel.app', 'typing.vercel.app', [])).toBe(false)
  })
  it('never treats a missing Host as same-origin', () => {
    expect(isAllowedOrigin('https://evil.example', undefined, [])).toBe(false)
  })
})
