import { z } from 'zod'
import { ENQUIRY_STATUSES, ENQUIRY_SUBJECTS } from '../models/enquiry.model.js'

export const adminListEnquiriesQuerySchema = z.object({
  subject: z.enum(ENQUIRY_SUBJECTS).optional(),
  status: z.enum(ENQUIRY_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminUpdateEnquirySchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    conciergeNotes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const adminListNewsletterQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  activeOnly: z.enum(['true', 'false']).default('true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const adminUpdateShippingSettingsSchema = z
  .object({
    freeShippingThreshold: z.number().min(0).optional(),
    defaultNationwideFee: z.number().min(0).optional(),
    defaultNationwideEta: z.string().trim().min(1).max(150).optional(),
    stateRates: z
      .array(
        z.object({
          state: z.string().trim().min(1).max(100),
          fee: z.number().min(0),
          estimatedDelivery: z.string().trim().min(1).max(150),
        })
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export type AdminListEnquiriesQuery = z.infer<typeof adminListEnquiriesQuerySchema>
export type AdminUpdateEnquiryInput = z.infer<typeof adminUpdateEnquirySchema>
export type AdminListNewsletterQuery = z.infer<typeof adminListNewsletterQuerySchema>
export type AdminUpdateShippingSettingsInput = z.infer<typeof adminUpdateShippingSettingsSchema>
