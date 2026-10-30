interface Props {
  raw: number[]
  correct: number[]
}

const W = 640
const H = 200
const P = { l: 44, r: 10, t: 14, b: 28 }

/** Per-second speed chart: raw keystroke speed (muted) vs correct keystroke speed (accent, filled). */
export default function ResultChart({ raw, correct }: Props) {
  const n = raw.length
  if (n < 2) return <p className="text-sm text-muted">not enough data for a chart (needs at least 2 seconds)</p>

  const max = Math.max(10, Math.ceil(Math.max(...raw, ...correct) / 10) * 10)
  const x = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b)
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line(correct)} L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
  const ticks = [0, max / 2, max]

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Typing speed per second over ${n} seconds. Peak raw ${Math.max(...raw)} wpm, peak correct ${Math.max(...correct)} wpm.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-muted" strokeOpacity={t === 0 ? 0.45 : 0.18} strokeDasharray={t === 0 ? undefined : '4 5'} />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="14" className="fill-muted">{Math.round(t)}</text>
          </g>
        ))}
        <text x={P.l} y={H - 6} fontSize="14" className="fill-muted">1s</text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="14" className="fill-muted">{n}s</text>
        <path d={area} className="fill-accent/10" />
        <path d={line(raw)} className="fill-none stroke-muted" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line(correct)} className="fill-none stroke-accent" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-2 flex gap-5 text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-accent" />correct wpm</span>
        <span className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-muted" />raw wpm</span>
      </figcaption>
    </figure>
  )
}
