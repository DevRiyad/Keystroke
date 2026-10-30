import { useCallback, useEffect, useState } from 'react'
import AboutDialog from './components/AboutDialog'
import CommandPalette, { type PaletteAction } from './components/CommandPalette'
import CustomTextPanel from './components/CustomTextPanel'
import Footer from './components/Footer'
import Header from './components/Header'
import Hints from './components/Hints'
import SettingsDialog from './components/SettingsDialog'
import Toolbar from './components/Toolbar'
import TypingArea from './components/TypingArea'
import {
  configKey,
  DURATIONS,
  supportsTextOptions,
  WORD_COUNTS,
  type Mode,
  type TestConfig,
} from './features/modes/config'
import { loadConfig, saveConfig } from './features/modes/persist'
import { useSettings } from './features/settings/SettingsContext'
import {
  FONT_SIZE_IDS,
  getStorage,
  THEME_IDS,
  THEME_LABELS,
  TYPING_MODES,
} from './features/settings/settings'

type Dialog = 'none' | 'settings' | 'about' | 'palette'

const focusTyping = () => document.querySelector<HTMLInputElement>('input[aria-label="Typing input"]')?.focus()

export default function App() {
  const { settings, update } = useSettings()
  const [config, setConfig] = useState<TestConfig>(() => loadConfig(getStorage()))
  const [editing, setEditing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [dialog, setDialog] = useState<Dialog>('none')

  useEffect(() => {
    saveConfig(getStorage(), config)
  }, [config])

  const onChange = useCallback((patch: Partial<TestConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
    if (patch.mode !== undefined) setEditing(false)
  }, [])

  // Global shortcuts: Ctrl/Cmd+Shift+P, and Escape (when nothing else is focused) open the command palette.
  useEffect(() => {
    if (dialog !== 'none') return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setDialog('palette')
      } else if (e.key === 'Escape' && !inField) {
        e.preventDefault()
        setDialog('palette')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const actions = (): PaletteAction[] => {
    const list: PaletteAction[] = [
      { id: 'restart', label: 'restart test', run: () => setNonce((n) => n + 1) },
      { id: 'settings', label: 'open settings', run: () => setDialog('settings') },
      { id: 'about', label: 'shortcuts and about', run: () => setDialog('about') },
    ]
    for (const m of ['time', 'words', 'quote', 'zen', 'custom'] as Mode[]) {
      list.push({ id: `mode-${m}`, label: `mode: ${m}`, run: () => onChange({ mode: m }) })
    }
    for (const d of DURATIONS) list.push({ id: `time-${d}`, label: `time: ${d} seconds`, run: () => onChange({ mode: 'time', duration: d }) })
    for (const n of WORD_COUNTS) list.push({ id: `words-${n}`, label: `words: ${n}`, run: () => onChange({ mode: 'words', wordCount: n }) })
    const textMode = supportsTextOptions(config.mode) ? config.mode : 'time'
    list.push(
      { id: 'punct', label: `punctuation: ${config.punctuation ? 'turn off' : 'turn on'}`, run: () => onChange({ mode: textMode, punctuation: !config.punctuation }) },
      { id: 'numbers', label: `numbers: ${config.numbers ? 'turn off' : 'turn on'}`, run: () => onChange({ mode: textMode, numbers: !config.numbers }) },
    )
    for (const t of THEME_IDS) list.push({ id: `theme-${t}`, label: `theme: ${THEME_LABELS[t]}`, run: () => update({ theme: t }) })
    for (const f of FONT_SIZE_IDS) list.push({ id: `fs-${f}`, label: `font size: ${f}`, run: () => update({ fontSize: f }) })
    for (const m of TYPING_MODES) list.push({ id: `tm-${m}`, label: `typing mode: ${m}`, run: () => update({ typingMode: m }) })
    list.push(
      { id: 'sound', label: `sound: ${settings.sound ? 'turn off' : 'turn on'}`, run: () => update({ sound: !settings.sound }) },
      { id: 'blind', label: `blind mode: ${settings.blind ? 'turn off' : 'turn on'}`, run: () => update({ blind: !settings.blind }) },
      { id: 'livewpm', label: `live wpm: ${settings.liveWpm ? 'hide' : 'show'}`, run: () => update({ liveWpm: !settings.liveWpm }) },
    )
    return list
  }

  const needsText = config.mode === 'custom' && config.customText === ''
  const showPanel = config.mode === 'custom' && (needsText || editing)
  const close = () => setDialog('none')

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 py-5 sm:px-8">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          focusTyping()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-sub focus:px-3 focus:py-1.5 focus:text-accent"
      >
        skip to typing test
      </a>
      <h1 className="sr-only">keystroke - typing speed test</h1>
      <Header onPractice={focusTyping} onAbout={() => setDialog('about')} onSettings={() => setDialog('settings')} />
      <div className="focus-fade mt-6 sm:mt-8">
        <Toolbar config={config} onChange={onChange} onEditCustom={() => setEditing(true)} />
      </div>
      <main id="main" className="flex flex-1 items-center py-10">
        {showPanel ? (
          <CustomTextPanel
            initial={config.customText}
            onCancel={needsText ? undefined : () => setEditing(false)}
            onApply={(text) => {
              setConfig((c) => ({ ...c, customText: text }))
              setEditing(false)
              setNonce((n) => n + 1)
            }}
          />
        ) : (
          <TypingArea key={`${configKey(config)}:${nonce}`} config={config} />
        )}
      </main>
      <div className="focus-fade mb-8">
        <Hints />
      </div>
      <Footer onAbout={() => setDialog('about')} onSettings={() => setDialog('settings')} />

      {dialog === 'settings' && <SettingsDialog onClose={close} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      {dialog === 'palette' && <CommandPalette actions={actions()} onClose={close} />}
    </div>
  )
}
