import { Hono } from 'hono'
import { listPatronOrders, trackOrder } from '../controllers/commerce/order.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { rateLimit } from '../middleware/rate-limit.middleware.js'

export const ordersRouter = new Hono()

const trackRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'order-track',
})

ordersRouter.get('/', requireAuth, ...listPatronOrders)
ordersRouter.get('/track', trackRateLimit, ...trackOrder)
