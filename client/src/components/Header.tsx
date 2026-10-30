import { Crown, Info, Keyboard, Settings } from 'lucide-react'

const iconBtn = 'rounded p-2 text-muted transition-colors hover:text-text disabled:opacity-40 disabled:hover:text-muted'

interface Props {
  onPractice: () => void
  onAbout: () => void
  onSettings: () => void
}

export default function Header({ onPractice, onAbout, onSettings }: Props) {
  return (
    <header className="focus-fade flex items-center gap-1 sm:gap-2">
      <div className="mr-1 flex min-w-0 items-center gap-2 text-text sm:mr-3" aria-label="keystroke">
        {/* Logo placeholder: replace with your own mark */}
        <span className="grid h-6 w-9 shrink-0 place-items-center rounded border-2 border-accent text-[10px] font-bold leading-none text-accent">
          ks
        </span>
        <span className="hidden truncate text-xl font-bold tracking-tight min-[360px]:inline sm:text-2xl">keystroke</span>
      </div>
      <nav className="flex items-center" aria-label="Main">
        <button type="button" className={iconBtn} aria-label="Practice (focus the typing test)" title="Practice" onClick={onPractice}>
          <Keyboard size={18} />
        </button>
        <button type="button" className={iconBtn} aria-label="Leaderboard (available once the backend is connected)" title="Leaderboard - needs the backend (Phase 5)" disabled>
          <Crown size={18} />
        </button>
        <button type="button" className={iconBtn} aria-label="About and keyboard shortcuts" title="About and shortcuts" onClick={onAbout}>
          <Info size={18} />
        </button>
        <button type="button" className={iconBtn} aria-label="Settings" title="Settings" onClick={onSettings}>
          <Settings size={18} />
        </button>
      </nav>
    </header>
  )
}
