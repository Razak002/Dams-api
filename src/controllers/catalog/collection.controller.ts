import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { createFactory } from 'hono/factory'
import * as collectionService from '../../services/catalog/collection.service.js'
import { slugParamSchema, validationHook } from '../../validators/common.validators.js'

const factory = createFactory()

export const getCollections = async (c: Context) => {
  const data = await collectionService.listCollections()
  return c.json({ status: 'success', data })
}

export const getCollectionBySlug = factory.createHandlers(
  zValidator('param', slugParamSchema, validationHook),
  async (c) => {
    const { slug } = c.req.valid('param')
    const data = await collectionService.findCollectionBySlug(slug)
    if (!data) {
      return c.json({ status: 'error', message: 'Collection not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const getCategories = async (c: Context) => {
  const data = await collectionService.listCategoriesAndSilhouettes()
  return c.json({ status: 'success', data })
}
