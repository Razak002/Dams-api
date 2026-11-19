import { randomBytes } from 'node:crypto'
import { ROLE_PERMISSIONS, User } from '../../models/user.model.js'
import {
  hashPassword,
  hashResetToken,
  signAuthToken,
  verifyPassword,
} from '../../utils/auth.js'
import { verifyGoogleIdToken } from '../../utils/google-auth.js'
import { normalizePhone } from '../../utils/phone.js'
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../../validators/auth.validators.js'

const generateUserId = () => `usr_${randomBytes(6).toString('hex')}`
const RESET_TTL_MS = 15 * 60 * 1000

const serializeUser = (user: InstanceType<typeof User>) => ({
  ...user.toJSON(),
  permissions: ROLE_PERMISSIONS[user.role],
})

export const registerPatron = async (input: RegisterInput) => {
  const existing = await User.findOne({ email: input.email }).select('_id')
  if (existing) {
    return { conflict: true as const }
  }

  const publicId = generateUserId()
  const passwordHash = await hashPassword(input.password)

  const user = await User.create({
    publicId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: normalizePhone(input.phone),
    passwordHash,
    role: 'CUSTOMER',
  })

  const token = await signAuthToken(user.publicId, user.email, user.role, user.tokenVersion)
  return { conflict: false as const, token, user: serializeUser(user) }
}

export const loginPatron = async (input: LoginInput) => {
  const user = await User.findOne({ email: input.email, isActive: true }).select('+passwordHash')
  if (!user || !user.passwordHash) return null

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) return null

  user.lastLoginAt = new Date()
  await user.save()

  const token = await signAuthToken(user.publicId, user.email, user.role, user.tokenVersion)
  return { token, user: serializeUser(user) }
}

export const loginWithGoogle = async (idToken: string) => {
  const claims = await verifyGoogleIdToken(idToken)

  let user = await User.findOne({
    $or: [{ googleId: claims.sub }, { email: claims.email }],
  })

  if (user) {
    if (!user.isActive) return { inactive: true as const }
    if (!user.googleId) user.googleId = claims.sub
    user.lastLoginAt = new Date()
    await user.save()
  } else {
    user = await User.create({
      publicId: generateUserId(),
      firstName: claims.givenName,
      lastName: claims.familyName,
      email: claims.email,
      phone: '',
      role: 'CUSTOMER',
      authProvider: 'google',
      googleId: claims.sub,
      isActive: true,
      lastLoginAt: new Date(),
    })
  }

  const token = await signAuthToken(user.publicId, user.email, user.role, user.tokenVersion)
  return { inactive: false as const, token, user: serializeUser(user) }
}

export const revokePatronSessions = async (userId: string) => {
  await User.updateOne({ publicId: userId }, { $inc: { tokenVersion: 1 } })
}

export const getPatronById = async (userId: string) => {
  const user = await User.findOne({ publicId: userId, isActive: true })
  return user ? serializeUser(user) : null
}

export const updatePatronProfile = async (userId: string, input: UpdateProfileInput) => {
  const payload = input.phone ? { ...input, phone: normalizePhone(input.phone) } : input
  const user = await User.findOneAndUpdate(
    { publicId: userId, isActive: true },
    { $set: payload },
    { new: true, runValidators: true }
  )
  return user ? serializeUser(user) : null
}

export const requestPasswordReset = async (email: string) => {
  const user = await User.findOne({ email, isActive: true })
  if (!user) return

  const rawToken = randomBytes(32).toString('hex')
  user.resetPasswordTokenHash = hashResetToken(rawToken)
  user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TTL_MS)
  await user.save()

  // TODO: Send password reset link/OTP containing rawToken to user.email via email provider.
}

export const resetPassword = async ({ token, newPassword }: ResetPasswordInput) => {
  const tokenHash = hashResetToken(token)
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
    isActive: true,
  }).select('+passwordHash +resetPasswordTokenHash +resetPasswordExpiresAt')

  if (!user) return false

  user.passwordHash = await hashPassword(newPassword)
  user.tokenVersion += 1
  user.resetPasswordTokenHash = null
  user.resetPasswordExpiresAt = null
  await user.save()

  return true
}
