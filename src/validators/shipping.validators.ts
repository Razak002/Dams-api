import { z } from 'zod'

export const shippingRatesQuerySchema = z.object({
  state: z.string().trim().min(1, 'state is required').max(100),
  subtotal: z.coerce.number().min(0).default(0),
})

export type ShippingRatesQuery = z.infer<typeof shippingRatesQuerySchema>
