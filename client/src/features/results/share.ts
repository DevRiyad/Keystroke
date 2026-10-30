export interface ShareInput {
  wpm: number
  rawWpm: number
  accuracy: number
  consistency: number | null
  elapsedMs: number
  label: string
}

export function formatShareText(r: ShareInput): string {
  const parts = [
    `${Math.round(r.wpm)} wpm`,
    `raw ${Math.round(r.rawWpm)}`,
    `${Math.round(r.accuracy)}% acc`,
  ]
  if (r.consistency !== null) parts.push(`${Math.round(r.consistency)}% consistency`)
  parts.push(r.label, `${Math.round(r.elapsedMs / 1000)}s`)
  return `keystroke: ${parts.join(' | ')}`
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareEnv {
  share?: (data: { title?: string; text: string }) => Promise<void>
  clipboard?: { writeText(text: string): Promise<void> }
}

/** Use the Web Share API when available, otherwise copy to the clipboard. */
export async function shareText(text: string, env: ShareEnv): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share({ title: 'keystroke result', text })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      // any other share failure: fall back to the clipboard
    }
  }
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'failed'
    }
  }
  return 'failed'
}

export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  return {
    share: nav && typeof nav.share === 'function' ? (d) => nav.share(d) : undefined,
    clipboard: nav?.clipboard,
  }
}
