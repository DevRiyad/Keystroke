import type { StorageLike } from '../settings/settings'
import { DEFAULT_CONFIG, DURATIONS, normalizeCustomText, WORD_COUNTS, type Mode, type TestConfig } from './config'

export const CONFIG_KEY = 'keystroke.config.v1'
const MODES: readonly Mode[] = ['time', 'words', 'quote', 'zen', 'custom']

export function sanitizeConfig(raw: unknown): TestConfig {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const mode = MODES.find((m) => m === r.mode) ?? DEFAULT_CONFIG.mode
  const duration = DURATIONS.find((d) => d === r.duration) ?? DEFAULT_CONFIG.duration
  const wordCount = WORD_COUNTS.find((n) => n === r.wordCount) ?? DEFAULT_CONFIG.wordCount
  let customText = ''
  if (typeof r.customText === 'string') {
    const n = normalizeCustomText(r.customText)
    if (n.ok) customText = n.text
  }
  return {
    mode,
    duration,
    wordCount,
    punctuation: r.punctuation === true,
    numbers: r.numbers === true,
    customText,
  }
}

export function loadConfig(storage: StorageLike | null): TestConfig {
  if (!storage) return DEFAULT_CONFIG
  try {
    const text = storage.getItem(CONFIG_KEY)
    return text ? sanitizeConfig(JSON.parse(text)) : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(storage: StorageLike | null, c: TestConfig): boolean {
  if (!storage) return false
  try {
    storage.setItem(CONFIG_KEY, JSON.stringify(c))
    return true
  } catch {
    return false
  }
}
