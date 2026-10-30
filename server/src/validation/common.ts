export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] }

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const round2 = (n: number) => Math.round(n * 100) / 100

export const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

/** Guest ids are random client-generated identifiers, NOT credentials. */
export function parseGuestId(header: unknown): string | null {
  return typeof header === 'string' && GUEST_ID_PATTERN.test(header) ? header : null
}

export function parseLimit(raw: unknown, fallback: number, max: number): number | null {
  if (raw === undefined) return fallback
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 && n <= max ? n : null
}
