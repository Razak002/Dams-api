import { z } from 'zod'

export const addToWishlistSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
})

export const wishlistProductParamSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
})
