import { Hono } from 'hono'
import { getShippingRates } from '../controllers/commerce/shipping.controller.js'

export const shippingRouter = new Hono()

shippingRouter.get('/rates', ...getShippingRates)
