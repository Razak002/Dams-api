import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { createFactory } from 'hono/factory'
import type { AuthContext } from '../../middleware/auth.middleware.js'
import * as adminCatalogService from '../../services/admin/admin-catalog.service.js'
import {
  InvalidMediaError,
  StorageNotConfiguredError,
  uploadToR2,
} from '../../utils/storage.js'
import {
  adminAdjustStockSchema,
  adminCreateCollectionSchema,
  adminCreateProductSchema,
  adminDeleteQuerySchema,
  adminIdParamSchema,
  adminListProductsQuerySchema,
  adminUpdateCollectionSchema,
  adminUpdateProductSchema,
} from '../../validators/admin-catalog.validators.js'
import { validationHook } from '../../validators/common.validators.js'

const factory = createFactory<{ Variables: { auth: AuthContext } }>()

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/webp',
  'image/png',
  'image/jpeg',
  'model/gltf-binary',
  'application/octet-stream',
])
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB

export const listAdminProducts = factory.createHandlers(
  zValidator('query', adminListProductsQuerySchema, validationHook),
  async (c) => {
    const result = await adminCatalogService.listAdminProducts(c.req.valid('query'))
    return c.json({ status: 'success', ...result })
  }
)

export const createAdminProduct = factory.createHandlers(
  zValidator('json', adminCreateProductSchema, validationHook),
  async (c) => {
    const result = await adminCatalogService.createAdminProduct(c.req.valid('json'))
    if (result.conflict) {
      return c.json({ status: 'error', message: 'A product with this slug already exists' }, 409)
    }

    return c.json({ status: 'success', data: result.data }, 201)
  }
)

export const getAdminProductById = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminCatalogService.getAdminProductById(id)
    if (!data) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const updateAdminProduct = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminUpdateProductSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminCatalogService.updateAdminProduct(id, c.req.valid('json'))
    if (!data) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const adjustProductStock = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminAdjustStockSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const { email } = c.get('auth')
    const result = await adminCatalogService.adjustProductStock(id, c.req.valid('json'), email)

    if (result.notFound) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }
    if (result.badSize !== null) {
      return c.json(
        { status: 'error', message: `Size EU ${result.badSize} does not exist on this product` },
        400
      )
    }

    return c.json({ status: 'success', data: result.data })
  }
)

export const deleteOrArchiveProduct = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('query', adminDeleteQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const { hard } = c.req.valid('query')
    const result = await adminCatalogService.deleteOrArchiveProduct(id, hard === 'true')

    if (!result) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }

    return c.json({ status: 'success', ...result })
  }
)

export const listAdminCollections = factory.createHandlers(async (c) => {
  const data = await adminCatalogService.listAdminCollections()
  return c.json({ status: 'success', data })
})

export const createAdminCollection = factory.createHandlers(
  zValidator('json', adminCreateCollectionSchema, validationHook),
  async (c) => {
    const result = await adminCatalogService.createAdminCollection(c.req.valid('json'))
    if (result.conflict) {
      return c.json({ status: 'error', message: 'A collection with this slug already exists' }, 409)
    }

    return c.json({ status: 'success', data: result.data }, 201)
  }
)

export const updateAdminCollection = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  zValidator('json', adminUpdateCollectionSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const data = await adminCatalogService.updateAdminCollection(id, c.req.valid('json'))
    if (!data) {
      return c.json({ status: 'error', message: 'Collection not found' }, 404)
    }

    return c.json({ status: 'success', data })
  }
)

export const deleteAdminCollection = factory.createHandlers(
  zValidator('param', adminIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid('param')
    const deleted = await adminCatalogService.deleteAdminCollection(id)
    if (!deleted) {
      return c.json({ status: 'error', message: 'Collection not found' }, 404)
    }

    return c.json({ status: 'success', message: 'Collection deleted' })
  }
)

export const uploadMedia = async (c: Context) => {
  const contentType = c.req.header('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ status: 'error', message: 'Content-Type must be multipart/form-data' }, 415)
  }

  const body = await c.req.parseBody()
  const file = body.file

  if (!(file instanceof File) || file.size === 0) {
    return c.json({ status: 'error', message: 'A non-empty file field is required' }, 400)
  }

  const isGlb = file.name.toLowerCase().endsWith('.glb')
  if (!ALLOWED_UPLOAD_TYPES.has(file.type) && !isGlb) {
    return c.json(
      { status: 'error', message: 'File must be WebP, PNG, JPG, or a .glb 3D model' },
      400
    )
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ status: 'error', message: 'File must be 15MB or smaller' }, 400)
  }

  try {
    const uploaded = await uploadToR2({ file, folder: 'products', allowGlb: true })
    return c.json(
      {
        status: 'success',
        data: {
          fileName: file.name,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          url: uploaded.url,
        },
      },
      201
    )
  } catch (err) {
    if (err instanceof InvalidMediaError) {
      return c.json({ status: 'error', message: err.message }, 400)
    }
    if (err instanceof StorageNotConfiguredError) {
      return c.json({ status: 'error', message: 'Media storage is not configured' }, 503)
    }
    console.error('[Uploads] R2 upload failed:', err)
    return c.json({ status: 'error', message: 'Failed to upload media' }, 502)
  }
}
