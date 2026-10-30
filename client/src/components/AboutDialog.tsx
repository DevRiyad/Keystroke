import { X } from 'lucide-react'
import Modal from './Modal'

const shortcuts: [string, string][] = [
  ['tab, then enter', 'restart the test (while typing)'],
  ['esc', 'release typing focus; press again to open the command palette'],
  ['ctrl/cmd + shift + p', 'command palette (modes, durations, themes, settings)'],
  ['shift + enter', 'finish a zen test'],
  ['ctrl/alt + backspace', 'delete the current word'],
]

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="About and shortcuts" onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-accent">about</h2>
        <button type="button" data-autofocus onClick={onClose} aria-label="Close" className="p-2 text-muted hover:text-text">
          <X size={18} />
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        keystroke is a minimalist typing test. The test starts on your first keystroke and runs entirely in your browser.
      </p>
      <h3 className="mt-5 text-sm text-text">keyboard shortcuts</h3>
      <dl className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-[11rem_1fr]">
        {shortcuts.map(([k, d]) => (
          <div key={k} className="contents">
            <dt className="text-accent">{k}</dt>
            <dd className="text-muted">{d}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-sm text-text">how results are calculated</h3>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        <li>wpm: correct characters / 5 / minutes (spaces after correct words count).</li>
        <li>raw: every keystroke (mistakes included) / 5 / minutes.</li>
        <li>accuracy: correct keystrokes / all keystrokes; corrected mistakes still count.</li>
        <li>consistency: how even your per-second raw speed was.</li>
      </ul>
    </Modal>
  )
}
