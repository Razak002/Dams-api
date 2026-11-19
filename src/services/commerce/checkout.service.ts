import mongoose from 'mongoose'
import { Order, PAID_ORDER_STATUSES } from '../../models/order.model.js'
import { generateOrderId, generatePaymentReference, isDuplicateKeyError } from '../../utils/ids.js'
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from '../../utils/paystack.js'
import { normalizePhone } from '../../utils/phone.js'
import type { InitializeCheckoutInput } from '../../validators/checkout.validators.js'
import { verifyBespokeDeposit } from '../admin/admin-custom-order.service.js'
import { notifyOrderPaid } from '../notification.service.js'
import { buildOrderLines } from './order-lines.service.js'
import { calculateShippingRate } from './shipping.service.js'
import { deductStock, StockConflictError } from './stock.service.js'

const PENDING_ORDER_TTL_MS = 2 * 60 * 60 * 1000
const toKobo = (naira: number) => Math.round(naira * 100)

type OrderDoc = NonNullable<Awaited<ReturnType<typeof Order.findOne>>>

const toReceipt = (order: OrderDoc) => ({
  orderId: order.orderId,
  reference: order.paymentReference,
  status: order.status,
  fulfilmentIssue: order.fulfilmentIssue ?? null,
  items: order.items,
  subtotal: order.subtotal,
  shippingFee: order.shippingFee,
  totalAmount: order.totalAmount,
  timeline: order.timeline,
})

const toCheckoutSummary = (order: OrderDoc) => ({
  orderId: order.orderId,
  reference: order.paymentReference,
  authorizationUrl: order.status === 'PENDING' ? order.authorizationUrl : null,
  subtotal: order.subtotal,
  shippingFee: order.shippingFee,
  totalAmount: order.totalAmount,
  status: order.status,
})

const isClaimable = (order: OrderDoc) =>
  order.status === 'PENDING' || (order.status === 'CANCELLED' && order.cancelReason === 'EXPIRED')

export const initializeCheckout = async (
  input: InitializeCheckoutInput,
  { userId, idempotencyKey }: { userId?: string; idempotencyKey?: string }
) => {
  const findReplay = () =>
    idempotencyKey ? Order.findOne({ idempotencyKey, customerEmail: input.customerEmail }) : null

  const replay = await findReplay()
  if (replay) return { ok: true as const, data: toCheckoutSummary(replay) }

  const built = await buildOrderLines(input.items, { activeOnly: true })
  if (!built.ok) return built

  const shipping = await calculateShippingRate(input.shippingAddress.state, built.subtotal)

  let order: OrderDoc
  try {
    order = await Order.create({
      orderId: generateOrderId(),
      paymentReference: generatePaymentReference('DAMS'),
      userId: userId ?? null,
      idempotencyKey,
      customerName: input.customerName ?? '',
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ? normalizePhone(input.customerPhone) : '',
      shippingAddress: {
        street: input.shippingAddress.street ?? '',
        city: input.shippingAddress.city ?? '',
        state: input.shippingAddress.state,
      },
      items: built.lines,
      subtotal: built.subtotal,
      shippingFee: shipping.shippingFee,
      totalAmount: built.subtotal + shipping.shippingFee,
      status: 'PENDING',
      timeline: [{ stage: 'PENDING', label: 'Order Created', completedAt: new Date() }],
    })
  } catch (err) {
    const concurrent = isDuplicateKeyError(err) ? await findReplay() : null
    if (concurrent) return { ok: true as const, data: toCheckoutSummary(concurrent) }
    throw err
  }

  try {
    const paystack = await initializePaystackTransaction({
      email: order.customerEmail,
      amountKobo: toKobo(order.totalAmount),
      reference: order.paymentReference,
      metadata: { orderId: order.orderId },
    })
    order.authorizationUrl = paystack.authorization_url
    await order.save()
    return { ok: true as const, data: toCheckoutSummary(order) }
  } catch (err) {
    console.error(`[Checkout] Paystack initialization failed for ${order.orderId}:`, err)
    order.status = 'FAILED'
    order.timeline.push({ stage: 'FAILED', label: 'Payment initialization failed', completedAt: new Date() })
    await order.save()
    return {
      ok: false as const,
      status: 502 as const,
      message: 'Unable to initialize payment. Please try again shortly.',
    }
  }
}

