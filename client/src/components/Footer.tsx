import { HelpCircle, Palette } from 'lucide-react'
import { useSettings } from '../features/settings/SettingsContext'
import { THEME_LABELS } from '../features/settings/settings'

const link = 'flex items-center gap-1.5 py-2 transition-colors hover:text-text'

export default function Footer({ onAbout, onSettings }: { onAbout: () => void; onSettings: () => void }) {
  const { settings } = useSettings()
  return (
    <footer className="focus-fade flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
      <button type="button" onClick={onAbout} className={link}>
        <HelpCircle size={12} />
        shortcuts &amp; about
      </button>
      <div className="flex items-center gap-4">
        <button type="button" onClick={onSettings} className={link} aria-label={`Theme: ${THEME_LABELS[settings.theme]}. Open settings`}>
          <Palette size={12} />
          {THEME_LABELS[settings.theme]}
        </button>
        <span>v1.0.0</span>
      </div>
    </footer>
  )
}
