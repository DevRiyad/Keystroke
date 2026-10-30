import { describe, expect, it } from 'vitest'
import { applyInputValue, charState, MAX_EXTRA_CHARS, MIRROR_PREFIX, TypingEngine } from './engine'
import { classifyKey } from './keys'

const type = (e: TypingEngine, s: string) => {
  for (const ch of s) e.insert(ch)
}
const k = (key: string, extra: Partial<Parameters<typeof classifyKey>[0]> = {}) =>
  classifyKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...extra })

function make(words = ['the', 'cat', 'sat'], t = { v: 0 }) {
  return { e: new TypingEngine(words, { now: () => t.v }), t }
}

describe('start / idle', () => {
  it('does not start until the first valid character', () => {
    const { e, t } = make()
    t.v = 100
    expect(e.status).toBe('idle')
    expect(e.insert(' ')).toBe(false) // space on empty word is ignored
    expect(e.backspace()).toBe(false)
    expect(e.status).toBe('idle')
    expect(e.startedAt).toBeNull()
    t.v = 250
    e.insert('t')
    expect(e.status).toBe('running')
    expect(e.startedAt).toBe(250)
  })

  it('ignores control characters and empty strings', () => {
    const { e } = make()
    expect(e.insert('\n')).toBe(false)
    expect(e.insert('\t')).toBe(false)
    expect(e.insert('')).toBe(false)
    expect(e.status).toBe('idle')
  })
})

describe('character states', () => {
  it('marks correct, incorrect, untyped and extra characters', () => {
    const { e } = make(['cat'])
    type(e, 'cx')
    expect(charState('cat', e.inputs[0], 0)).toBe('correct')
    expect(charState('cat', e.inputs[0], 1)).toBe('incorrect')
    expect(charState('cat', e.inputs[0], 2)).toBe('untyped')
    type(e, 'zzz')
    expect(charState('cat', e.inputs[0], 3)).toBe('extra')
    expect(e.inputs[0]).toBe('cxzzz')
  })

  it('never mutates the target text', () => {
    const { e } = make(['cat'])
    type(e, 'dog')
    expect(e.words[0]).toBe('cat')
  })

  it('caps extra characters', () => {
    const { e } = make(['a'])
    type(e, 'b'.repeat(100))
    expect(e.inputs[0].length).toBe(1 + MAX_EXTRA_CHARS)
  })
})

describe('words and space', () => {
  it('space commits the word and moves to the next', () => {
    const { e } = make()
    type(e, 'the ')
    expect(e.wordIndex).toBe(1)
    expect(e.inputs[0]).toBe('the')
  })

  it('space after an incomplete word commits it as typed', () => {
    const { e } = make()
    type(e, 'th ')
    expect(e.wordIndex).toBe(1)
    expect(e.inputs[0]).toBe('th')
  })

  it('repeated spaces on an empty word do nothing', () => {
    const { e } = make()
    type(e, 'the   ')
    expect(e.wordIndex).toBe(1)
    expect(e.inputs[1]).toBe('')
  })
})

describe('backspace', () => {
  it('removes the last character', () => {
    const { e } = make()
    type(e, 'thx')
    expect(e.backspace()).toBe(true)
    expect(e.inputs[0]).toBe('th')
  })

  it('returns to the previous word only when it was incorrect', () => {
    const { e } = make()
    type(e, 'thx ') // incorrect
    expect(e.wordIndex).toBe(1)
    expect(e.backspace()).toBe(true)
    expect(e.wordIndex).toBe(0)
    expect(e.inputs[0]).toBe('thx')
  })

  it('locks correct words', () => {
    const { e } = make()
    type(e, 'the ')
    expect(e.backspace()).toBe(false)
    expect(e.wordIndex).toBe(1)
  })

  it('does nothing at the very start', () => {
    const { e } = make()
    expect(e.backspace()).toBe(false)
  })

  it('deleteWord clears the word, then steps back into an incorrect word', () => {
    const { e } = make()
    type(e, 'thx ca')
    expect(e.deleteWord()).toBe(true)
    expect(e.inputs[1]).toBe('')
    expect(e.deleteWord()).toBe(true)
    expect(e.wordIndex).toBe(0)
    expect(e.inputs[0]).toBe('')
  })
})

describe('finish', () => {
  it('finishes when the last word is typed exactly', () => {
    const { e, t } = make()
    type(e, 'the cat sa')
    expect(e.status).toBe('running')
    t.v = 900
    e.insert('t')
    expect(e.status).toBe('finished')
    expect(e.finishedAt).toBe(900)
  })

  it('finishes on space after a wrong last word', () => {
    const { e } = make()
    type(e, 'the cat sax ')
    expect(e.status).toBe('finished')
  })

  it('does not finish on a wrong last word without space', () => {
    const { e } = make()
    type(e, 'the cat sax')
    expect(e.status).toBe('running')
  })

  it('rejects input after finishing', () => {
    const { e } = make(['a'])
    e.insert('a')
    expect(e.status).toBe('finished')
    expect(e.insert('b')).toBe(false)
    expect(e.backspace()).toBe(false)
    expect(e.inputs[0]).toBe('a')
  })
})

