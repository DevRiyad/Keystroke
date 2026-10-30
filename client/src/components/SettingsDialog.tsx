import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import Modal from './Modal'
import { useSettings } from '../features/settings/SettingsContext'
import {
  CURSOR_STYLES,
  FONT_IDS,
  FONT_LABELS,
  FONT_SIZE_IDS,
  THEME_IDS,
  THEME_LABELS,
  TYPING_MODES,
  type Settings,
} from '../features/settings/settings'

interface Option<T extends string> {
  id: T
  label: string
}
const opts = <T extends string>(ids: readonly T[], labels?: Record<T, string>): Option<T>[] =>
  ids.map((id) => ({ id, label: labels ? labels[id] : id }))

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
      <span className="text-sm text-muted">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded px-3 py-1.5 text-xs transition-colors ${value === o.id ? 'bg-sub text-accent' : 'text-muted hover:text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`rounded px-3 py-1.5 text-xs transition-colors ${checked ? 'bg-sub text-accent' : 'text-muted hover:text-text'}`}
      >
        {checked ? 'on' : 'off'}
      </button>
    </Row>
  )
}

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, update, reset } = useSettings()
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>)

  return (
    <Modal label="Settings" onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-accent">settings</h2>
        <button type="button" data-autofocus onClick={onClose} aria-label="Close settings" className="p-2 text-muted hover:text-text">
          <X size={18} />
        </button>
      </div>
      <div className="divide-y divide-muted/20">
        <Row label="theme">
          <Segmented label="Theme" value={s.theme} options={opts(THEME_IDS, THEME_LABELS)} onChange={set('theme')} />
        </Row>
        <Row label="font size">
          <Segmented label="Font size" value={s.fontSize} options={opts(FONT_SIZE_IDS)} onChange={set('fontSize')} />
        </Row>
        <Row label="font">
          <Segmented label="Font" value={s.font} options={opts(FONT_IDS, FONT_LABELS)} onChange={set('font')} />
        </Row>
        <Row label="cursor style">
          <Segmented label="Cursor style" value={s.cursorStyle} options={opts(CURSOR_STYLES)} onChange={set('cursorStyle')} />
        </Row>
        <Switch label="cursor animation" checked={s.cursorAnimation} onChange={set('cursorAnimation')} />
        <Row label="typing mode">
          <Segmented label="Typing mode" value={s.typingMode} options={opts(TYPING_MODES)} onChange={set('typingMode')} />
          <p className="mt-2 text-xs text-muted">
            {s.typingMode === 'normal' && 'backspace can return to a wrong previous word.'}
            {s.typingMode === 'confidence' && 'backspace never returns to a previous word.'}
            {s.typingMode === 'strict' && 'wrong keys are rejected (still count against accuracy).'}
          </p>
        </Row>
        <Switch label="sound" checked={s.sound} onChange={set('sound')} />
        <Switch label="blind mode" checked={s.blind} onChange={set('blind')} />
        <Switch label="live wpm" checked={s.liveWpm} onChange={set('liveWpm')} />
        <Switch label="confirm restart" checked={s.confirmRestart} onChange={set('confirmRestart')} />
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={reset} className="rounded px-3 py-1.5 text-xs text-muted hover:text-text">
          reset to defaults
        </button>
      </div>
    </Modal>
  )
}
