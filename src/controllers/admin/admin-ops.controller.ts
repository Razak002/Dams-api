import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as adminOpsService from '../../services/admin/admin-ops.service.js'
import * as shippingService from '../../services/commerce/shipping.service.js'
import { adminIdParamSchema } from '../../validators/admin-catalog.validators.js'
import {
  adminListEnquiriesQuerySchema,
  adminListNewsletterQuerySchema,
  adminUpdateEnquirySchema,
  adminUpdateShippingSettingsSchema,
} from '../../validators/admin-ops.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const listAdminEnquiries = factory.createHandlers(
  zValidator('query', adminListEnquiriesQuerySchema, validationHook),
  async (c) => {
    const result = await adminOpsService.listAdminEnquiries(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const updateAdminEnquiry = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminUpdateEnquirySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminOpsService.updateAdminEnquiry(id, c.req.valid('json'))
    if (!data) {
      return c.json({ status: 'error', message: 'Enquiry not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const listNewsletterSubscribers = factory.createHandlers(
  zValidator('query', adminListNewsletterQuerySchema, validationHook),
  async (c) => {
    const result = await adminOpsService.listNewsletterSubscribers(c.req.valid('query'))

    if (result.format === 'csv') {
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', 'attachment; filename="dams-newsletter-subscribers.csv"')
      return c.body(result.csv)
    }

    return c.json({ status: 'success', meta: result.meta, data: result.data })
  }
)

export const getShippingSettings = factory.createHandlers(async (c) => {
  const data = await shippingService.getShippingSettings()
  return c.json({ status: 'success', data })
})

export const updateShippingSettings = factory.createHandlers(
  zValidator('json', adminUpdateShippingSettingsSchema, validationHook),
  async (c) => {
    const data = await shippingService.updateShippingSettings(c.req.valid('json'))
    return c.json({ status: 'success', data })
  }
)

export const getAnalyticsOverview = factory.createHandlers(async (c) => {
  const data = await adminOpsService.getAnalyticsOverview()
  return c.json({ status: 'success', data })
})
