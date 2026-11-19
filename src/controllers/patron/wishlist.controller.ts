import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as wishlistService from '../../services/patron/wishlist.service.js'
import { validationHook } from '../../validators/common.validators.js'
import {
  addToWishlistSchema,
  wishlistProductParamSchema,
} from '../../validators/wishlist.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

export const getWishlist = factory.createHandlers(async (c) => {
  const { userId } = c.get('auth')
  const data = await wishlistService.getWishlist(userId)
  return c.json({ status: 'success', data })
})

export const addToWishlist = factory.createHandlers(
  zValidator('json', addToWishlistSchema, validationHook),
  async (c) => {
    const { userId } = c.get('auth')
    const { productId } = c.req.valid('json')

    const result = await wishlistService.addToWishlist(userId, productId)
    if (result.notFound) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }

    return c.json({ status: 'success', data: result.items }, 201)
  }
)

export const removeFromWishlist = factory.createHandlers(
  zValidator('param', wishlistProductParamSchema, validationHook),
  async (c) => {
    const { userId } = c.get('auth')
    const { productId } = c.req.valid('param')

    const data = await wishlistService.removeFromWishlist(userId, productId)
    return c.json({ status: 'success', data })
  }
)
