import { Hono } from 'hono'
import { submitCustomOrder, trackCustomOrder } from '../controllers/concierge/custom-order.controller.js'
import { rateLimit } from '../middleware/rate-limit.middleware.js'

export const customOrdersRouter = new Hono()

const trackRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'custom-order-track',
})

customOrdersRouter.post('/', submitCustomOrder)
customOrdersRouter.get('/track/:referenceId', trackRateLimit, ...trackCustomOrder)
