import { z } from 'zod'

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.email('Valid email is required').trim().toLowerCase(),
  phone: z.string().trim().min(7, 'Valid phone number is required').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const loginSchema = z.object({
  email: z.email('Valid email is required').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    defaultAddress: z.string().trim().max(250).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    preferredEuSize: z.coerce.number().int().min(35).max(50).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const forgotPasswordSchema = z.object({
  email: z.email('Valid email is required').trim().toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const googleAuthSchema = z.object({
  idToken: z.string().trim().min(1, 'Google idToken is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
