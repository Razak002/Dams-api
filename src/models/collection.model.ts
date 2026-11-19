import { Schema, model, type InferSchemaType } from 'mongoose'

const collectionSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
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
        delete ret.sortOrder
        delete ret.createdAt
        delete ret.updatedAt
        return ret
      },
    },
  }
)

export type ICollection = InferSchemaType<typeof collectionSchema>
export const Collection = model<ICollection>('Collection', collectionSchema)
