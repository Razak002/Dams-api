import { z } from 'zod'

export const cartItemInputSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  size: z.coerce.number().int().min(30).max(55),
  colour: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1).max(20),
})

export const validateCartSchema = z.object({
  items: z.array(cartItemInputSchema).min(1, 'At least one cart item is required').max(50),
})

export type CartItemInput = z.infer<typeof cartItemInputSchema>
export type ValidateCartInput = z.infer<typeof validateCartSchema>
