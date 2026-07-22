import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE_NAME, verifyToken } from '../auth.js'
import { prisma } from '../db.js'
import type { MemberRole } from '../generated/prisma/client.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      companyRole?: MemberRole
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME]
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  try {
    const payload = verifyToken(token)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' })
  }
}

export function requireCompanyMember(paramName = 'companyId') {
  return async (req: Request<Record<string, string>>, res: Response, next: NextFunction) => {
    const companyId = req.params[paramName]
    const member = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: req.userId! } },
    })
    if (!member) {
      res.status(403).json({ error: 'Not a member of this company' })
      return
    }
    req.companyRole = member.role
    next()
  }
}

export function requireCompanyAdmin(paramName = 'companyId') {
  return async (req: Request<Record<string, string>>, res: Response, next: NextFunction) => {
    const companyId = req.params[paramName]
    const member = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: req.userId! } },
    })
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }
    req.companyRole = member.role
    next()
  }
}
