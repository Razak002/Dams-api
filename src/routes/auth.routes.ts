import { Hono } from 'hono'
import {
  forgotPassword,
  getCurrentPatron,
  googleAuth,
  loginPatron,
  logoutPatron,
  registerPatron,
  resetPassword,
  updatePatronProfile,
} from '../controllers/patron/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { rateLimit } from '../middleware/rate-limit.middleware.js'

export const authRouter = new Hono()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'patron-auth',
})

authRouter.post('/register', authRateLimit, ...registerPatron)
authRouter.post('/login', authRateLimit, ...loginPatron)
authRouter.post('/google', authRateLimit, ...googleAuth)
authRouter.post('/logout', logoutPatron)
authRouter.post('/forgot-password', authRateLimit, ...forgotPassword)
authRouter.post('/reset-password', authRateLimit, ...resetPassword)

authRouter.get('/me', requireAuth, ...getCurrentPatron)
authRouter.patch('/me', requireAuth, ...updatePatronProfile)
