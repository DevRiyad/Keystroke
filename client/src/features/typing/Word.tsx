import { memo, useCallback, useSyncExternalStore, type ReactElement } from 'react'
import { charState, type CharState, type TypingEngine } from './engine'

const letterClass: Record<CharState, string> = {
  correct: 'text-text',
  incorrect: 'text-error',
  extra: 'text-error opacity-60',
  untyped: 'text-muted',
}

interface Props {
  engine: TypingEngine
  index: number
  /** Blind mode: mistakes are not highlighted while typing. */
  blind?: boolean
}

/** Re-renders only when its own word changes (per-word external-store subscription). */
const Word = memo(function Word({ engine, index, blind = false }: Props) {
  const subscribe = useCallback((cb: () => void) => engine.subscribeWord(index, cb), [engine, index])
  useSyncExternalStore(subscribe, () => engine.versions[index])

  const target = engine.words[index]
  const input = engine.inputs[index]
  const count = Math.max(target.length, input.length)
  // A committed word with missing characters is underlined.
  const missed = !blind && index < engine.wordIndex && input.length < target.length

  const letters: ReactElement[] = []
  for (let j = 0; j < count; j++) {
    let s = charState(target, input, j)
    if (blind && (s === 'incorrect' || s === 'extra')) s = 'correct'
    letters.push(
      <span key={j} className={letterClass[s]}>
        {s === 'extra' ? input[j] : target[j]}
      </span>,
    )
  }

  // An empty word (zen mode, before typing) still needs one anchor for the caret.
  if (count === 0) letters.push(<span key="z" className="text-muted">&#8203;</span>)

  return (
    <span className={`mr-[0.6em] ${missed ? 'underline decoration-error decoration-2 underline-offset-[6px]' : ''}`}>
      {letters}
    </span>
  )
})

export default Word
