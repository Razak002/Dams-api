import { Hono } from 'hono'
import {
  getBestSellers,
  getNewArrivals,
  getProductBySlug,
  getProductStock,
  getProducts,
} from '../controllers/catalog/product.controller.js'

export const productsRouter = new Hono()

// Static segments must be registered before the `/:slug` param route.
productsRouter.get('/', ...getProducts)
productsRouter.get('/best-sellers', ...getBestSellers)
productsRouter.get('/new-arrivals', ...getNewArrivals)
productsRouter.get('/:slug/stock', ...getProductStock)
productsRouter.get('/:slug', ...getProductBySlug)
