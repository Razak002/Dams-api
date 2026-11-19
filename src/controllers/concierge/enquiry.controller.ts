import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import * as enquiryService from '../../services/concierge/enquiry.service.js'
import { validationHook } from '../../validators/common.validators.js'
import { createEnquirySchema } from '../../validators/enquiry.validators.js'

const factory = createFactory()

export const submitEnquiry = factory.createHandlers(
  zValidator('json', createEnquirySchema, validationHook),
  async (c) => {
    const { ticketId } = await enquiryService.createEnquiry(c.req.valid('json'))

    return c.json(
      {
        status: 'success',
        ticketId,
        message:
          'Thank you for reaching out to DÁMS. Our Abuja client concierge will respond within 4 business hours.',
      },
      201
    )
  }
)
