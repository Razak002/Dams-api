import type { QueryFilter } from 'mongoose'
import { Product, type IProduct } from '../../models/product.model.js'
import type { ListProductsQuery } from '../../validators/product.validators.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SORTS = {
  featured: { featured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
} as const

export const listProducts = async (query: ListProductsQuery) => {
  const { category, collection, silhouette, sort, search, page, limit } = query

  const filter: QueryFilter<IProduct> = { isActive: true }
  if (category) filter.category = category
  if (collection) filter.collectionSlug = collection
  if (silhouette) filter.silhouette = new RegExp(`^${escapeRegex(silhouette)}$`, 'i')
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ name: rx }, { subtitle: rx }, { description: rx }, { silhouette: rx }]
  }

  const [total, data] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const listFlaggedProducts = async (
  flag: 'isBestSeller' | 'isNewArrival',
  limit: number
) => {
  const filter = { isActive: true, [flag]: true }

  const [total, data] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort({ createdAt: -1 }).limit(limit),
  ])

  return {
    meta: { total, page: 1, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const findProductBySlug = async (slug: string) => {
  return Product.findOne({ slug, isActive: true })
}

export const findProductStockBySlug = async (slug: string) => {
  const product = await Product.findOne({ slug, isActive: true }).select('publicId slug sizes')
  if (!product) return null

  const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0)

  return {
    productId: product.publicId,
    slug: product.slug,
    inStock: totalStock > 0,
    totalStock,
    sizes: product.sizes,
  }
}
