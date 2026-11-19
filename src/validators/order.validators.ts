import { z } from 'zod'

export const trackOrderQuerySchema = z.object({
  reference: z.string().trim().min(1, 'reference is required').max(100),
  contact: z.string().trim().min(1, 'contact is required').max(120),
})

export const listPatronOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type TrackOrderQuery = z.infer<typeof trackOrderQuerySchema>
export type ListPatronOrdersQuery = z.infer<typeof listPatronOrdersQuerySchema>