export const settlePaidOrder = async (params: {
  reference: string
  amountKobo: number
  currency: string
  source: 'PAYSTACK_VERIFY' | 'PAYSTACK_WEBHOOK'
}) => {
  const order = await Order.findOne({ paymentReference: params.reference })
  if (!order) {
    console.error(`[Payments] ${params.source} for unknown reference ${params.reference}`)
    return { state: 'not_found' as const }
  }

  const logEntry = {
    event: params.source,
    reference: params.reference,
    amount: params.amountKobo / 100,
    recordedAt: new Date(),
  }

  if (params.currency !== 'NGN' || params.amountKobo !== toKobo(order.totalAmount)) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: { fulfilmentIssue: 'AMOUNT_MISMATCH' },
        $push: { paymentLog: { ...logEntry, event: `${params.source}_AMOUNT_MISMATCH` } },
      }
    )
    console.error(`[Payments] Amount/currency mismatch on ${order.orderId}`)
    return { state: 'amount_mismatch' as const }
  }

  if (PAID_ORDER_STATUSES.includes(order.status)) return { state: 'settled' as const, order }

  if (!isClaimable(order)) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { fulfilmentIssue: 'PAID_AFTER_CANCEL' }, $push: { paymentLog: logEntry } }
    )
    console.error(`[Payments] Payment received for ${order.status} order ${order.orderId}; refund required`)
    return { state: 'not_payable' as const, order }
  }

  const claimFilter = { _id: order._id, status: order.status, cancelReason: order.cancelReason }
  const paidTimeline = { stage: 'PAID', label: 'Payment Confirmed', completedAt: new Date() }

  try {
    let claimed: OrderDoc | null = null
    await mongoose.connection.transaction(async (session) => {
      claimed = await Order.findOneAndUpdate(
        claimFilter,
        {
          $set: { status: 'PAID', stockDeducted: true, cancelReason: null },
          $push: { timeline: paidTimeline, paymentLog: logEntry },
        },
        { new: true, session }
      )
      if (claimed) await deductStock(claimed.items, session)
    })

    if (!claimed) {
      const current = await Order.findById(order._id)
      return { state: 'settled' as const, order: current ?? order }
    }

    void notifyOrderPaid(claimed)
    return { state: 'settled' as const, order: claimed as OrderDoc }
  } catch (err) {
    if (!(err instanceof StockConflictError)) throw err

    const flagged = await Order.findOneAndUpdate(
      claimFilter,
      {
        $set: { status: 'PAID', fulfilmentIssue: 'STOCK_CONFLICT', stockDeducted: false, cancelReason: null },
        $push: { timeline: paidTimeline, paymentLog: logEntry },
      },
      { new: true }
    )
    console.error(`[Payments] ${err.message} on paid order ${order.orderId}; manual resolution required`)
    return { state: 'settled' as const, order: flagged ?? order }
  }
}

export const verifyOrderPayment = async (reference: string) => {
  if (reference.startsWith('BESPOKE-DEP-')) {
    return verifyBespokeDeposit(reference)
  }

  const order = await Order.findOne({ paymentReference: reference })
  if (!order) return { state: 'not_found' as const }
  if (!isClaimable(order)) return { state: 'settled' as const, data: toReceipt(order) }

  let tx: Awaited<ReturnType<typeof verifyPaystackTransaction>>
  try {
    tx = await verifyPaystackTransaction(reference)
  } catch (err) {
    console.error(`[Payments] Paystack verify failed for ${order.orderId}:`, err)
    return { state: 'gateway_error' as const }
  }

  if (tx.status !== 'success') return { state: 'unpaid' as const, paymentStatus: tx.status }

  const result = await settlePaidOrder({
    reference,
    amountKobo: tx.amount,
    currency: tx.currency,
    source: 'PAYSTACK_VERIFY',
  })

  if (result.state === 'settled' || result.state === 'not_payable') {
    return { state: 'settled' as const, data: toReceipt(result.order) }
  }
  return result
}

export const expireStalePendingOrders = async () => {
  const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MS)
  const result = await Order.updateMany(
    { status: 'PENDING', createdAt: { $lt: cutoff } },
    {
      $set: { status: 'CANCELLED', cancelReason: 'EXPIRED', authorizationUrl: null },
      $push: { timeline: { stage: 'CANCELLED', label: 'Payment window expired', completedAt: new Date() } },
    }
  )
  return result.modifiedCount
}
