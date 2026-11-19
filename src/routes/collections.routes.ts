import { Hono } from 'hono'
import { getCollectionBySlug, getCollections } from '../controllers/catalog/collection.controller.js'

export const collectionsRouter = new Hono()

collectionsRouter.get('/', getCollections)
collectionsRouter.get('/:slug', ...getCollectionBySlug)
