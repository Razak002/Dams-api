import { Hono } from 'hono'
import { getCategories } from '../controllers/catalog/collection.controller.js'

export const categoriesRouter = new Hono()

categoriesRouter.get('/', getCategories)
