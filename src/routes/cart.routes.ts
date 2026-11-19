import { Hono } from 'hono'
import { validateCart } from '../controllers/commerce/cart.controller.js'

export const cartRouter = new Hono()

cartRouter.post('/validate', ...validateCart)
