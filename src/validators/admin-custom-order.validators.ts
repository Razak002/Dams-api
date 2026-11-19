import { z } from 'zod'
import { COMMISSION_STATUSES } from '../models/custom-order.model.js'

export const adminListCustomOrdersQuerySchema = z.object({
  status: z.enum(COMMISSION_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminUpdateCustomOrderSchema = z
  .object({
    commissionStatus: z.enum(COMMISSION_STATUSES).optional(),
    workshopNotes: z.string().trim().max(2000).optional(),
    quotedPriceNGN: z.number().min(0).nullable().optional(),
    depositAmountNGN: z.number().positive().optional(),
    generateDepositLink: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export type AdminListCustomOrdersQuery = z.infer<typeof adminListCustomOrdersQuerySchema>
export type AdminUpdateCustomOrderInput = z.infer<typeof adminUpdateCustomOrderSchema>
