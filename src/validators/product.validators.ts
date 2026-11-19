import { z } from 'zod'
import { CATEGORIES } from '../models/product.model.js'

export const SORT_OPTIONS = ['featured', 'newest', 'price-asc', 'price-desc'] as const

export const listProductsQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  collection: z.string().trim().min(1).max(100).optional(),
  silhouette: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(SORT_OPTIONS).default('featured'),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

export const limitQuerySchema = (fallback: number) =>
  z.object({ limit: z.coerce.number().int().min(1).max(50).default(fallback) })
