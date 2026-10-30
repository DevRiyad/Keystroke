import { describe, expect, it } from 'vitest'
import { defaultSettings, loadSettings, sanitizeSettings, saveSettings, SETTINGS_KEY, type StorageLike } from './settings'
import { CONFIG_KEY, loadConfig, saveConfig } from '../modes/persist'
import { DEFAULT_CONFIG } from '../modes/config'

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}
const broken: StorageLike = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('quota')
  },
}

describe('settings', () => {
  it('has safe defaults: sound off, yellow theme', () => {
    const d = defaultSettings()
    expect(d.sound).toBe(false)
    expect(d.theme).toBe('yellow')
    expect(d.typingMode).toBe('normal')
  })

  it('turns cursor animation off by default for reduced-motion users', () => {
    expect(defaultSettings(true).cursorAnimation).toBe(false)
    expect(defaultSettings(false).cursorAnimation).toBe(true)
  })

  it('round-trips through storage', () => {
    const st = memory()
    const s = { ...defaultSettings(), theme: 'light' as const, sound: true, typingMode: 'strict' as const }
    expect(saveSettings(st, s)).toBe(true)
    expect(loadSettings(st)).toEqual(s)
  })

  it('rejects invalid values and keeps valid ones', () => {
    const base = defaultSettings()
    const out = sanitizeSettings({ theme: 'neon', fontSize: 'large', sound: 'yes', blind: true, font: 42 }, base)
    expect(out.theme).toBe('yellow')
    expect(out.fontSize).toBe('large')
    expect(out.sound).toBe(false)
    expect(out.blind).toBe(true)
    expect(out.font).toBe('jetbrains')
  })

  it('survives corrupt JSON, missing storage and throwing storage', () => {
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{not json' }))).toEqual(defaultSettings())
    expect(loadSettings(null)).toEqual(defaultSettings())
    expect(loadSettings(broken)).toEqual(defaultSettings())
    expect(saveSettings(broken, defaultSettings())).toBe(false)
    expect(saveSettings(null, defaultSettings())).toBe(false)
  })
})

describe('config persistence', () => {
  it('round-trips and validates', () => {
    const st = memory()
    const c = { ...DEFAULT_CONFIG, mode: 'words' as const, wordCount: 50, punctuation: true, customText: 'hello  world' }
    saveConfig(st, c)
    expect(loadConfig(st)).toEqual({ ...c, customText: 'hello world' })
  })

  it('falls back to defaults for bad data', () => {
    const st = memory({ [CONFIG_KEY]: JSON.stringify({ mode: 'hax', duration: 7, wordCount: 3, customText: 5 }) })
    expect(loadConfig(st)).toEqual(DEFAULT_CONFIG)
    expect(loadConfig(broken)).toEqual(DEFAULT_CONFIG)
    expect(loadConfig(null)).toEqual(DEFAULT_CONFIG)
  })
})
