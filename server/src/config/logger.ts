/** Remove anything that looks like credentials from text before it is logged. */
export function redact(text: string): string {
  return text.replace(/\/\/[^@\s/]+@/g, '//[redacted]@').replace(/(password|pwd|secret|token)=([^&\s]+)/gi, '$1=[redacted]')
}

export type Level = 'info' | 'warn' | 'error'

export interface Logger {
  log(level: Level, message: string, meta?: Record<string, string | number | boolean>): void
}

/** One JSON line per event. Never pass request bodies, headers or connection strings here. */
export const consoleLogger: Logger = {
  log(level, message, meta) {
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg: redact(message), ...meta })
    if (level === 'error') console.error(line)
    else console.log(line)
  },
}

export const silentLogger: Logger = { log() {} }
