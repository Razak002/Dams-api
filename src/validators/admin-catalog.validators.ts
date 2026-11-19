import { z } from 'zod'
import { CATEGORIES, PRODUCT_STATUSES } from '../models/product.model.js'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const imageSchema = z.object({
  url: z.string().trim().min(1),
  alt: z.string().trim().min(1),
  angle: z.string().trim().optional(),
})

const colourwaySchema = z.object({
  name: z.string().trim().min(1),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex colour'),
})

const sizeEntrySchema = z.object({
  size: z.number().int().min(30).max(55),
  ukSize: z.number().min(1).max(20),
  footLengthCm: z.number().positive(),
  stock: z.number().int().min(0),
})

const materialsSchema = z.object({
  upper: z.string().trim().optional(),
  lining: z.string().trim().optional(),
  sole: z.string().trim().optional(),
  construction: z.string().trim().optional(),
})

export const adminListProductsQuerySchema = z.object({
  status: z.enum(PRODUCT_STATUSES).optional(),
  outOfStock: z.enum(['true', 'false']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminCreateProductSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRegex, 'Invalid slug format'),
  name: z.string().trim().min(1).max(150),
  subtitle: z.string().trim().max(250).default(''),
  description: z.string().trim().default(''),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  category: z.enum(CATEGORIES),
  collectionSlug: z.string().trim().toLowerCase().min(1),
  silhouette: z.string().trim().min(1).max(100),
  images: z.array(imageSchema).default([]),
  colourways: z.array(colourwaySchema).default([]),
  sizes: z.array(sizeEntrySchema).min(1, 'At least one size entry is required'),
  materials: materialsSchema.optional(),
  origin: z.string().trim().default('100% Locally Made in Abuja, Nigeria'),
  featured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  careInstructions: z.array(z.string().trim()).default([]),
})

export const adminUpdateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    subtitle: z.string().trim().max(250).optional(),
    description: z.string().trim().optional(),
    price: z.number().min(0).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    category: z.enum(CATEGORIES).optional(),
    collectionSlug: z.string().trim().toLowerCase().min(1).optional(),
    silhouette: z.string().trim().min(1).max(100).optional(),
    images: z.array(imageSchema).optional(),
    colourways: z.array(colourwaySchema).optional(),
    materials: materialsSchema.optional(),
    origin: z.string().trim().optional(),
    featured: z.boolean().optional(),
    isBestSeller: z.boolean().optional(),
    isNewArrival: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    careInstructions: z.array(z.string().trim()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const adminAdjustStockSchema = z.object({
  sizes: z
    .array(
      z.object({
        size: z.number().int().min(30).max(55),
        stock: z.number().int().min(0),
      })
    )
    .min(1, 'At least one size adjustment is required'),
  reason: z.string().trim().max(200).default('Manual stock adjustment'),
})

export const adminIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required').max(150),
})

export const adminDeleteQuerySchema = z.object({
  hard: z.enum(['true', 'false']).optional(),
})

export const adminCreateCollectionSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRegex, 'Invalid slug format'),
  title: z.string().trim().min(1).max(150),
  subtitle: z.string().trim().max(250).default(''),
  description: z.string().trim().default(''),
  coverImage: z.string().trim().default(''),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

export const adminUpdateCollectionSchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    subtitle: z.string().trim().max(250).optional(),
    description: z.string().trim().optional(),
    coverImage: z.string().trim().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export type AdminListProductsQuery = z.infer<typeof adminListProductsQuerySchema>
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>
export type AdminAdjustStockInput = z.infer<typeof adminAdjustStockSchema>
export type AdminCreateCollectionInput = z.infer<typeof adminCreateCollectionSchema>
export type AdminUpdateCollectionInput = z.infer<typeof adminUpdateCollectionSchema>
