/**
 * Core typing engine: a framework-free, mutable state machine.
 *
 * Why mutable: typing is a high-frequency path. React subscribes per word
 * (subscribeWord) so only the word that changed re-renders.
 *
 * Model:
 *  - the test is a list of words; each word has its own input string
 *  - Space commits the current word (ignored when the word input is empty)
 *  - extra characters beyond the target word are allowed (max MAX_EXTRA_CHARS)
 *  - Backspace removes a char; at the start of a word it returns to the previous
 *    word only if that word was typed incorrectly (correct words are locked)
 *  - the test starts on the first valid character (not on click / focus)
 *  - fixed-text tests finish when the last word is typed exactly, or Space is
 *    pressed on the last word
 *  - time-limited tests finish when performance.now() says the limit has passed.
 *    The clock is the source of truth (not interval counts), so a throttled
 *    tab still ends at exactly startedAt + limit; keys arriving after that
 *    are rejected.
 *  - "free" (zen) tests have no target: every typed word becomes its own target
 *    and the session ends only via stop()
 *
 * Limitation: characters are UTF-16 code units. Fine for English; Bangla
 * (combining marks / grapheme clusters) will need a grapheme-aware layer.
 */

export type Status = 'idle' | 'running' | 'finished'
export type CharState = 'correct' | 'incorrect' | 'extra' | 'untyped'

export const MAX_EXTRA_CHARS = 19
export const REFILL_THRESHOLD = 30
export const REFILL_CHUNK = 50
/** Mirror input holds " " + current word input so mobile Backspace at word start is detectable. */
export const MIRROR_PREFIX = ' '

export interface EngineOptions {
  /** Monotonic clock in ms. Defaults to performance.now(). Injectable for tests. */
  now?: () => number
  maxExtra?: number
  /** End the test this many ms after the first keystroke. */
  timeLimitMs?: number | null
  /** Zen mode: no target text, everything typed is correct. */
  free?: boolean
  /** Supplies more words when fewer than REFILL_THRESHOLD remain (time mode). */
  refill?: (count: number, recent: string[]) => string[]
  /** Confidence mode: Backspace can never go back to a previous word. */
  confidence?: boolean
  /** Strict mode: wrong keys are rejected (still counted as mistakes); Space needs a correct word. */
  strict?: boolean
}

export function charState(target: string, input: string, index: number): CharState {
  if (index >= target.length) return 'extra'
  if (index >= input.length) return 'untyped'
  return input[index] === target[index] ? 'correct' : 'incorrect'
}

export class TypingEngine {
  words: string[] = []
  inputs: string[] = []
  /** committed[i] = Space was pressed on word i (it was left behind). */
  committed: boolean[] = []
  /** Per-word change token (unique, monotonically increasing). */
  versions: number[] = []
  wordIndex = 0
  status: Status = 'idle'
  startedAt: number | null = null
  finishedAt: number | null = null
  /** Keystroke log (ms since start, was-correct). Backspace is not a keystroke. */
  strokeTimes: number[] = []
  strokeOk: boolean[] = []
  correctKeys = 0
  incorrectKeys = 0

  confidence = false
  strict = false
  readonly timeLimitMs: number | null
  readonly free: boolean

  private tick_ = 0
  private readonly now: () => number
  private readonly maxExtra: number
  private readonly refill?: (count: number, recent: string[]) => string[]
  private wordListeners = new Map<number, Set<() => void>>()
  private listeners = new Set<() => void>()

  constructor(words: string[], options: EngineOptions = {}) {
    this.now = options.now ?? (() => performance.now())
    this.maxExtra = options.maxExtra ?? MAX_EXTRA_CHARS
    this.timeLimitMs = options.timeLimitMs ?? null
    this.free = options.free ?? false
    this.refill = options.refill
    this.confidence = options.confidence ?? false
    this.strict = options.strict ?? false
    this.load(this.free ? [''] : words)
  }

