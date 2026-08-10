import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, hashPassword, signToken, verifyPassword } from '../auth.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const isProduction = process.env.NODE_ENV === 'production'

// In production the API and the frontend are on different domains
// (e.g. onrender.com vs pages.dev), so the cookie must be SameSite=None to
// be sent on cross-site fetch requests. That requires Secure, which is fine
// since both Render and Cloudflare Pages serve over HTTPS. Locally, both
// run on localhost (different ports only), so Lax is enough and avoids
// needing HTTPS in dev.
const sameSite: 'none' | 'lax' = isProduction ? 'none' : 'lax'

const cookieOptions = {
  httpOnly: true,
  sameSite,
  secure: isProduction,
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
  path: '/',
}

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' })
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, passwordHash } })

    const token = signToken(user.id)
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions)
    res.status(201).json({ id: user.id, email: user.email })
  }),
)

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = signToken(user.id)
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions)
    res.json({ id: user.id, email: user.email })
  }),
)

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/', sameSite: cookieOptions.sameSite, secure: cookieOptions.secure })
  res.status(204).end()
})

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    res.json({ id: user.id, email: user.email })
  }),
)
