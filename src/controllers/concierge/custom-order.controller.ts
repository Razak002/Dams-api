import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { createFactory } from 'hono/factory'
import { z } from 'zod'
import * as customOrderService from '../../services/concierge/custom-order.service.js'
import { InvalidMediaError, StorageNotConfiguredError } from '../../utils/storage.js'
import { validationHook } from '../../validators/common.validators.js'
import {
  createCustomOrderSchema,
  trackCustomOrderParamSchema,
  trackCustomOrderQuerySchema,
} from '../../validators/custom-order.validators.js'

const factory = createFactory()

export const submitCustomOrder = async (c: Context) => {
  const contentType = c.req.header('content-type') || ''
  let rawBody: Record<string, unknown>

  if (contentType.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    rawBody = {
      ...body,
      sampleImage: body.sampleImage instanceof File && body.sampleImage.size > 0
        ? body.sampleImage
        : undefined,
    }
  } else if (contentType.includes('application/json')) {
    try {
      rawBody = await c.req.json()
    } catch {
      return c.json({ status: 'error', message: 'Invalid JSON body' }, 400)
    }
  } else {
    return c.json(
      { status: 'error', message: 'Content-Type must be multipart/form-data or application/json' },
      415
    )
  }

  const parsed = createCustomOrderSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json(
      {
        status: 'error',
        message: 'Validation failed',
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      400
    )
  }

  try {
    const { referenceId } = await customOrderService.createCustomOrder(parsed.data)

    return c.json(
      {
        status: 'success',
        referenceId,
        message:
          'Your custom shoe request has been logged with our Abuja workshop. Our master shoemakers will review your specifications and contact you via phone/email to discuss the finer details.',
      },
      201
    )
  } catch (err) {
    if (err instanceof InvalidMediaError) {
      return c.json({ status: 'error', message: err.message }, 400)
    }
    if (err instanceof StorageNotConfiguredError) {
      return c.json({ status: 'error', message: 'Image upload storage is not configured' }, 503)
    }
    console.error('[CustomOrder] Sample image upload failed:', err)
    return c.json({ status: 'error', message: 'Failed to upload sample image' }, 502)
  }
}

export const trackCustomOrder = factory.createHandlers(
  zValidator('param', trackCustomOrderParamSchema, validationHook),
  zValidator('query', trackCustomOrderQuerySchema, validationHook),
  async (c) => {
    const { referenceId } = c.req.valid('param')
    const { contact } = c.req.valid('query')

    const data = await customOrderService.trackCustomOrder(referenceId, contact)
    if (!data) {
      return c.json({ status: 'error', message: 'Custom order commission not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)
