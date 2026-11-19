import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as adminOrderService from '../../services/admin/admin-order.service.js'
import { adminIdParamSchema } from '../../validators/admin-catalog.validators.js'
import {
  adminCreateManualOrderSchema,
  adminListOrdersQuerySchema,
  adminUpdateOrderStatusSchema,
} from '../../validators/admin-order.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const listAdminOrders = factory.createHandlers(
  zValidator('query', adminListOrdersQuerySchema, validationHook),
  async (c) => {
    const result = await adminOrderService.listAdminOrders(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const getAdminOrderById = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminOrderService.getAdminOrderById(id)
    if (!data) {
      return c.json({ status: 'error', message: 'Order not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const updateOrderStatus = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminUpdateOrderStatusSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await adminOrderService.updateOrderStatus(id, c.req.valid('json'))

    if (result.state === 'not_found') {
      return c.json({ status: 'error', message: 'Order not found' }, 404)
    }
    if (result.state === 'invalid_transition') {
      return c.json(
        { status: 'error', message: `Cannot transition order from ${result.from}` },
        409
      )
    }

    return c.json({ status: 'success', data: result.order })
  }
)

export const createManualOrder = factory.createHandlers(
  zValidator('json', adminCreateManualOrderSchema, validationHook),
  async (c) => {
    const { email } = c.get('auth')
    const result = await adminOrderService.createManualOrder(c.req.valid('json'), email)
    if (!result.ok) {
      return c.json({ status: 'error', message: result.message }, result.status)
    }

    return c.json({ status: 'success', data: result.data }, 201)
  }
)
