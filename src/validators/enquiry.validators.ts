import { z } from 'zod'
import { ENQUIRY_SUBJECTS } from '../models/enquiry.model.js'

export const createEnquirySchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.email('Valid email is required').trim().toLowerCase(),
  phone: z.string().trim().min(7, 'Valid phone number is required').max(30),
  subject: z.enum(ENQUIRY_SUBJECTS),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(3000),
})

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>
