import { describe, expect, it } from 'vitest'
import { formatShareText, shareText } from './share'
import { describeConfig, DEFAULT_CONFIG } from '../modes/config'

const base = { wpm: 72.4, rawWpm: 80.2, accuracy: 96.3, consistency: 81.4, elapsedMs: 60000, label: 'time 60' }

describe('formatShareText', () => {
  it('formats real numbers', () => {
    expect(formatShareText(base)).toBe('keystroke: 72 wpm | raw 80 | 96% acc | 81% consistency | time 60 | 60s')
  })
  it('omits consistency when unavailable', () => {
    expect(formatShareText({ ...base, consistency: null })).toBe('keystroke: 72 wpm | raw 80 | 96% acc | time 60 | 60s')
  })
})

describe('shareText', () => {
  it('uses the share API when available', async () => {
    let shared = ''
    const r = await shareText('hi', { share: async (d) => void (shared = d.text), clipboard: { writeText: async () => {} } })
    expect(r).toBe('shared')
    expect(shared).toBe('hi')
  })
  it('treats a dismissed share sheet as cancelled (no clipboard write)', async () => {
    let copied = false
    const err = Object.assign(new Error('x'), { name: 'AbortError' })
    const r = await shareText('hi', {
      share: async () => {
        throw err
      },
      clipboard: { writeText: async () => void (copied = true) },
    })
    expect(r).toBe('cancelled')
    expect(copied).toBe(false)
  })
  it('falls back to the clipboard when sharing is unsupported or fails', async () => {
    let copied = ''
    const clipboard = { writeText: async (t: string) => void (copied = t) }
    expect(await shareText('a', { clipboard })).toBe('copied')
    expect(copied).toBe('a')
    expect(
      await shareText('b', {
        share: async () => {
          throw new Error('nope')
        },
        clipboard,
      }),
    ).toBe('copied')
    expect(copied).toBe('b')
  })
  it('reports failure when nothing works', async () => {
    expect(await shareText('a', {})).toBe('failed')
    expect(
      await shareText('a', {
        clipboard: {
          writeText: async () => {
            throw new Error('denied')
          },
        },
      }),
    ).toBe('failed')
  })
})

describe('describeConfig', () => {
  it('describes each mode', () => {
    expect(describeConfig(DEFAULT_CONFIG)).toBe('time 60')
    expect(describeConfig({ ...DEFAULT_CONFIG, mode: 'words', wordCount: 25, punctuation: true, numbers: true })).toBe('words 25 · punctuation · numbers')
    expect(describeConfig({ ...DEFAULT_CONFIG, mode: 'zen', punctuation: true })).toBe('zen')
  })
})
