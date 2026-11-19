import { z } from 'zod'

export const subscribeNewsletterSchema = z.object({
  email: z.email('Valid email is required').trim().toLowerCase(),
  source: z.string().trim().min(1).max(60).default('footer'),
})

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>
