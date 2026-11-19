import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as checkoutService from '../../services/commerce/checkout.service.js'
import {
  initializeCheckoutSchema,
  verifyReferenceParamSchema,
} from '../../validators/checkout.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth?: AuthContext } }>()

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,100}$/

export const initializeCheckout = factory.createHandlers(
  zValidator('json', initializeCheckoutSchema, validationHook),
  async (c) => {
    const idempotencyKey = c.req.header('idempotency-key')?.trim() || undefined
    if (idempotencyKey && !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
      return c.json({ status: 'error', message: 'Invalid Idempotency-Key header' }, 400)
    }

    const result = await checkoutService.initializeCheckout(c.req.valid('json'), {
      userId: c.get('auth')?.userId,
      idempotencyKey,
    })
    if (!result.ok) {
      return c.json({ status: 'error', message: result.message }, result.status)
    }

    return c.json({ status: 'success', data: result.data }, 201)
  }
)

export const verifyOrder = factory.createHandlers(
  zValidator('param', verifyReferenceParamSchema, validationHook),
  async (c) => {
    const { reference } = c.req.valid('param')
    const result = await checkoutService.verifyOrderPayment(reference)

    switch (result.state) {
      case 'not_found':
        return c.json({ status: 'error', message: 'Order not found' }, 404)
      case 'unpaid':
        return c.json(
          { status: 'error', message: `Payment not completed (${result.paymentStatus})` },
          402
        )
      case 'amount_mismatch':
        return c.json(
          { status: 'error', message: 'Payment could not be confirmed. Our concierge will contact you.' },
          400
        )
      case 'gateway_error':
        return c.json(
          { status: 'error', message: 'Payment provider unavailable. Please retry shortly.' },
          502
        )
      case 'settled':
        return c.json({ status: 'success', data: result.data })
    }
  }
)
