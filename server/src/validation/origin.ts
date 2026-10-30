/**
 * Browser requests are allowed when their Origin is on the allow-list OR is the same origin as the
 * server itself (Origin host == Host header). The second rule makes Vercel production, preview and custom
 * domains work without listing each one. Requests without an Origin header (curl, server-to-server) pass.
 */
export function isAllowedOrigin(origin: string | undefined, host: string | undefined, allowed: string[]): boolean {
  if (!origin) return true
  if (allowed.includes(origin)) return true
  try {
    const u = new URL(origin)
    return !!host && u.host === host && (u.protocol === 'https:' || u.protocol === 'http:')
  } catch {
    return false // e.g. the literal "null" origin
  }
}
