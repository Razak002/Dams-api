import { z } from 'zod'
import { cartItemInputSchema } from './cart.validators.js'

export const initializeCheckoutSchema = z.object({
  customerName: z.string().trim().min(1).max(120).optional(),
  customerEmail: z.email('Valid customerEmail is required').trim().toLowerCase(),
  customerPhone: z.string().trim().min(7).max(30).optional(),
  shippingAddress: z.object({
    street: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().min(1, 'shippingAddress.state is required').max(100),
  }),
  items: z.array(cartItemInputSchema).min(1, 'At least one item is required').max(50),
})

export const verifyReferenceParamSchema = z.object({
  reference: z.string().trim().min(1, 'reference is required').max(120),
})

export type InitializeCheckoutInput = z.infer<typeof initializeCheckoutSchema>
