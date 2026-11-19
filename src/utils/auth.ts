import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sign, verify } from 'hono/jwt'
import { env } from '../config/db.js'
import type { UserRole } from '../models/user.model.js'

const scryptAsync = promisify(scrypt)
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface AuthJwtPayload {
  sub: string
  email: string
  role: UserRole
  tv?: number
  exp: number
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, keyHex] = storedHash.split(':')
  if (!salt || !keyHex) return false

  const expected = Buffer.from(keyHex, 'hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  if (expected.length !== derived.length) return false

  return timingSafeEqual(expected, derived)
}

export const signAuthToken = async (
  userId: string,
  email: string,
  role: UserRole,
  tokenVersion = 0
): Promise<string> => {
  const payload = {
    sub: userId,
    email,
    role,
    tv: tokenVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  return sign(payload, env.JWT_SECRET, 'HS256')
}

export const verifyAuthToken = async (token: string): Promise<AuthJwtPayload | null> => {
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null
    }
    return payload as unknown as AuthJwtPayload
  } catch {
    return null
  }
}

export const hashResetToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}
