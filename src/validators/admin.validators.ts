import { z } from 'zod'
import { ADMIN_ROLES, USER_ROLES } from '../models/user.model.js'

export const adminListUsersQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const createStaffSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.email('Valid email is required').trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(ADMIN_ROLES),
})

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>
export type CreateStaffInput = z.infer<typeof createStaffSchema>
