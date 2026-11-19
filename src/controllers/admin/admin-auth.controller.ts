import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as adminService from '../../services/admin/admin.service.js'
import { adminListUsersQuerySchema, createStaffSchema } from '../../validators/admin.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const listUsers = factory.createHandlers(
  zValidator('query', adminListUsersQuerySchema, validationHook),
  async (c) => {
    const result = await adminService.listAllUsers(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const listStaff = factory.createHandlers(async (c) => {
  const data = await adminService.listStaff()
  return c.json({ status: 'success', data })
})

export const createStaff = factory.createHandlers(
  zValidator('json', createStaffSchema, validationHook),
  async (c) => {
    const result = await adminService.createStaff(c.req.valid('json'))
    if (result.conflict) {
      return c.json({ status: 'error', message: 'A user with this email already exists' }, 409)
    }

    return c.json({ status: 'success', data: result.data }, 201)
  }
)
