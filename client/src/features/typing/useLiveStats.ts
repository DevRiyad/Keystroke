import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TypingEngine } from './engine'
import { computeStats } from './stats'

export interface Live {
  /** Seconds left (time mode) or elapsed (other modes). */
  sec: number
  wpm: number
  /** Words completed so far. */
  words: number
}

const ZERO: Live = { sec: 0, wpm: 0, words: 0 }

/**
 * Drives the live timer / WPM display. This is a display-only loop: the engine
 * clock (performance.now) is the source of truth, and the interval only asks
 * the engine to check it (engine.tick) and refreshes the numbers. React state
 * is touched only when a displayed value actually changes, and the loop is
 * stopped as soon as the test is not running.
 */
export function useLiveStats(engine: TypingEngine): Live {
  const status = useSyncExternalStore(engine.subscribe, () => engine.status)
  const [live, setLive] = useState<Live>(ZERO)

  useEffect(() => {
    if (status === 'idle') {
      setLive(ZERO)
      return
    }
    if (status !== 'running') return

    const update = () => {
      engine.tick()
      if (engine.status !== 'running') return
      const el = engine.elapsedMs()
      const limit = engine.timeLimitMs
      const sec = limit !== null ? Math.max(0, Math.ceil((limit - el) / 1000)) : Math.floor(el / 1000)
      const wpm = el >= 1000 ? Math.round(computeStats(engine).wpm) : 0
      const words = engine.wordIndex
      setLive((p) => (p.sec === sec && p.wpm === wpm && p.words === words ? p : { sec, wpm, words }))
    }
    update()
    const id = window.setInterval(update, 200)
    const onVisible = () => {
      if (!document.hidden) update()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [engine, status])

  return live
}
