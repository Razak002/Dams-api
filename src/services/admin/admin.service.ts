import { randomBytes } from 'node:crypto'
import type { QueryFilter } from 'mongoose'
import { ADMIN_ROLES, ROLE_PERMISSIONS, User, type IUser } from '../../models/user.model.js'
import { hashPassword } from '../../utils/auth.js'
import { normalizePhone } from '../../utils/phone.js'
import type { AdminListUsersQuery, CreateStaffInput } from '../../validators/admin.validators.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const generateStaffId = () => `usr_${randomBytes(6).toString('hex')}`

export const listAllUsers = async (query: AdminListUsersQuery) => {
  const { role, isActive, search, page, limit } = query
  const filter: QueryFilter<IUser> = {}

  if (role) filter.role = role
  if (isActive) filter.isActive = isActive === 'true'
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }]
  }

  const [total, data] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const listStaff = async () => {
  return User.find({ role: { $in: [...ADMIN_ROLES] } }).sort({ createdAt: -1 })
}

export const createStaff = async (input: CreateStaffInput) => {
  const existing = await User.findOne({ email: input.email }).select('_id')
  if (existing) {
    return { conflict: true as const }
  }

  const publicId = generateStaffId()
  const passwordHash = await hashPassword(input.password)

  const staff = await User.create({
    publicId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ? normalizePhone(input.phone) : '',
    passwordHash,
    role: input.role,
    isActive: true,
  })

  return {
    conflict: false as const,
    data: {
      ...staff.toJSON(),
      permissions: ROLE_PERMISSIONS[staff.role],
    },
  }
}