  /** Subscribe to every change (caret, status). Returns an unsubscribe function. */
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  /** Subscribe to changes of a single word. Returns an unsubscribe function. */
  subscribeWord(index: number, cb: () => void): () => void {
    let set = this.wordListeners.get(index)
    if (!set) {
      set = new Set()
      this.wordListeners.set(index, set)
    }
    set.add(cb)
    return () => {
      const s = this.wordListeners.get(index)
      if (!s) return
      s.delete(cb)
      if (s.size === 0) this.wordListeners.delete(index)
    }
  }

  /** Change typing rules mid-test (settings). Takes effect on the next key. */
  setRules(r: { confidence?: boolean; strict?: boolean }): void {
    if (r.confidence !== undefined) this.confidence = r.confidence
    if (r.strict !== undefined) this.strict = r.strict
  }

  /** Total number of active listeners (used by tests to check cleanup). */
  listenerCount(): number {
    let n = this.listeners.size
    this.wordListeners.forEach((s) => {
      n += s.size
    })
    return n
  }

  get currentInput(): string {
    return this.inputs[this.wordIndex] ?? ''
  }

  /** Milliseconds of test time so far (0 when idle, capped at the time limit). */
  elapsedMs(): number {
    if (this.startedAt === null) return 0
    const end = this.finishedAt ?? this.now()
    const el = Math.max(0, end - this.startedAt)
    return this.timeLimitMs !== null ? Math.min(el, this.timeLimitMs) : el
  }

  /** Check the clock. Call from a timer / visibilitychange; also runs on every key. */
  tick(): void {
    this.expire()
  }

  /** End a running test early (zen "finish", or any early termination). */
  stop(): void {
    this.expire()
    if (this.status === 'running') {
      this.finish()
      this.emit()
    }
  }

  /** Insert one character (or commit the word when ch is a space). */
  insert(ch: string): boolean {
    this.expire()
    if (this.status === 'finished' || ch.length === 0) return false
    if (ch === ' ') return this.commitWord()
    if (ch < ' ') return false // control characters, newlines, tabs

    const wi = this.wordIndex
    const cur = this.inputs[wi]
    if (!this.free && this.strict && ch !== this.words[wi][cur.length]) {
      // strict mode: a wrong (or extra) key is rejected but still counts as a mistake
      this.start()
      this.recordStroke(false)
      this.emit()
      return false
    }
    if (cur.length >= this.words[wi].length + this.maxExtra) return false

    this.start()
    this.recordStroke(this.free || (cur.length < this.words[wi].length && ch === this.words[wi][cur.length]))
    this.inputs[wi] = cur + ch
    if (this.free) this.words[wi] = this.inputs[wi]
    this.touch(wi)
    if (!this.free && wi === this.words.length - 1 && this.inputs[wi] === this.words[wi]) this.finish()
    this.emit()
    return true
  }

  backspace(): boolean {
    this.expire()
    if (this.status === 'finished') return false
    const wi = this.wordIndex
    if (this.inputs[wi].length > 0) {
      this.inputs[wi] = this.inputs[wi].slice(0, -1)
      if (this.free) this.words[wi] = this.inputs[wi]
      this.touch(wi)
      this.emit()
      return true
    }
    if (wi > 0 && this.canReturnTo(wi - 1)) {
      this.wordIndex = wi - 1
      this.committed[wi - 1] = false
      this.touch(wi - 1)
      this.touch(wi)
      this.emit()
      return true
    }
    return false
  }

  /** Ctrl/Alt+Backspace: clear the current word; if already empty, clear the previous (incorrect) word. */
  deleteWord(): boolean {
    this.expire()
    if (this.status === 'finished') return false
    const wi = this.wordIndex
    if (this.inputs[wi] !== '') {
      this.inputs[wi] = ''
      if (this.free) this.words[wi] = ''
      this.touch(wi)
      this.emit()
      return true
    }
    if (wi > 0 && this.canReturnTo(wi - 1)) {
      this.wordIndex = wi - 1
      this.inputs[wi - 1] = ''
      if (this.free) this.words[wi - 1] = ''
      this.committed[wi - 1] = false
      this.touch(wi - 1)
      this.touch(wi)
      this.emit()
      return true
    }
    return false
  }

