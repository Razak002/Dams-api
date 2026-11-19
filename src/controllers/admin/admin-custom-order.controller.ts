import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as adminCustomOrderService from '../../services/admin/admin-custom-order.service.js'
import { adminIdParamSchema } from '../../validators/admin-catalog.validators.js'
import {
  adminListCustomOrdersQuerySchema,
  adminUpdateCustomOrderSchema,
} from '../../validators/admin-custom-order.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const listAdminCustomOrders = factory.createHandlers(
  zValidator('query', adminListCustomOrdersQuerySchema, validationHook),
  async (c) => {
    const result = await adminCustomOrderService.listAdminCustomOrders(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const getAdminCustomOrderById = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminCustomOrderService.getAdminCustomOrderById(id)
    if (!data) {
      return c.json({ status: 'error', message: 'Custom order commission not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const updateAdminCustomOrder = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminUpdateCustomOrderSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await adminCustomOrderService.updateAdminCustomOrder(id, c.req.valid('json'))

    if (result.state === 'not_found') {
      return c.json({ status: 'error', message: 'Custom order commission not found' }, 404)
    }
    if (result.state === 'bad_request') {
      return c.json({ status: 'error', message: result.message }, result.status)
    }

    return c.json({ status: 'success', data: result.data })
  }
)
