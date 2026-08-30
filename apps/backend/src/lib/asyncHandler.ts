import type { NextFunction, Request, RequestHandler, Response } from 'express'

/* Express 4 does not forward a rejected promise from an async route handler
 * to error middleware — it becomes an unhandled rejection and crashes the
 * process (learned the hard way: a malformed UUID in a path param threw a
 * Postgres error that took the whole backend down instead of returning 400).
 * Wrap every async handler with this so its rejection reaches next(err). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
