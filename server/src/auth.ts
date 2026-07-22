import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET
  if (!value) {
    throw new Error('Missing JWT_SECRET environment variable')
  }
  return value
}

const JWT_SECRET: string = requireJwtSecret()

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const AUTH_COOKIE_NAME = 'pacefm_token'
export const AUTH_COOKIE_MAX_AGE_MS = TOKEN_TTL_SECONDS * 1000

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })
}

export function verifyToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string }
}
