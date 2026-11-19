import { Hono } from 'hono'
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from '../controllers/patron/wishlist.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

export const wishlistRouter = new Hono()

wishlistRouter.use('*', requireAuth)

wishlistRouter.get('/', ...getWishlist)
wishlistRouter.post('/', ...addToWishlist)
wishlistRouter.delete('/:productId', ...removeFromWishlist)
