import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createFactory } from 'hono/factory'
import { env } from '../../config/db.js'
import { SESSION_COOKIE_NAME, type AuthContext } from '../../middleware/auth.middleware.js'
import * as authService from '../../services/patron/auth.service.js'
import { verifyAuthToken } from '../../utils/auth.js'
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../../validators/auth.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

const getCookieOptions = () => {
  const isProd = env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'None' : 'Lax') as 'None' | 'Lax',
    path: '/',
  }
}

const setSessionCookie = (c: Context, token: string) => {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    ...getCookieOptions(),
    maxAge: 60 * 60 * 24 * 7,
  })
}

export const registerPatron = factory.createHandlers(
  zValidator('json', registerSchema, validationHook),
  async (c) => {
    const result = await authService.registerPatron(c.req.valid('json'))
    if (result.conflict) {
      return c.json({ status: 'error', message: 'An account with this email already exists' }, 409)
    }

    setSessionCookie(c, result.token)
    return c.json({ status: 'success', data: { token: result.token, user: result.user } }, 201)
  }
)

export const loginPatron = factory.createHandlers(
  zValidator('json', loginSchema, validationHook),
  async (c) => {
    const result = await authService.loginPatron(c.req.valid('json'))
    if (!result) {
      return c.json({ status: 'error', message: 'Invalid email or password' }, 401)
    }

    setSessionCookie(c, result.token)
    return c.json({ status: 'success', data: { token: result.token, user: result.user } })
  }
)

export const googleAuth = factory.createHandlers(
  zValidator('json', googleAuthSchema, validationHook),
  async (c) => {
    try {
      const result = await authService.loginWithGoogle(c.req.valid('json').idToken)
      if (result.inactive) {
        return c.json({ status: 'error', message: 'Account is inactive' }, 401)
      }

      setSessionCookie(c, result.token)
      return c.json({ status: 'success', data: { token: result.token, user: result.user } })
    } catch (err) {
      console.error('[Auth] Google authentication failed:', err)
      return c.json({ status: 'error', message: 'Google authentication failed' }, 401)
    }
  }
)

export const logoutPatron = async (c: Context) => {
  const authHeader = c.req.header('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  const token = bearerToken || getCookie(c, SESSION_COOKIE_NAME)

  if (token) {
    const payload = await verifyAuthToken(token)
    if (payload) {
      await authService.revokePatronSessions(payload.sub)
    }
  }

  deleteCookie(c, SESSION_COOKIE_NAME, getCookieOptions())
  return c.json({ status: 'success', message: 'Logged out successfully' })
}

export const getCurrentPatron = factory.createHandlers(async (c) => {
  const { userId, token } = c.get('auth')
  const user = await authService.getPatronById(userId)

  if (!user) {
    return c.json({ status: 'error', message: 'Patron account not found' }, 404)
  }

  return c.json({ status: 'success', data: { token, user } })
})

export const updatePatronProfile = factory.createHandlers(
  zValidator('json', updateProfileSchema, validationHook),
  async (c) => {
    const { userId } = c.get('auth')
    const user = await authService.updatePatronProfile(userId, c.req.valid('json'))

    if (!user) {
      return c.json({ status: 'error', message: 'Patron account not found' }, 404)
    }

    return c.json({ status: 'success', data: { user } })
  }
)

export const forgotPassword = factory.createHandlers(
  zValidator('json', forgotPasswordSchema, validationHook),
  async (c) => {
    const { email } = c.req.valid('json')
    await authService.requestPasswordReset(email)

    return c.json({
      status: 'success',
      message: 'If an account exists for that email, password reset instructions have been sent.',
    })
  }
)

export const resetPassword = factory.createHandlers(
  zValidator('json', resetPasswordSchema, validationHook),
  async (c) => {
    const ok = await authService.resetPassword(c.req.valid('json'))
    if (!ok) {
      return c.json({ status: 'error', message: 'Invalid or expired reset token' }, 400)
    }

    return c.json({ status: 'success', message: 'Password has been reset successfully.' })
  }
)
