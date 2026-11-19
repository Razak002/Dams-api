import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import * as newsletterService from '../../services/concierge/newsletter.service.js'
import { validationHook } from '../../validators/common.validators.js'
import { subscribeNewsletterSchema } from '../../validators/newsletter.validators.js'

const factory = createFactory()

export const subscribeNewsletter = factory.createHandlers(
  zValidator('json', subscribeNewsletterSchema, validationHook),
  async (c) => {
    const { created } = await newsletterService.subscribeToNewsletter(c.req.valid('json'))

    return c.json(
      {
        status: 'success',
        message:
          "Welcome to the DÁMS Abuja Ledger. You'll be the first to know about small-batch releases.",
      },
      created ? 201 : 200
    )
  }
)
