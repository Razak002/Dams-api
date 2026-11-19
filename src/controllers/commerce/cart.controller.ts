import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import * as cartService from '../../services/commerce/cart.service.js'
import { validateCartSchema } from '../../validators/cart.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory()

export const validateCart = factory.createHandlers(
  zValidator('json', validateCartSchema, validationHook),
  async (c) => {
    const { items } = c.req.valid('json')
    const result = await cartService.validateCartItems(items)
    return c.json({ status: 'success', ...result })
  }
)
