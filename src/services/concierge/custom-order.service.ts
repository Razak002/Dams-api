import { randomBytes } from 'node:crypto'
import { CustomOrder } from '../../models/custom-order.model.js'
import { buildContactFilter, normalizePhone } from '../../utils/phone.js'
import { uploadToR2 } from '../../utils/storage.js'
import type { CreateCustomOrderInput } from '../../validators/custom-order.validators.js'

const generateReferenceId = () => `BESPOKE-${randomBytes(3).toString('hex').toUpperCase()}`

export const createCustomOrder = async (input: CreateCustomOrderInput) => {
  const referenceId = generateReferenceId()
  const sampleImageName = input.sampleImageName ?? input.sampleImage?.name ?? null
  let sampleImageUrl: string | null = null

  if (input.sampleImage) {
    const uploaded = await uploadToR2({
      file: input.sampleImage,
      folder: 'custom-orders',
      allowGlb: false,
    })
    sampleImageUrl = uploaded.url
  }

  const order = await CustomOrder.create({
    referenceId,
    commissionStatus: 'NEW',
    description: input.description,
    preferredMaterial: input.preferredMaterial,
    size: input.size,
    budgetNGN: input.budgetNGN,
    locationState: input.locationState,
    locationCity: input.locationCity,
    fullName: input.fullName,
    email: input.email,
    phone: normalizePhone(input.phone),
    sampleImageName,
    sampleImageUrl,
  })

  return {
    referenceId: order.referenceId,
  }
}

export const trackCustomOrder = async (referenceId: string, contact: string) => {
  const contactFilter = buildContactFilter(contact, { email: 'email', phone: 'phone' })
  if (!contactFilter) return null

  const normalizedRef = referenceId.trim().toUpperCase()
  const order = await CustomOrder.findOne({
    referenceId: normalizedRef,
    ...contactFilter,
  }).select(
    'referenceId commissionStatus description preferredMaterial size budgetNGN quotedPriceNGN workshopNotes sampleImageUrl depositAmountNGN depositPaymentUrl depositPaid createdAt updatedAt'
  )

  if (!order) return null

  return order.toJSON()
}
