import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultSettings, getStorage, loadSettings, saveSettings, type Settings } from './settings'

interface Value {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

const Ctx = createContext<Value | null>(null)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(getStorage(), prefersReducedMotion()))

  // Apply theme / font to the document before paint.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.font = settings.font
    root.dataset.fontsize = settings.fontSize
  }, [settings.theme, settings.font, settings.fontSize])

  useEffect(() => {
    saveSettings(getStorage(), settings)
  }, [settings])

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const reset = useCallback(() => setSettings(defaultSettings(prefersReducedMotion())), [])
  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): Value {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used inside SettingsProvider')
  return v
}
