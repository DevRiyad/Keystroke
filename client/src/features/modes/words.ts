// English word bank. To add a language later, add another list and pass it to generateWords.
export const ENGLISH_WORDS: string[] = Array.from(
  new Set(
    ('the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line').split(' '),
  ),
)

export interface GenOptions {
  count: number
  punctuation?: boolean
  numbers?: boolean
  /** Returns [0, 1). Injectable for tests. */
  rng?: () => number
  /** Words that came just before (to avoid repeats / continue sentence capitalization). */
  recent?: string[]
  words?: string[]
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '')

export function generateWords(o: GenOptions): string[] {
  const rng = o.rng ?? Math.random
  const bank = o.words ?? ENGLISH_WORDS
  const recentRaw = o.recent ?? []
  const recent = recentRaw.map(norm).slice(-3)
  let capNext = !!o.punctuation && (recentRaw.length === 0 || /[.?!]$/.test(recentRaw[recentRaw.length - 1]))
  const out: string[] = []

  for (let i = 0; i < o.count; i++) {
    let w: string
    if (o.numbers && rng() < 0.1) {
      const len = 1 + Math.floor(rng() * 4)
      w = String(Math.floor(rng() * 10 ** len))
    } else {
      let tries = 0
      do {
        w = bank[Math.floor(rng() * bank.length)]
      } while (recent.includes(w) && ++tries < 6)
    }

    if (o.punctuation) {
      if (capNext && /^[a-z]/.test(w)) w = w[0].toUpperCase() + w.slice(1)
      capNext = false
      const r = rng()
      if (r < 0.07) {
        w += '.'
        capNext = true
      } else if (r < 0.17) {
        w += ','
      } else if (r < 0.19) {
        w += '?'
        capNext = true
      } else if (r < 0.2) {
        w += '!'
        capNext = true
      }
    }

    out.push(w)
    recent.push(norm(w))
    if (recent.length > 3) recent.shift()
  }
  return out
}
