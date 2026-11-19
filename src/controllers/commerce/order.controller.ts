import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as orderService from '../../services/commerce/order.service.js'
import { validationHook } from '../../validators/common.validators.js'
import {
  listPatronOrdersQuerySchema,
  trackOrderQuerySchema,
} from '../../validators/order.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const listPatronOrders = factory.createHandlers(
  zValidator('query', listPatronOrdersQuerySchema, validationHook),
  async (c) => {
    const { userId } = c.get('auth')
    const result = await orderService.listPatronOrders(userId, c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const trackOrder = factory.createHandlers(
  zValidator('query', trackOrderQuerySchema, validationHook),
  async (c) => {
    const data = await orderService.trackOrder(c.req.valid('query'))
    if (!data) {
      return c.json({ status: 'error', message: 'Order not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)
