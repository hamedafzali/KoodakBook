import type { ErrorRequestHandler } from 'express'

/* Final middleware in the chain. Postgres error codes we can attribute to a
 * malformed request (bad type, not a server fault) map to 400; everything
 * else is logged and returned as a generic 500. Without this, an async
 * handler wrapped in asyncHandler would still surface the raw error as an
 * unhandled Express default, and pg-error-shaped input (e.g. a non-UUID
 * path param hitting a uuid column) would otherwise crash the process. */
const CLIENT_ERROR_PG_CODES = new Set([
  '22P02', // invalid_text_representation — e.g. malformed uuid/int literal
  '22007', // invalid_datetime_format
  '22003', // numeric_value_out_of_range
])

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const pgCode = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined
  if (pgCode && CLIENT_ERROR_PG_CODES.has(pgCode)) {
    res.status(400).json({ data: null, error: 'invalid request parameter' })
    return
  }
  console.error(err)
  res.status(500).json({ data: null, error: 'internal server error' })
}
