import { Schema, model, type InferSchemaType } from 'mongoose'

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'IN_WORKSHOP',
  'DISPATCHED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_METHODS = ['paystack', 'whatsapp', 'walk-in'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAID_ORDER_STATUSES: readonly OrderStatus[] = [
  'PAID',
  'IN_WORKSHOP',
  'DISPATCHED',
  'DELIVERED',
]

export const FULFILMENT_ISSUES = [
  'STOCK_CONFLICT',
  'AMOUNT_MISMATCH',
  'PAID_AFTER_CANCEL',
  'REFUND_REQUIRED',
] as const

export const CANCEL_REASONS = ['EXPIRED', 'ADMIN'] as const

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    colour: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const timelineEntrySchema = new Schema(
  {
    stage: { type: String, enum: ORDER_STATUSES, required: true },
    label: { type: String, required: true },
    completedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
)

const paymentLogEntrySchema = new Schema(
  {
    event: { type: String, required: true },
    reference: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
)

const orderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, immutable: true },
    paymentReference: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, default: null, index: true },
    customerName: { type: String, trim: true, default: '' },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    customerPhone: { type: String, trim: true, default: '', index: true },
    shippingAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, required: true, trim: true },
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'paystack', index: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
    stockDeducted: { type: Boolean, default: false },
    fulfilmentIssue: { type: String, enum: FULFILMENT_ISSUES, default: null, index: true },
    cancelReason: { type: String, enum: CANCEL_REASONS, default: null },
    idempotencyKey: { type: String, unique: true, sparse: true },
    authorizationUrl: { type: String, default: null },
    timeline: { type: [timelineEntrySchema], default: [] },
    paymentLog: { type: [paymentLogEntrySchema], default: [] },
    dispatch: {
      riderName: { type: String, trim: true, default: '' },
      riderPhone: { type: String, trim: true, default: '' },
      waybillNumber: { type: String, trim: true, default: '' },
    },
    trackingNote: { type: String, default: '' },
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

export type IOrder = InferSchemaType<typeof orderSchema>
export const Order = model<IOrder>('Order', orderSchema)
