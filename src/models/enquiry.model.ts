import { Schema, model, type InferSchemaType } from 'mongoose'

export const ENQUIRY_SUBJECTS = [
  'sizing',
  'bespoke',
  'order-status',
  'wholesale',
  'general',
] as const

export const ENQUIRY_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const

export type EnquirySubject = (typeof ENQUIRY_SUBJECTS)[number]
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

const enquirySchema = new Schema(
  {
    ticketId: { type: String, required: true, unique: true, immutable: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true },
    subject: { type: String, enum: ENQUIRY_SUBJECTS, required: true, index: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'OPEN', index: true },
    conciergeNotes: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
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

export type IEnquiry = InferSchemaType<typeof enquirySchema>
export const Enquiry = model<IEnquiry>('Enquiry', enquirySchema)
