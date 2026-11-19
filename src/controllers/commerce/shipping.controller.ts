import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import * as shippingService from '../../services/commerce/shipping.service.js'
import { validationHook } from '../../validators/common.validators.js'
import { shippingRatesQuerySchema } from '../../validators/shipping.validators.js'

const factory = createFactory()

export const getShippingRates = factory.createHandlers(
  zValidator('query', shippingRatesQuerySchema, validationHook),
  async (c) => {
    const { state, subtotal } = c.req.valid('query')
    const data = await shippingService.calculateShippingRate(state, subtotal)
    return c.json({ status: 'success', data })
  }
)
