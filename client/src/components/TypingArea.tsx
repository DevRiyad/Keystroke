import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Globe, RotateCw } from 'lucide-react'
import { applyInputValue, MIRROR_PREFIX, TypingEngine } from '../features/typing/engine'
import { classifyKey } from '../features/typing/keys'
import { computeStats } from '../features/typing/stats'
import { useLiveStats } from '../features/typing/useLiveStats'
import Word from '../features/typing/Word'
import Results from '../features/results/Results'
import { buildTest, describeConfig, type TestConfig } from '../features/modes/config'
import { useSettings } from '../features/settings/SettingsContext'
import { playClick } from '../features/settings/sound'

interface Props {
  config: TestConfig
}

/** Remounted (via key) whenever the config changes, so no state can carry over between modes. */
export default function TypingArea({ config }: Props) {
  const { settings } = useSettings()
  const [engine] = useState(() => {
    const t = buildTest(config)
    return new TypingEngine(t.words, t.options)
  })
  const [focused, setFocused] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const status = useSyncExternalStore(engine.subscribe, () => engine.status)
  const wordCount = useSyncExternalStore(engine.subscribe, () => engine.words.length)
  const live = useLiveStats(engine)
  const result = useMemo(() => (status === 'finished' ? computeStats(engine) : null), [engine, status])
  const finished = status === 'finished'
  const showConfirm = confirming && status === 'running'

  const inputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const tabArmed = useRef(false)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const placeRef = useRef<(() => void) | null>(null)
  const cursorStyleRef = useRef(settings.cursorStyle)
  cursorStyleRef.current = settings.cursorStyle

  // Focus mode: while a test is running, everything except the timer and the text is blurred (see index.css).
  useEffect(() => {
    const root = document.documentElement
    root.dataset.typing = status === 'running' ? '1' : '0'
    if (status !== 'running') return
    // Mouse movement shows the UI again ("peek"); the next keystroke hides it. A resting mouse does nothing.
    const onMove = (e: MouseEvent) => {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) root.dataset.typing = 'peek'
    }
    const unsub = engine.subscribe(() => {
      if (root.dataset.typing === 'peek') root.dataset.typing = '1'
    })
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      unsub()
    }
  }, [engine, status])
  useEffect(
    () => () => {
      delete document.documentElement.dataset.typing
    },
    [],
  )

  // Typing-mode setting -> engine rules (applies immediately, also mid-test).
  useEffect(() => {
    engine.setRules({ confidence: settings.typingMode === 'confidence', strict: settings.typingMode === 'strict' })
  }, [engine, settings.typingMode])

  // Re-measure the caret when appearance settings change.
  useEffect(() => {
    placeRef.current?.()
  }, [settings.cursorStyle, settings.fontSize, settings.font])

  // Keep the (invisible) input's value = " " + current word, so mobile
  // keyboards can report Backspace at the start of a word.
  const syncMirror = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const want = MIRROR_PREFIX + engine.currentInput
    if (el.value !== want) {
      el.value = want
      el.setSelectionRange(want.length, want.length)
    }
  }, [engine])

  /** New text. */
  const restart = useCallback(() => {
    tabArmed.current = false
    setConfirming(false)
    const t = buildTest(config, Math.random, config.mode === 'quote' ? engine.words.join(' ') : undefined)
    engine.reset(t.words)
    inputRef.current?.focus({ preventScroll: true })
  }, [engine, config])

  const cancelConfirm = useCallback(() => {
    setConfirming(false)
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // When the restart confirmation opens, move focus into it so Enter / Escape work from anywhere.
  useEffect(() => {
    if (showConfirm) confirmBtnRef.current?.focus()
  }, [showConfirm])

  /** Same text. */
  const retry = useCallback(() => {
    setConfirming(false)
    engine.reset()
    inputRef.current?.focus({ preventScroll: true })
  }, [engine])

  const requestRestart = () => {
    if (settings.confirmRestart && engine.status === 'running') setConfirming(true)
    else restart()
  }

  // Caret + line scrolling: one measurement per animation frame.
  useEffect(() => {
    let alive = true
    let raf = 0

    const placeCaret = () => {
      const wrap = wordsRef.current
      const caret = caretRef.current
      const scroller = scrollerRef.current
      if (!wrap || !caret || !scroller) return
      const wordEl = wrap.children[engine.wordIndex] as HTMLElement | undefined
      if (!wordEl || wordEl.children.length === 0) return
      const letters = wordEl.children
      const idx = engine.currentInput.length
      const anchor = letters[Math.min(idx, letters.length - 1)] as HTMLElement
      const x = anchor.offsetLeft + (idx >= letters.length ? anchor.offsetWidth : 0)
      const h = anchor.offsetHeight
      const w = Math.max(anchor.offsetWidth, 8)
      const lineH = wordEl.offsetHeight
      const row = lineH > 0 ? Math.round(wordEl.offsetTop / lineH) : 0
      const offset = row >= 2 ? (row - 1) * lineH : 0 // keep the active line in the middle row
      scroller.style.transform = `translateY(${-offset}px)`
      const style = cursorStyleRef.current
      caret.style.width = style === 'line' ? '2px' : `${w}px`
      caret.style.height = style === 'underline' ? '3px' : `${h}px`
      const y = anchor.offsetTop + (style === 'underline' ? h - 3 : 0)
      caret.style.transform = `translate(${x}px, ${y}px)`
      caret.dataset.idle = engine.status === 'running' ? '0' : '1'
    }
    placeRef.current = placeCaret
    const schedule = () => {
      if (!alive || raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        placeCaret()
      })
    }

    const unsub = engine.subscribe(() => {
      syncMirror()
      schedule()
    })
    placeCaret()
    syncMirror()
    window.addEventListener('resize', schedule)
    void document.fonts?.ready.then(schedule)
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true })

    return () => {
      alive = false
      placeRef.current = null
      unsub()
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [engine, syncMirror])

  // Pressing a printable key anywhere (outside other inputs/dialogs) focuses the test and types it.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const input = inputRef.current
      if (!input || e.defaultPrevented || document.activeElement === input) return
      const t = e.target as HTMLElement | null
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest?.('[role="dialog"]'))) return
      const a = classifyKey({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        keyCode: e.keyCode,
        altGraph: e.getModifierState('AltGraph'),
      })
      if (a.type !== 'char') return
      if (a.char === ' ' && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return // keep Space activating buttons
      if (engine.status === 'finished') return // let Enter/Tab work on the results buttons
      e.preventDefault()
      input.focus({ preventScroll: true })
      engine.insert(a.char)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  // Keep the active line visible when a virtual keyboard resizes the viewport.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      if (document.activeElement === inputRef.current) viewportRef.current?.scrollIntoView({ block: 'center' })
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const a = classifyKey({
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
      keyCode: e.keyCode,
      altGraph: e.getModifierState('AltGraph'),
    })

    if (showConfirm) {
      // Restart confirmation is open: Enter confirms, Escape keeps typing, everything else is ignored.
      if (a.type === 'enter') restart()
      else if (a.type === 'escape') setConfirming(false)
      if (a.type !== 'ignore' && a.type !== 'defer') e.preventDefault()
      return
    }

    switch (a.type) {
      case 'char': {
        e.preventDefault()
        tabArmed.current = false
        const before = engine.strokeOk.length
        engine.insert(a.char)
        if (settings.sound && engine.strokeOk.length > before) playClick(engine.strokeOk[before])
        break
      }
      case 'backspace':
        e.preventDefault()
        tabArmed.current = false
        engine.backspace()
        break
      case 'deleteWord':
        e.preventDefault()
        tabArmed.current = false
        engine.deleteWord()
        break
      case 'tab': // Tab then Enter restarts (like Monkeytype)
        e.preventDefault()
        tabArmed.current = true
        break
      case 'enter':
        if (tabArmed.current) {
          e.preventDefault()
          tabArmed.current = false
          requestRestart()
        }
        break
      case 'stop': // Shift+Enter ends a zen session
        e.preventDefault()
        if (engine.free) engine.stop()
        break
      case 'escape': // release focus so Tab can navigate the page again
        tabArmed.current = false
        e.currentTarget.blur()
        break
      case 'block':
        e.preventDefault()
        break
      default:
        break
    }
  }

  let primary = ''
  if (config.mode === 'time') primary = String(status === 'idle' ? config.duration : live.sec)
  else if (config.mode === 'zen') primary = status === 'running' ? `${live.sec}s` : ''
  else primary = `${status === 'idle' ? 0 : live.words}/${wordCount}`

  const anim = settings.cursorAnimation
  const smooth = anim ? 'transition-transform duration-100 ease-out motion-reduce:transition-none' : ''

  return (
    <section className="w-full" aria-label="Typing test">
      {!finished && (
        <>
          <div aria-hidden="true" className="mb-1 flex h-9 items-baseline justify-center gap-4">
            <span className={`text-2xl ${status === 'running' ? 'text-accent' : 'text-muted'}`}>{primary}</span>
            {status === 'running' && settings.liveWpm && <span className="text-sm text-muted">{live.wpm} wpm</span>}
          </div>
          <div className="focus-fade mb-3 flex items-center justify-center gap-2 text-sm text-muted sm:text-base">
            <Globe size={16} />
            <span>{engine.free ? 'zen - type anything, shift + enter to finish' : 'english'}</span>
          </div>
        </>
      )}

      {/* While finished the viewport collapses (not unmounted) so the input stays focusable. */}
      <div
        ref={viewportRef}
        className={`typing-text relative select-none overflow-hidden leading-[1.8] ${finished ? 'h-0' : 'h-[5.4em]'}`}
      >
        <div aria-hidden="true" className={`transition-[opacity,filter] duration-150 ${focused ? '' : 'opacity-30 blur-[3px]'}`}>
          <div ref={scrollerRef} className={`relative ${smooth}`}>
            <span
              ref={caretRef}
              data-cursor={settings.cursorStyle}
              data-anim={anim ? '1' : '0'}
              style={{ width: 2, height: '1.3em' }}
              className={`caret absolute left-0 top-0 rounded-sm bg-accent will-change-transform ${smooth} ${focused ? '' : 'hidden'}`}
            />
            <div ref={wordsRef} className="flex flex-wrap">
              {Array.from({ length: wordCount }, (_, i) => (
                <Word key={i} engine={engine} index={i} blind={settings.blind} />
              ))}
            </div>
          </div>
        </div>

        {!focused && !finished && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center text-base text-text">
            click here or press any key to focus
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          defaultValue={MIRROR_PREFIX}
          aria-label="Typing input"
          aria-describedby="typing-hint typing-target"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={onKeyDown}
          onInput={(e) => applyInputValue(engine, e.currentTarget.value)}
          onPaste={(e) => e.preventDefault()}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            tabArmed.current = false
            setFocused(false)
          }}
          style={{ fontSize: 16 }}
          className="absolute inset-0 h-full w-full cursor-default bg-transparent text-transparent opacity-0 caret-transparent outline-none"
        />
      </div>

      <p id="typing-hint" className="sr-only">
        Press Escape to leave the typing area.
      </p>
      <p id="typing-target" className="sr-only">
        {engine.free ? 'Free typing. Press Shift plus Enter to finish.' : engine.words.join(' ')}
      </p>
      <div role="status" className="sr-only">
        {result
          ? `Test complete. ${Math.round(result.wpm)} words per minute, ${Math.round(result.accuracy)} percent accuracy.`
          : ''}
      </div>

      {finished && result && <Results stats={result} label={describeConfig(config)} onNext={restart} onRetry={retry} />}

      {!finished && (
        <div className="focus-fade mt-8 flex min-h-[3rem] flex-wrap items-center justify-center gap-4">
          {showConfirm ? (
            <div
              role="alert"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault() // also stops the global Escape -> command palette shortcut
                  cancelConfirm()
                }
              }}
              className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted"
            >
              <span>restart this test?</span>
              <button ref={confirmBtnRef} type="button" onClick={restart} className="rounded bg-sub px-3 py-1.5 text-accent hover:text-text">
                restart (enter)
              </button>
              <button type="button" onClick={cancelConfirm} className="rounded px-3 py-1.5 hover:text-text">
                keep typing (esc)
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={requestRestart}
                className="p-3 text-muted transition-colors hover:text-text"
                aria-label="Restart test"
                title="Restart test (tab + enter)"
              >
                <RotateCw size={18} />
              </button>
              {engine.free && (
                <button
                  type="button"
                  onClick={() => engine.stop()}
                  disabled={status !== 'running'}
                  className="rounded px-3 py-1.5 text-xs text-muted transition-colors hover:text-text disabled:opacity-40 disabled:hover:text-muted"
                >
                  finish
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
