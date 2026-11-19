import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { User, type UserRole } from '../models/user.model.js'
import { verifyAuthToken } from '../utils/auth.js'

export const SESSION_COOKIE_NAME = 'dams_session'

export interface AuthContext {
  userId: string
  email: string
  role: UserRole
  token: string
}

export const requireAuth = createMiddleware<{ Variables: { auth: AuthContext } }>(
  async (c, next) => {
    const authHeader = c.req.header('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
    const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
    const token = bearerToken || cookieToken

    if (!token) {
      return c.json({ status: 'error', message: 'Authentication required' }, 401)
    }

    const payload = await verifyAuthToken(token)
    if (!payload) {
      return c.json({ status: 'error', message: 'Invalid or expired session' }, 401)
    }

    const user = await User.findOne({ publicId: payload.sub, isActive: true }).select(
      'role tokenVersion'
    )
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      return c.json({ status: 'error', message: 'Session has been revoked' }, 401)
    }

    c.set('auth', {
      userId: payload.sub,
      email: payload.email,
      role: user.role,
      token,
    })

    await next()
  }
)

export const requireRole = (...allowedRoles: UserRole[]) =>
  createMiddleware<{ Variables: { auth: AuthContext } }>(async (c, next) => {
    const { role } = c.get('auth')
    if (!allowedRoles.includes(role)) {
      return c.json({ status: 'error', message: 'Insufficient permissions' }, 403)
    }

    await next()
  })

export const optionalAuth = createMiddleware<{ Variables: { auth?: AuthContext } }>(
  async (c, next) => {
    const authHeader = c.req.header('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
    const token = bearerToken || getCookie(c, SESSION_COOKIE_NAME)

    if (token) {
      const payload = await verifyAuthToken(token)
      if (payload) {
        const user = await User.findOne({ publicId: payload.sub, isActive: true }).select(
          'role tokenVersion'
        )
        if (user && user.tokenVersion === (payload.tv ?? 0)) {
          c.set('auth', {
            userId: payload.sub,
            email: payload.email,
            role: user.role,
            token,
          })
        }
      }
    }

    await next()
  }
)
