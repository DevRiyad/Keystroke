import type { ErrorRequestHandler, RequestHandler } from 'express'
import { HttpError, errorBody } from '../errors'
import type { Logger } from '../config/logger'

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found', 'Route not found'))
}

const DB_ERROR_NAMES = new Set(['MongooseError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNotConnectedError'])

export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (err, _req, res, next) => {
    if (res.headersSent) return next(err)

    if (err instanceof HttpError) {
      res.status(err.status).json(errorBody(err.code, err.message, err.details))
      return
    }
    const e = err as { type?: string; status?: number; name?: string }
    if (e.type === 'entity.too.large') {
      res.status(413).json(errorBody('payload_too_large', 'Request body is too large'))
      return
    }
    if (e.type === 'entity.parse.failed') {
      res.status(400).json(errorBody('invalid_json', 'Request body is not valid JSON'))
      return
    }
    if (e.name && DB_ERROR_NAMES.has(e.name)) {
      res.status(503).json(errorBody('database_unavailable', 'Persistence is temporarily unavailable'))
      return
    }
    // Unknown error: log the type only (messages can contain data), answer generically.
    logger.log('error', `unhandled error: ${e.name ?? 'Error'}`)
    res.status(500).json(errorBody('internal_error', 'Something went wrong'))
  }
