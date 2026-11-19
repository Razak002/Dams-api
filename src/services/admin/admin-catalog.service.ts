import { randomBytes } from 'node:crypto'
import type { QueryFilter } from 'mongoose'
import { Collection } from '../../models/collection.model.js'
import { Order } from '../../models/order.model.js'
import { Product, type IProduct } from '../../models/product.model.js'
import type {
  AdminAdjustStockInput,
  AdminCreateCollectionInput,
  AdminCreateProductInput,
  AdminListProductsQuery,
  AdminUpdateCollectionInput,
  AdminUpdateProductInput,
} from '../../validators/admin-catalog.validators.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const serializeAdminProduct = (doc: IProduct & { createdAt?: Date; updatedAt?: Date }) => {
  const totalStock = doc.sizes.reduce((sum, s) => sum + s.stock, 0)
  return {
    id: doc.publicId,
    slug: doc.slug,
    name: doc.name,
    subtitle: doc.subtitle,
    description: doc.description,
    price: doc.price,
    compareAtPrice: doc.compareAtPrice,
    category: doc.category,
    collectionSlug: doc.collectionSlug,
    silhouette: doc.silhouette,
    images: doc.images,
    colourways: doc.colourways,
    sizes: doc.sizes,
    totalStock,
    materials: doc.materials,
    origin: doc.origin,
    featured: doc.featured,
    isBestSeller: doc.isBestSeller,
    isNewArrival: doc.isNewArrival,
    isPublished: doc.isActive && doc.status === 'published',
    status: doc.status,
    careInstructions: doc.careInstructions,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export const listAdminProducts = async (query: AdminListProductsQuery) => {
  const { status, outOfStock, search, page, limit } = query
  const filter: QueryFilter<IProduct> = {}

  if (status) filter.status = status
  if (outOfStock === 'true') {
    filter.sizes = { $not: { $elemMatch: { stock: { $gt: 0 } } } }
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ name: rx }, { slug: rx }, { silhouette: rx }]
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data: products.map((p) => serializeAdminProduct(p)),
  }
}

export const createAdminProduct = async (input: AdminCreateProductInput) => {
  const existing = await Product.findOne({ slug: input.slug }).select('_id')
  if (existing) return { conflict: true as const }

  const publicId = `prod_${randomBytes(6).toString('hex')}`
  const { isPublished, ...rest } = input

  const product = await Product.create({
    ...rest,
    publicId,
    status: isPublished ? 'published' : 'draft',
    isActive: isPublished,
  })

  return { conflict: false as const, data: serializeAdminProduct(product) }
}

export const getAdminProductById = async (id: string) => {
  const product = await Product.findOne({ $or: [{ publicId: id }, { slug: id.toLowerCase() }] })
  if (!product) return null

  const salesRows = await Order.aggregate<{ totalSold: number }>([
    {
      $match: {
        status: { $in: ['PAID', 'IN_WORKSHOP', 'DISPATCHED', 'DELIVERED'] },
        'items.productId': product.publicId,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.productId': product.publicId } },
    { $group: { _id: null, totalSold: { $sum: '$items.quantity' } } },
  ])

  return {
    ...serializeAdminProduct(product),
    salesCount: salesRows[0]?.totalSold ?? 0,
    stockHistory: product.stockHistory,
  }
}

export const updateAdminProduct = async (id: string, input: AdminUpdateProductInput) => {
  const product = await Product.findOne({ $or: [{ publicId: id }, { slug: id.toLowerCase() }] })
  if (!product) return null

  const { isPublished, ...rest } = input
  Object.assign(product, rest)

  if (typeof isPublished === 'boolean') {
    product.isActive = isPublished
    product.status = isPublished ? 'published' : 'draft'
  }

  await product.save()
  return serializeAdminProduct(product)
}

export const adjustProductStock = async (
  id: string,
  input: AdminAdjustStockInput,
  changedBy: string
) => {
  const filter = { $or: [{ publicId: id }, { slug: id.toLowerCase() }] }
  const current = await Product.findOne(filter).select('sizes')
  if (!current) return { notFound: true as const }

  const sizeMap = new Map(current.sizes.map((s) => [s.size, s.stock]))
  for (const adj of input.sizes) {
    if (!sizeMap.has(adj.size)) {
      return { notFound: false as const, badSize: adj.size }
    }
  }

  let updatedProduct = current
  for (const adj of input.sizes) {
    const previousStock = sizeMap.get(adj.size) ?? 0
    const updated = await Product.findOneAndUpdate(
      { ...filter, 'sizes.size': adj.size },
      {
        $set: { 'sizes.$.stock': adj.stock },
        $push: {
          stockHistory: {
            size: adj.size,
            previousStock,
            newStock: adj.stock,
            changedBy,
            reason: input.reason,
            changedAt: new Date(),
          },
        },
      },
      { new: true }
    )
    if (updated) updatedProduct = updated
  }

  return {
    notFound: false as const,
    badSize: null,
    data: serializeAdminProduct(updatedProduct),
  }
}

export const deleteOrArchiveProduct = async (id: string, hardDelete: boolean) => {
  const filter = { $or: [{ publicId: id }, { slug: id.toLowerCase() }] }

  if (hardDelete) {
    const deleted = await Product.findOneAndDelete(filter)
    return deleted ? { action: 'deleted' as const } : null
  }

  const archived = await Product.findOneAndUpdate(
    filter,
    { $set: { status: 'archived', isActive: false } },
    { new: true }
  )
  return archived ? { action: 'archived' as const, data: serializeAdminProduct(archived) } : null
}

export const listAdminCollections = async () => {
  const [collections, counts] = await Promise.all([
    Collection.find().sort({ sortOrder: 1 }),
    Product.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$collectionSlug', count: { $sum: 1 } } },
    ]),
  ])

  const countMap = new Map(counts.map((c) => [c._id, c.count]))

  return collections.map((col) => ({
    id: col.publicId,
    slug: col.slug,
    title: col.title,
    subtitle: col.subtitle,
    description: col.description,
    coverImage: col.coverImage,
    sortOrder: col.sortOrder,
    isActive: col.isActive,
    productCount: countMap.get(col.slug) ?? 0,
  }))
}

export const createAdminCollection = async (input: AdminCreateCollectionInput) => {
  const existing = await Collection.findOne({ slug: input.slug }).select('_id')
  if (existing) return { conflict: true as const }

  const publicId = `col_${randomBytes(6).toString('hex')}`
  const collection = await Collection.create({ ...input, publicId })

  return {
    conflict: false as const,
    data: { ...collection.toJSON(), sortOrder: collection.sortOrder, isActive: collection.isActive, productCount: 0 },
  }
}

export const updateAdminCollection = async (id: string, input: AdminUpdateCollectionInput) => {
  const collection = await Collection.findOneAndUpdate(
    { $or: [{ publicId: id }, { slug: id.toLowerCase() }] },
    { $set: input },
    { new: true, runValidators: true }
  )
  if (!collection) return null

  const productCount = await Product.countDocuments({ collectionSlug: collection.slug })
  return {
    ...collection.toJSON(),
    sortOrder: collection.sortOrder,
    isActive: collection.isActive,
    productCount,
  }
}

export const deleteAdminCollection = async (id: string) => {
  const deleted = await Collection.findOneAndDelete({
    $or: [{ publicId: id }, { slug: id.toLowerCase() }],
  })
  return Boolean(deleted)
}