  /**
   * Make the current word's input equal `next` using the minimal edit
   * (backspaces to the common prefix, then inserts). Used by the
   * composition / mobile input path so replacements (autocorrect, dead keys)
   * behave like real keystrokes.
   */
  applyWordText(next: string): void {
    const cur = this.currentInput
    let p = 0
    while (p < cur.length && p < next.length && cur[p] === next[p]) p++
    for (let k = cur.length; k > p; k--) this.backspace()
    for (const ch of next.slice(p)) this.insert(ch)
  }

  /** Restart. Pass new words to replace the text, or nothing to retry the same text. */
  reset(words: string[] = this.words): void {
    this.load(this.free ? [''] : words)
    this.wordListeners.forEach((set) => set.forEach((l) => l()))
    this.emit()
  }

  private load(words: string[]): void {
    this.words = words.slice()
    this.inputs = words.map(() => '')
    this.committed = words.map(() => false)
    this.versions = words.map(() => ++this.tick_)
    this.wordIndex = 0
    this.status = 'idle'
    this.startedAt = null
    this.finishedAt = null
    this.strokeTimes = []
    this.strokeOk = []
    this.correctKeys = 0
    this.incorrectKeys = 0
  }

  private pushWords(words: string[]): void {
    for (const w of words) {
      this.words.push(w)
      this.inputs.push('')
      this.committed.push(false)
      this.versions.push(++this.tick_)
    }
  }

  private maybeRefill(): void {
    if (this.refill && this.words.length - this.wordIndex < REFILL_THRESHOLD) {
      this.pushWords(this.refill(REFILL_CHUNK, this.words.slice(-3)))
    }
  }

  private commitWord(): boolean {
    const wi = this.wordIndex
    if (this.inputs[wi] === '') return false
    if (this.strict && !this.free && this.inputs[wi] !== this.words[wi]) return false
    this.start()
    this.recordStroke(this.free || this.inputs[wi] === this.words[wi])
    this.committed[wi] = true
    if (this.free) {
      this.words[wi] = this.inputs[wi]
      if (wi === this.words.length - 1) this.pushWords([''])
    }
    this.touch(wi)
    if (wi === this.words.length - 1) {
      this.finish() // last word of a fixed text
    } else {
      this.wordIndex = wi + 1
      this.maybeRefill()
    }
    this.emit()
    return true
  }

  private canReturnTo(index: number): boolean {
    if (this.confidence) return false
    return this.free || this.inputs[index] !== this.words[index]
  }

  private recordStroke(ok: boolean): void {
    this.strokeTimes.push(this.startedAt === null ? 0 : this.now() - this.startedAt)
    this.strokeOk.push(ok)
    if (ok) this.correctKeys++
    else this.incorrectKeys++
  }

  private start(): void {
    if (this.status !== 'idle') return
    this.status = 'running'
    this.startedAt = this.now()
  }

  private finish(): void {
    this.status = 'finished'
    this.finishedAt = this.now()
  }

  /** Time-limit check. Finishes at exactly startedAt + limit, even if called late. */
  private expire(): void {
    if (this.status !== 'running' || this.timeLimitMs === null || this.startedAt === null) return
    if (this.now() - this.startedAt >= this.timeLimitMs) {
      this.status = 'finished'
      this.finishedAt = this.startedAt + this.timeLimitMs
      this.emit()
    }
  }

  private touch(index: number): void {
    this.versions[index] = ++this.tick_
    const set = this.wordListeners.get(index)
    if (set) set.forEach((l) => l())
  }

  private emit(): void {
    this.listeners.forEach((l) => l())
  }
}

/**
 * Apply the value of the mirror <input> (mobile / IME path) to the engine.
 * The mirror always holds MIRROR_PREFIX + current word input.
 */
export function applyInputValue(engine: TypingEngine, value: string): void {
  if (value === '' && engine.currentInput === '') {
    engine.backspace() // sentinel deleted at word start -> go back a word
    return
  }
  const next = value.startsWith(MIRROR_PREFIX) ? value.slice(MIRROR_PREFIX.length) : value
  const parts = next.split(' ')
  engine.applyWordText(parts[0])
  for (let k = 1; k < parts.length; k++) {
    engine.insert(' ')
    engine.applyWordText(parts[k])
  }
}
