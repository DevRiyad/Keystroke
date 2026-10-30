import { isRecord, type Validation } from './common'

// Mirrors client/src/features/settings/settings.ts (no shared package in this monorepo).
const ENUMS = {
  theme: ['yellow', 'dark', 'light'],
  fontSize: ['small', 'medium', 'large', 'xlarge'],
  font: ['jetbrains', 'system', 'courier'],
  cursorStyle: ['line', 'block', 'underline'],
  typingMode: ['normal', 'confidence', 'strict'],
} as const
const BOOLS = ['cursorAnimation', 'sound', 'blind', 'liveWpm', 'confirmRestart'] as const

export type SettingsData = Record<string, string | boolean>

/** PUT replaces the whole settings object, so every field must be present and valid. Unknown fields are dropped. */
export function validateSettings(body: unknown): Validation<SettingsData> {
  if (!isRecord(body)) return { ok: false, errors: ['body must be a JSON object'] }
  const errors: string[] = []
  const out: SettingsData = {}
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const v = body[key]
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) out[key] = v
    else errors.push(`${key} must be one of ${allowed.join(', ')}`)
  }
  for (const key of BOOLS) {
    const v = body[key]
    if (typeof v === 'boolean') out[key] = v
    else errors.push(`${key} must be a boolean`)
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out }
}
