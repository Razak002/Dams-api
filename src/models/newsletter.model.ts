import { Schema, model, type InferSchemaType } from 'mongoose'

const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    source: { type: String, trim: true, default: 'footer' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export type INewsletterSubscriber = InferSchemaType<typeof newsletterSubscriberSchema>
export const NewsletterSubscriber = model<INewsletterSubscriber>(
  'NewsletterSubscriber',
  newsletterSubscriberSchema
)
