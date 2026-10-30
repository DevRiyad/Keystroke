import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { HttpError, badRequest } from '../errors'
import { parseGuestId } from '../validation/common'
import { isAllowedOrigin } from '../validation/origin'

/** Express 4 does not catch rejected promises; forward them to the error handler. */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

export const requireDb =
  (isDbReady: () => boolean): RequestHandler =>
  (_req, _res, next) => {
    next(isDbReady() ? undefined : new HttpError(503, 'database_unavailable', 'Persistence is temporarily unavailable. The typing test itself is not affected.'))
  }

/** Guest identity comes from the X-Guest-Id header. It identifies a browser, it is not authentication. */
export const requireGuest: RequestHandler = (req, res, next) => {
  const id = parseGuestId(req.header('x-guest-id'))
  if (!id) return next(badRequest('X-Guest-Id header is required (16-64 characters: letters, digits, - _)'))
  res.locals.guestId = id
  next()
}

/** Reject browser requests from other origins (allow-list or same-origin only). */
export const originGuard =
  (allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!isAllowedOrigin(req.header('origin'), req.header('host'), allowed)) {
      return next(new HttpError(403, 'origin_not_allowed', 'Origin not allowed'))
    }
    next()
  }
