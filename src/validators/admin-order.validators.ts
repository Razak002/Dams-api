import { z } from 'zod'
import { FULFILMENT_ISSUES, ORDER_STATUSES, PAYMENT_METHODS } from '../models/order.model.js'
import { cartItemInputSchema } from './cart.validators.js'

export const adminListOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  fulfilmentIssue: z.enum(FULFILMENT_ISSUES).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminUpdateOrderStatusSchema = z.object({
  status: z.enum(['IN_WORKSHOP', 'DISPATCHED', 'DELIVERED', 'CANCELLED']),
  trackingNote: z.string().trim().max(300).optional(),
  riderName: z.string().trim().max(120).optional(),
  riderPhone: z.string().trim().max(30).optional(),
  waybillNumber: z.string().trim().max(100).optional(),
})

export const adminCreateManualOrderSchema = z.object({
  customerName: z.string().trim().min(1).max(120).optional(),
  customerEmail: z.email('Valid customerEmail is required').trim().toLowerCase(),
  customerPhone: z.string().trim().min(7).max(30).optional(),
  paymentMethod: z.enum(['whatsapp', 'walk-in']).default('whatsapp'),
  shippingAddress: z.object({
    street: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().min(1).max(100).default('Abuja (FCT)'),
  }),
  items: z.array(cartItemInputSchema).min(1, 'At least one item is required').max(50),
  status: z.enum(['PAID', 'IN_WORKSHOP', 'DELIVERED']).default('PAID'),
  trackingNote: z.string().trim().max(300).optional(),
})

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>
export type AdminUpdateOrderStatusInput = z.infer<typeof adminUpdateOrderStatusSchema>
export type AdminCreateManualOrderInput = z.infer<typeof adminCreateManualOrderSchema>
