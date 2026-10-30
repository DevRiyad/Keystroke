export class HttpError extends Error {
  status: number
  code: string
  details?: string[]

  constructor(status: number, code: string, message: string, details?: string[]) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: string[] }
}

export const errorBody = (code: string, message: string, details?: string[]): ErrorBody => ({
  error: { code, message, ...(details ? { details } : {}) },
})

export const badRequest = (message: string, details?: string[]) => new HttpError(400, 'invalid_request', message, details)
