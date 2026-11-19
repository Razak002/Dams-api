import { Schema, model, type InferSchemaType } from 'mongoose'

const stateRateSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    fee: { type: Number, required: true, min: 0 },
    estimatedDelivery: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const shippingSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default', immutable: true },
    freeShippingThreshold: { type: Number, required: true, min: 0, default: 150000 },
    defaultNationwideFee: { type: Number, required: true, min: 0, default: 7500 },
    defaultNationwideEta: {
      type: String,
      required: true,
      default: '2–4 business days nationwide',
    },
    stateRates: {
      type: [stateRateSchema],
      default: [
        {
          state: 'Abuja (FCT)',
          fee: 4000,
          estimatedDelivery: '24 hours within Abuja (FCT)',
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.__v
        delete ret.key
        return ret
      },
    },
  }
)

export type IShippingSettings = InferSchemaType<typeof shippingSettingsSchema>
export const ShippingSettings = model<IShippingSettings>(
  'ShippingSettings',
  shippingSettingsSchema
)
