import { Schema, model, type InferSchemaType } from 'mongoose'

export const COMMISSION_STATUSES = [
  'NEW',
  'REVIEWING',
  'QUOTED',
  'IN_PRODUCTION',
  'READY_FOR_DISPATCH',
  'DELIVERED',
  'DECLINED',
] as const

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

const customOrderSchema = new Schema(
  {
    referenceId: { type: String, required: true, unique: true, immutable: true },
    commissionStatus: {
      type: String,
      enum: COMMISSION_STATUSES,
      default: 'NEW',
      index: true,
    },
    description: { type: String, required: true, trim: true },
    preferredMaterial: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 37, max: 46 },
    budgetNGN: { type: Number, required: true, min: 20000 },
    quotedPriceNGN: { type: Number, min: 0, default: null },
    workshopNotes: { type: String, default: '' },
    locationState: { type: String, required: true, trim: true },
    locationCity: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    sampleImageName: { type: String, default: null },
    sampleImageUrl: { type: String, default: null },
    depositAmountNGN: { type: Number, min: 0, default: null },
    depositReference: { type: String, unique: true, sparse: true },
    depositPaymentUrl: { type: String, default: null },
    depositPaid: { type: Boolean, default: false },
    depositPaidAt: { type: Date, default: null },
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

export type ICustomOrder = InferSchemaType<typeof customOrderSchema>
export const CustomOrder = model<ICustomOrder>('CustomOrder', customOrderSchema)
