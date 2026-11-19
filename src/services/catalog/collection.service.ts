import { Collection } from '../../models/collection.model.js'
import { CATEGORIES, Product } from '../../models/product.model.js'

const getProductCountsByCollection = async (): Promise<Map<string, number>> => {
  const rows = await Product.aggregate<{ _id: string; count: number }>([
    { $match: { isActive: true } },
    { $group: { _id: '$collectionSlug', count: { $sum: 1 } } },
  ])
  return new Map(rows.map((r) => [r._id, r.count]))
}

export const listCollections = async () => {
  const [collections, counts] = await Promise.all([
    Collection.find({ isActive: true }).sort({ sortOrder: 1 }),
    getProductCountsByCollection(),
  ])

  return collections.map((col) => ({
    ...col.toJSON(),
    productCount: counts.get(col.slug) ?? 0,
  }))
}

export const findCollectionBySlug = async (slug: string) => {
  const collection = await Collection.findOne({ slug, isActive: true })
  if (!collection) return null

  const productCount = await Product.countDocuments({ collectionSlug: slug, isActive: true })
  return { ...collection.toJSON(), productCount }
}

export const listCategoriesAndSilhouettes = async () => {
  const [rows, silhouettes] = await Promise.all([
    Product.aggregate<{ _id: string; count: number }>([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Product.distinct('silhouette', { isActive: true }),
  ])

  const counts = new Map(rows.map((r) => [r._id, r.count]))

  return {
    categories: CATEGORIES.map((value) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      count: counts.get(value) ?? 0,
    })),
    silhouettes: silhouettes.sort(),
  }
}
