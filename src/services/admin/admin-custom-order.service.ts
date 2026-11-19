import { randomBytes } from 'node:crypto'
import type { QueryFilter } from 'mongoose'
import { CustomOrder, type ICustomOrder } from '../../models/custom-order.model.js'
import { initializePaystackTransaction, verifyPaystackTransaction } from '../../utils/paystack.js'
import type {
  AdminListCustomOrdersQuery,
  AdminUpdateCustomOrderInput,
} from '../../validators/admin-custom-order.validators.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const listAdminCustomOrders = async (query: AdminListCustomOrdersQuery) => {
  const { status, search, page, limit } = query
  const filter: QueryFilter<ICustomOrder> = {}

  if (status) filter.commissionStatus = status
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { referenceId: rx },
      { fullName: rx },
      { email: rx },
      { phone: rx },
      { description: rx },
    ]
  }

  const [total, data] = await Promise.all([
    CustomOrder.countDocuments(filter),
    CustomOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const getAdminCustomOrderById = async (id: string) => {
  return CustomOrder.findOne({ referenceId: id.trim().toUpperCase() })
}

export const updateAdminCustomOrder = async (
  id: string,
  input: AdminUpdateCustomOrderInput
) => {
  const order = await CustomOrder.findOne({ referenceId: id.trim().toUpperCase() })
  if (!order) return { state: 'not_found' as const }

  if (input.commissionStatus !== undefined) order.commissionStatus = input.commissionStatus
  if (input.workshopNotes !== undefined) order.workshopNotes = input.workshopNotes
  if (input.quotedPriceNGN !== undefined) order.quotedPriceNGN = input.quotedPriceNGN

  if (input.generateDepositLink) {
    if (!order.quotedPriceNGN || order.quotedPriceNGN <= 0) {
      return {
        state: 'bad_request' as const,
        status: 400 as const,
        message: 'quotedPriceNGN must be set before generating a deposit link',
      }
    }
    if (order.depositPaid) {
      return {
        state: 'bad_request' as const,
        status: 409 as const,
        message: 'Deposit has already been paid for this commission',
      }
    }

    const depositAmountNGN =
      input.depositAmountNGN ?? Math.round(order.quotedPriceNGN * 0.5)
    if (depositAmountNGN > order.quotedPriceNGN) {
      return {
        state: 'bad_request' as const,
        status: 400 as const,
        message: 'depositAmountNGN cannot exceed quotedPriceNGN',
      }
    }

    const shortId = order.referenceId.replace('BESPOKE-', '')
    const depositReference = `BESPOKE-DEP-${shortId}-${randomBytes(3).toString('hex').toUpperCase()}`

    try {
      const paystack = await initializePaystackTransaction({
        email: order.email,
        amountKobo: Math.round(depositAmountNGN * 100),
        reference: depositReference,
        metadata: { type: 'bespoke_deposit', referenceId: order.referenceId },
      })

      order.depositAmountNGN = depositAmountNGN
      order.depositReference = depositReference
      order.depositPaymentUrl = paystack.authorization_url
      order.depositPaid = false
    } catch (err) {
      console.error(`[Bespoke] Paystack deposit init failed for ${order.referenceId}:`, err)
      return {
        state: 'bad_request' as const,
        status: 502 as const,
        message: 'Unable to initialize Paystack deposit link',
      }
    }
  }

  await order.save()
  return { state: 'updated' as const, data: order }
}

export const settleBespokeDeposit = async (params: {
  reference: string
  amountKobo: number
  currency: string
}) => {
  const order = await CustomOrder.findOne({ depositReference: params.reference })
  if (!order || order.depositAmountNGN == null) return { state: 'not_found' as const }

  if (
    params.currency !== 'NGN' ||
    params.amountKobo !== Math.round(order.depositAmountNGN * 100)
  ) {
    console.error(`[Bespoke] Deposit amount/currency mismatch on ${order.referenceId}`)
    return { state: 'amount_mismatch' as const }
  }

  const updated = await CustomOrder.findOneAndUpdate(
    { _id: order._id, depositPaid: false },
    {
      $set: {
        depositPaid: true,
        depositPaidAt: new Date(),
        ...(order.commissionStatus === 'QUOTED' ? { commissionStatus: 'IN_PRODUCTION' } : {}),
      },
    },
    { new: true }
  )

  return { state: 'settled' as const, order: updated ?? order }
}

export const verifyBespokeDeposit = async (reference: string) => {
  const existing = await CustomOrder.findOne({ depositReference: reference })
  if (!existing || existing.depositAmountNGN == null) return { state: 'not_found' as const }

  const toReceipt = (order: typeof existing) => ({
    orderId: order.referenceId,
    reference,
    type: 'bespoke_deposit' as const,
    status: 'PAID' as const,
    commissionStatus: order.commissionStatus,
    fulfilmentIssue: null,
    items: [
      {
        productId: order.referenceId,
        slug: '',
        name: `Bespoke Commission Deposit (${order.preferredMaterial})`,
        size: order.size,
        colour: order.preferredMaterial,
        quantity: 1,
        priceAtPurchase: order.depositAmountNGN ?? 0,
      },
    ],
    subtotal: order.depositAmountNGN ?? 0,
    shippingFee: 0,
    totalAmount: order.depositAmountNGN ?? 0,
    timeline: [
      {
        stage: 'PAID',
        label: 'Bespoke Deposit Confirmed',
        completedAt: order.depositPaidAt ?? new Date(),
      },
    ],
  })

  if (existing.depositPaid) {
    return { state: 'settled' as const, data: toReceipt(existing) }
  }

  let tx: Awaited<ReturnType<typeof verifyPaystackTransaction>>
  try {
    tx = await verifyPaystackTransaction(reference)
  } catch (err) {
    console.error(`[Bespoke] Paystack verify failed for ${existing.referenceId}:`, err)
    return { state: 'gateway_error' as const }
  }

  if (tx.status !== 'success') return { state: 'unpaid' as const, paymentStatus: tx.status }

  const settled = await settleBespokeDeposit({
    reference,
    amountKobo: tx.amount,
    currency: tx.currency,
  })
  if (settled.state !== 'settled') return settled

  return { state: 'settled' as const, data: toReceipt(settled.order) }
}
