import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Repeat, RotateCw, Share2 } from 'lucide-react'
import type { Stats } from '../typing/stats'
import ResultChart from './ResultChart'
import { browserShareEnv, formatShareText, shareText, type ShareOutcome } from './share'

interface Props {
  stats: Stats
  label: string
  /** New text. */
  onNext: () => void
  /** Same text. */
  onRetry: () => void
}

const tile = 'rise rounded-2xl bg-sub/80 p-5 ring-1 ring-muted/20'

function Tile({ name, children, delay = 0, className = '' }: { name: string; children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`${tile} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs uppercase tracking-wider text-muted">{name}</p>
      {children}
    </div>
  )
}

function AccuracyRing({ value }: { value: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="56" cy="56" r={r} fill="none" strokeWidth="9" className="stroke-muted/25" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="ring-fill stroke-accent"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ '--ring-len': c } as CSSProperties}
        />
      </svg>
      <p className="absolute inset-0 grid place-items-center text-3xl text-accent" title={`${value}%`}>
        {Math.round(value)}%
      </p>
    </div>
  )
}

const messages: Record<ShareOutcome, string> = {
  shared: 'shared',
  copied: 'result copied to clipboard',
  cancelled: '',
  failed: "couldn't share or copy automatically - select the text below",
}

export default function Results({ stats, label, onNext, onRetry }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const text = formatShareText({ ...stats, label })

  // Focus "next test" so Enter restarts - but only after a short delay, so keys still being
  // typed when the test ends (e.g. the timer expires mid-word) can't trigger it by accident.
  useEffect(() => {
    const id = window.setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 700)
    return () => window.clearTimeout(id)
  }, [])

  const share = async () => setOutcome(await shareText(text, browserShareEnv()))

  const parts = [
    { label: 'correct', value: stats.correctChars, bar: 'bg-success', dot: 'bg-success' },
    { label: 'incorrect', value: stats.incorrectChars, bar: 'bg-error', dot: 'bg-error' },
    { label: 'extra', value: stats.extraChars, bar: 'bg-accent', dot: 'bg-accent' },
    { label: 'missed', value: stats.missedChars, bar: 'bg-muted', dot: 'bg-muted' },
  ]
  const totalChars = parts.reduce((a, p) => a + p.value, 0)
  const keystrokes = stats.correctKeystrokes + stats.incorrectKeystrokes
  const consistency = stats.consistency

  return (
    <section aria-label="Test results" className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-sm uppercase tracking-wider text-muted">results</h2>
        <span className="rounded-full bg-sub px-3 py-1 text-xs text-accent ring-1 ring-muted/20">{label}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,21rem)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Tile name="wpm">
            <p className="mt-2 text-6xl leading-none text-accent sm:text-7xl" title={`${stats.wpm} wpm`}>
              {Math.round(stats.wpm)}
            </p>
          </Tile>
          <Tile name="accuracy" delay={80}>
            <div className="mt-2 flex justify-center">
              <AccuracyRing value={stats.accuracy} />
            </div>
          </Tile>
        </div>
        <Tile name="speed per second" delay={160}>
          <div className="mt-3">
            <ResultChart raw={stats.rawPerSecond} correct={stats.correctPerSecond} />
          </div>
        </Tile>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile name="raw wpm" delay={220}>
          <p className="mt-2 text-3xl text-text">{Math.round(stats.rawWpm)}</p>
        </Tile>
        <Tile name="consistency" delay={260}>
          <p className="mt-2 text-3xl text-text">{consistency === null ? '-' : `${Math.round(consistency)}%`}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/20" aria-hidden="true">
            <div className="bar-grow h-full rounded-full bg-accent" style={{ width: `${consistency ?? 0}%` }} />
          </div>
        </Tile>
        <Tile name="time" delay={300}>
          <p className="mt-2 text-3xl text-text">{(stats.elapsedMs / 1000).toFixed(1)}s</p>
        </Tile>
        <Tile name="keystrokes" delay={340}>
          <p className="mt-2 text-3xl text-text">{keystrokes}</p>
          <p className="mt-1 text-xs text-muted">{stats.incorrectKeystrokes} mistakes</p>
        </Tile>
      </div>

      <Tile name="characters" delay={380} className="mt-4">
        <div
          className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted/20"
          role="img"
          aria-label={`Characters: ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`}
        >
          {totalChars > 0 &&
            parts
              .filter((p) => p.value > 0)
              .map((p) => <div key={p.label} className={`bar-grow h-full ${p.bar}`} style={{ width: `${(p.value / totalChars) * 100}%` }} />)}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-2 sm:block">
              <span className="flex items-center gap-2 text-muted">
                <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} aria-hidden="true" />
                {p.label}
              </span>
              <span className="text-xl text-text sm:mt-1 sm:block">{p.value}</span>
            </li>
          ))}
        </ul>
      </Tile>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-bg transition-opacity hover:opacity-90"
        >
          <RotateCw size={16} /> next test
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-sub px-5 py-3 text-sm text-text ring-1 ring-muted/20 transition-colors hover:text-accent"
        >
          <Repeat size={16} /> try again
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-2 rounded-xl bg-sub px-5 py-3 text-sm text-text ring-1 ring-muted/20 transition-colors hover:text-accent"
        >
          <Share2 size={16} /> share
        </button>
      </div>
      <div role="status" className="mt-3 text-center text-xs text-muted">
        {outcome && messages[outcome]}
        {outcome === 'failed' && <code className="mt-2 block select-all break-words text-text">{text}</code>}
      </div>
    </section>
  )
}
