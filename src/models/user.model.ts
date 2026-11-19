import { Schema, model, type InferSchemaType } from 'mongoose'

export const ADMIN_ROLES = ['SUPER_ADMIN', 'WORKSHOP_MANAGER', 'CONCIERGE'] as const
export const USER_ROLES = ['CUSTOMER', ...ADMIN_ROLES] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]
export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  CUSTOMER: [],
  SUPER_ADMIN: [
    'staff:read',
    'staff:write',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'custom-orders:read',
    'custom-orders:write',
    'enquiries:read',
    'enquiries:write',
    'newsletter:read',
    'analytics:read',
  ],
  WORKSHOP_MANAGER: [
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'custom-orders:read',
    'custom-orders:write',
  ],
  CONCIERGE: [
    'orders:read',
    'custom-orders:read',
    'custom-orders:write',
    'enquiries:read',
    'enquiries:write',
  ],
}

const userSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: USER_ROLES, default: 'CUSTOMER', index: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    preferredEuSize: { type: Number, min: 35, max: 50, default: null },
    defaultAddress: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    wishlistProductIds: { type: [String], default: [] },
    tokenVersion: { type: Number, default: 0 },
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpiresAt: { type: Date, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret.publicId
        delete ret._id
        delete ret.__v
        delete ret.publicId
        delete ret.passwordHash
        delete ret.tokenVersion
        delete ret.wishlistProductIds
        delete ret.resetPasswordTokenHash
        delete ret.resetPasswordExpiresAt
        delete ret.createdAt
        delete ret.updatedAt
        return ret
      },
    },
  }
)

export type IUser = InferSchemaType<typeof userSchema>
export const User = model<IUser>('User', userSchema)
