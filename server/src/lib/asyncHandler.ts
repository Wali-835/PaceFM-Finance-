import type { NextFunction, Request, Response } from 'express'

type AppRequest = Request<Record<string, string>>

type Handler = (req: AppRequest, res: Response, next: NextFunction) => Promise<unknown>

export function asyncHandler(handler: Handler) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}
