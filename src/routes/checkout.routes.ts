import { Hono } from 'hono'
import { initializeCheckout, verifyOrder } from '../controllers/commerce/checkout.controller.js'
import { optionalAuth } from '../middleware/auth.middleware.js'
import { rateLimit } from '../middleware/rate-limit.middleware.js'

export const checkoutRouter = new Hono()

const initializeRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'checkout-init' })
const verifyRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'checkout-verify' })

checkoutRouter.post('/initialize', initializeRateLimit, optionalAuth, ...initializeCheckout)
checkoutRouter.get('/verify/:reference', verifyRateLimit, ...verifyOrder)