describe('reset', () => {
  it('restores a clean idle state and keeps the text', () => {
    const { e } = make()
    type(e, 'the ca')
    e.reset()
    expect(e.status).toBe('idle')
    expect(e.wordIndex).toBe(0)
    expect(e.inputs).toEqual(['', '', ''])
    expect(e.startedAt).toBeNull()
    expect(e.words).toEqual(['the', 'cat', 'sat'])
  })

  it('accepts new words and clears old timing', () => {
    const { e, t } = make()
    t.v = 5
    e.insert('t')
    e.reset(['hello', 'world'])
    expect(e.words).toEqual(['hello', 'world'])
    expect(e.startedAt).toBeNull()
    t.v = 50
    e.insert('h')
    expect(e.startedAt).toBe(50)
  })

  it('works after a finished test', () => {
    const { e } = make(['a'])
    e.insert('a')
    e.reset()
    expect(e.status).toBe('idle')
    expect(e.insert('a')).toBe(true)
  })
})

describe('subscriptions', () => {
  it('notifies only the changed word, plus global listeners', () => {
    const { e } = make()
    let w0 = 0
    let w1 = 0
    let all = 0
    e.subscribeWord(0, () => w0++)
    e.subscribeWord(1, () => w1++)
    e.subscribe(() => all++)
    type(e, 'th')
    expect(w0).toBe(2)
    expect(w1).toBe(0)
    expect(all).toBe(2)
  })

  it('changes the version of a word only when it changes', () => {
    const { e } = make()
    const v1 = e.versions[1]
    e.insert('t')
    expect(e.versions[1]).toBe(v1)
    expect(e.versions[0] === v1).toBe(false)
  })

  it('removes listeners on unsubscribe', () => {
    const { e } = make()
    const a = e.subscribe(() => {})
    const b = e.subscribeWord(0, () => {})
    expect(e.listenerCount()).toBe(2)
    a()
    b()
    expect(e.listenerCount()).toBe(0)
  })
})

describe('mirror input (mobile / IME path)', () => {
  it('appends characters', () => {
    const { e } = make()
    applyInputValue(e, MIRROR_PREFIX + 'th')
    expect(e.inputs[0]).toBe('th')
  })

  it('handles backspace', () => {
    const { e } = make()
    type(e, 'thx')
    applyInputValue(e, MIRROR_PREFIX + 'th')
    expect(e.inputs[0]).toBe('th')
  })

  it('handles a trailing space as a word commit', () => {
    const { e } = make()
    applyInputValue(e, MIRROR_PREFIX + 'the ')
    expect(e.wordIndex).toBe(1)
    expect(e.inputs[0]).toBe('the')
  })

  it('handles autocorrect-style replacement', () => {
    const { e } = make()
    type(e, 'teh')
    applyInputValue(e, MIRROR_PREFIX + 'the')
    expect(e.inputs[0]).toBe('the')
  })

  it('goes back a word when the sentinel is deleted at word start', () => {
    const { e } = make()
    type(e, 'thx ')
    applyInputValue(e, '')
    expect(e.wordIndex).toBe(0)
  })
})

describe('classifyKey', () => {
  it('maps printable keys to characters, keeping capitalization', () => {
    expect(k('a')).toEqual({ type: 'char', char: 'a' })
    expect(k('A')).toEqual({ type: 'char', char: 'A' })
    expect(k(' ')).toEqual({ type: 'char', char: ' ' })
    expect(k('é')).toEqual({ type: 'char', char: 'é' })
  })

  it('ignores browser shortcuts but accepts AltGr characters', () => {
    expect(k('c', { ctrlKey: true })).toEqual({ type: 'ignore' })
    expect(k('r', { metaKey: true })).toEqual({ type: 'ignore' })
    expect(k('@', { ctrlKey: true, altKey: true, altGraph: true })).toEqual({ type: 'char', char: '@' })
  })

  it('classifies editing and control keys', () => {
    expect(k('Backspace')).toEqual({ type: 'backspace' })
    expect(k('Backspace', { ctrlKey: true })).toEqual({ type: 'deleteWord' })
    expect(k('Tab')).toEqual({ type: 'tab' })
    expect(k('Enter')).toEqual({ type: 'enter' })
    expect(k('Enter', { shiftKey: true })).toEqual({ type: 'stop' })
    expect(k('Escape')).toEqual({ type: 'escape' })
    expect(k('ArrowLeft')).toEqual({ type: 'block' })
    expect(k('Shift')).toEqual({ type: 'ignore' })
    expect(k('F5')).toEqual({ type: 'ignore' })
  })

  it('defers composition and mobile keys to the input event', () => {
    expect(k('Unidentified')).toEqual({ type: 'defer' })
    expect(k('Dead')).toEqual({ type: 'defer' })
    expect(k('a', { isComposing: true })).toEqual({ type: 'defer' })
    expect(k('a', { keyCode: 229 })).toEqual({ type: 'defer' })
  })
})
