import { Schema, model, type InferSchemaType } from 'mongoose'

export const CATEGORIES = ['men', 'women', 'unisex'] as const
export type Category = (typeof CATEGORIES)[number]

export const PRODUCT_STATUSES = ['published', 'draft', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

const stockHistorySchema = new Schema(
  {
    size: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    changedBy: { type: String, required: true },
    reason: { type: String, default: 'Manual adjustment' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, required: true },
    angle: { type: String },
  },
  { _id: false }
)

const colourwaySchema = new Schema(
  {
    name: { type: String, required: true },
    hex: { type: String, required: true, match: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/ },
  },
  { _id: false }
)

const sizeSchema = new Schema(
  {
    size: { type: Number, required: true },
    ukSize: { type: Number, required: true },
    footLengthCm: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
)

const productSchema = new Schema(
  {
    // Stable public identifier exposed as `id` (e.g. "prod_dams_cork_slide_00")
    publicId: { type: String, required: true, unique: true, immutable: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    collectionSlug: { type: String, required: true, index: true },
    silhouette: { type: String, required: true, index: true },
    images: { type: [imageSchema], default: [] },
    colourways: { type: [colourwaySchema], default: [] },
    sizes: { type: [sizeSchema], default: [] },
    materials: {
      upper: String,
      lining: String,
      sole: String,
      construction: String,
    },
    origin: { type: String, default: '' },
    featured: { type: Boolean, default: false, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    careInstructions: { type: [String], default: [] },
    status: { type: String, enum: PRODUCT_STATUSES, default: 'published', index: true },
    stockHistory: { type: [stockHistorySchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret.publicId
        delete ret._id
        delete ret.__v
        delete ret.publicId
        delete ret.isActive
        delete ret.status
        delete ret.stockHistory
        delete ret.updatedAt
        return ret
      },
    },
  }
)

productSchema.index({ name: 'text', subtitle: 'text', description: 'text' })

export type IProduct = InferSchemaType<typeof productSchema>
export const Product = model<IProduct>('Product', productSchema)
