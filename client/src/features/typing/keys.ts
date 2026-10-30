export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey?: boolean
  isComposing?: boolean
  keyCode?: number
  /** getModifierState('AltGraph'): AltGr reports ctrl+alt on Windows but types a real character. */
  altGraph?: boolean
}

export type KeyAction =
  | { type: 'char'; char: string }
  | { type: 'backspace' }
  | { type: 'deleteWord' }
  | { type: 'tab' }
  | { type: 'enter' }
  | { type: 'stop' } // Shift+Enter: end the session (zen)
  | { type: 'escape' }
  | { type: 'block' } // navigation keys that would move the caret of the hidden input
  | { type: 'defer' } // IME / mobile / dead keys: handled by the input event
  | { type: 'ignore' } // let the browser handle it (shortcuts, modifiers, F-keys)

const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Delete'])

export function classifyKey(e: KeyLike): KeyAction {
  if (e.isComposing || e.keyCode === 229 || e.key === 'Unidentified' || e.key === 'Process' || e.key === 'Dead') {
    return { type: 'defer' }
  }
  const mod = !e.altGraph && (e.ctrlKey || e.metaKey || e.altKey)
  if (e.key === 'Backspace') return { type: mod ? 'deleteWord' : 'backspace' }
  if (e.key === 'Tab') return { type: 'tab' }
  if (e.key === 'Enter') return e.shiftKey && !mod ? { type: 'stop' } : { type: 'enter' }
  if (e.key === 'Escape') return { type: 'escape' }
  if (BLOCKED.has(e.key)) return mod ? { type: 'ignore' } : { type: 'block' }
  if ([...e.key].length === 1) return mod ? { type: 'ignore' } : { type: 'char', char: e.key }
  return { type: 'ignore' }
}
