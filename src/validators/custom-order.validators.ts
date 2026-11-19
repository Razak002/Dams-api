import { z } from 'zod'

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const createCustomOrderSchema = z.object({
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  preferredMaterial: z.string().trim().min(1, 'Preferred material is required').max(150),
  size: z.coerce.number().int().min(37, 'Size must be between EU 37 and 46').max(46),
  budgetNGN: z.coerce.number().min(20000, 'Minimum budget is ₦20,000'),
  locationState: z.string().trim().min(1, 'State is required').max(100),
  locationCity: z.string().trim().min(1, 'City is required').max(100),
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.email('Valid email is required').trim().toLowerCase(),
  phone: z.string().trim().min(7, 'Valid phone number is required').max(30),
  sampleImageName: z.string().trim().max(255).optional(),
  sampleImage: z
    .instanceof(File)
    .refine((file) => ALLOWED_IMAGE_TYPES.has(file.type), {
      message: 'sampleImage must be PNG, JPG, or WebP',
    })
    .refine((file) => file.size <= MAX_IMAGE_BYTES, {
      message: 'sampleImage must be 5MB or smaller',
    })
    .optional(),
})

export const trackCustomOrderParamSchema = z.object({
  referenceId: z.string().trim().min(1, 'referenceId is required').max(60),
})

export const trackCustomOrderQuerySchema = z.object({
  contact: z.string().trim().min(1, 'contact is required').max(120),
})

export type CreateCustomOrderInput = z.infer<typeof createCustomOrderSchema>
export type TrackCustomOrderQuery = z.infer<typeof trackCustomOrderQuerySchema>
