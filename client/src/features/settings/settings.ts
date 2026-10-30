export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const THEME_IDS = ['yellow', 'dark', 'light'] as const
export const FONT_SIZE_IDS = ['small', 'medium', 'large', 'xlarge'] as const
export const FONT_IDS = ['jetbrains', 'system', 'courier'] as const
export const CURSOR_STYLES = ['line', 'block', 'underline'] as const
export const TYPING_MODES = ['normal', 'confidence', 'strict'] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type FontSizeId = (typeof FONT_SIZE_IDS)[number]
export type FontId = (typeof FONT_IDS)[number]
export type CursorStyle = (typeof CURSOR_STYLES)[number]
export type TypingMode = (typeof TYPING_MODES)[number]

export const THEME_LABELS: Record<ThemeId, string> = { yellow: 'yellow dark', dark: 'dark', light: 'light' }
export const FONT_LABELS: Record<FontId, string> = { jetbrains: 'jetbrains mono', system: 'system mono', courier: 'courier' }

export interface Settings {
  theme: ThemeId
  fontSize: FontSizeId
  font: FontId
  cursorStyle: CursorStyle
  /** Smooth cursor movement + idle blink. */
  cursorAnimation: boolean
  sound: boolean
  blind: boolean
  liveWpm: boolean
  typingMode: TypingMode
  confirmRestart: boolean
}

export const SETTINGS_KEY = 'keystroke.settings.v1'

export function defaultSettings(reducedMotion = false): Settings {
  return {
    theme: 'yellow',
    fontSize: 'medium',
    font: 'jetbrains',
    cursorStyle: 'line',
    cursorAnimation: !reducedMotion,
    sound: false, // off by default
    blind: false,
    liveWpm: true,
    typingMode: 'normal',
    confirmRestart: false,
  }
}

function pick<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback
}
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** Keep only valid fields from untrusted data (corrupt or old localStorage content). */
export function sanitizeSettings(raw: unknown, base: Settings): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    theme: pick(THEME_IDS, r.theme, base.theme),
    fontSize: pick(FONT_SIZE_IDS, r.fontSize, base.fontSize),
    font: pick(FONT_IDS, r.font, base.font),
    cursorStyle: pick(CURSOR_STYLES, r.cursorStyle, base.cursorStyle),
    cursorAnimation: bool(r.cursorAnimation, base.cursorAnimation),
    sound: bool(r.sound, base.sound),
    blind: bool(r.blind, base.blind),
    liveWpm: bool(r.liveWpm, base.liveWpm),
    typingMode: pick(TYPING_MODES, r.typingMode, base.typingMode),
    confirmRestart: bool(r.confirmRestart, base.confirmRestart),
  }
}

export function loadSettings(storage: StorageLike | null, reducedMotion = false): Settings {
  const base = defaultSettings(reducedMotion)
  if (!storage) return base
  try {
    const text = storage.getItem(SETTINGS_KEY)
    return text ? sanitizeSettings(JSON.parse(text), base) : base
  } catch {
    return base // unavailable storage or corrupt JSON
  }
}

export function saveSettings(storage: StorageLike | null, s: Settings): boolean {
  if (!storage) return false
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(s))
    return true
  } catch {
    return false // quota exceeded / blocked
  }
}

/** localStorage can throw just by being accessed (privacy modes), so never assume it exists. */
export function getStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}
