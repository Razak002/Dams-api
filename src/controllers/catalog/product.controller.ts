import { zValidator } from '@hono/zod-validator'
import { createFactory } from 'hono/factory'
import * as productService from '../../services/catalog/product.service.js'
import { slugParamSchema, validationHook } from '../../validators/common.validators.js'
import { limitQuerySchema, listProductsQuerySchema } from '../../validators/product.validators.js'

const factory = createFactory()

const productNotFound = { status: 'error', message: 'Product not found' } as const

export const getProducts = factory.createHandlers(
  zValidator('query', listProductsQuerySchema, validationHook),
  async (c) => {
    const result = await productService.listProducts(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

const flagged = (flag: 'isBestSeller' | 'isNewArrival', fallback: number) =>
  factory.createHandlers(
    zValidator('query', limitQuerySchema(fallback), validationHook),
    async (c) => {
      const { limit } = c.req.valid('query')
      const result = await productService.listFlaggedProducts(flag, limit)
      return c.json({ status: 'success', ...result })
    }
  )

export const getBestSellers = flagged('isBestSeller', 5)
export const getNewArrivals = flagged('isNewArrival', 8)

export const getProductBySlug = factory.createHandlers(
  zValidator('param', slugParamSchema, validationHook),
  async (c) => {
    const { slug } = c.req.valid('param')
    const product = await productService.findProductBySlug(slug)
    if (!product) return c.json(productNotFound, 404)

    return c.json({ status: 'success', data: product })
  }
)

export const getProductStock = factory.createHandlers(
  zValidator('param', slugParamSchema, validationHook),
  async (c) => {
    const { slug } = c.req.valid('param')
    const stock = await productService.findProductStockBySlug(slug)
    if (!stock) return c.json(productNotFound, 404)

    // Stock is live data: never cache it.
    c.header('Cache-Control', 'no-store')
    return c.json({ status: 'success', data: stock })
  }
)
