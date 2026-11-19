import mongoose, { type QueryFilter } from 'mongoose'
import {
  Order,
  PAID_ORDER_STATUSES,
  type IOrder,
  type OrderStatus,
} from '../../models/order.model.js'
import { generateOrderId, generatePaymentReference } from '../../utils/ids.js'
import { normalizePhone } from '../../utils/phone.js'
import type {
  AdminCreateManualOrderInput,
  AdminListOrdersQuery,
  AdminUpdateOrderStatusInput,
} from '../../validators/admin-order.validators.js'
import { buildOrderLines } from '../commerce/order-lines.service.js'
import { calculateShippingRate } from '../commerce/shipping.service.js'
import { deductStock, restoreStock, StockConflictError } from '../commerce/stock.service.js'
import { notifyOrderStatusChanged } from '../notification.service.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Order Created',
  PAID: 'Payment Confirmed',
  IN_WORKSHOP: 'Inspecting & Preparing in Abuja',
  DISPATCHED: 'Dispatched for Delivery',
  DELIVERED: 'Delivered to Patron',
  FAILED: 'Payment Failed',
  CANCELLED: 'Order Cancelled',
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  PAID: ['IN_WORKSHOP', 'CANCELLED'],
  IN_WORKSHOP: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
}

const orderLookup = (id: string) => ({
  $or: [{ orderId: id.toUpperCase() }, { paymentReference: id }],
})

export const listAdminOrders = async (query: AdminListOrdersQuery) => {
  const { status, paymentMethod, fulfilmentIssue, state, from, to, search, page, limit } = query
  const filter: QueryFilter<IOrder> = {}

  if (status) filter.status = status
  if (paymentMethod) filter.paymentMethod = paymentMethod
  if (fulfilmentIssue) filter.fulfilmentIssue = fulfilmentIssue
  if (state) filter['shippingAddress.state'] = new RegExp(`^${escapeRegex(state)}$`, 'i')
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    }
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { orderId: rx },
      { paymentReference: rx },
      { customerEmail: rx },
      { customerName: rx },
    ]
  }

  const [total, data] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const getAdminOrderById = async (id: string) => Order.findOne(orderLookup(id))

type StatusUpdateResult =
  | { state: 'not_found' }
  | { state: 'invalid_transition'; from: OrderStatus }
  | { state: 'updated'; order: NonNullable<Awaited<ReturnType<typeof Order.findOne>>> }

export const updateOrderStatus = async (
  id: string,
  input: AdminUpdateOrderStatusInput
): Promise<StatusUpdateResult> => {
  const result = await mongoose.connection.transaction<StatusUpdateResult>(async (session) => {
    const order = await Order.findOne(orderLookup(id)).session(session)
    if (!order) {
      return { state: 'not_found' }
    }

    const from = order.status
    if (!ALLOWED_TRANSITIONS[from].includes(input.status)) {
      return { state: 'invalid_transition', from }
    }

    if (input.status === 'CANCELLED') {
      order.cancelReason = 'ADMIN'
      order.authorizationUrl = null
      if (order.stockDeducted) {
        await restoreStock(order.items, session)
        order.stockDeducted = false
      }
      if (PAID_ORDER_STATUSES.includes(from)) order.fulfilmentIssue = 'REFUND_REQUIRED'
    }

    order.status = input.status
    if (input.trackingNote !== undefined) order.trackingNote = input.trackingNote
    if (order.dispatch) {
      if (input.riderName !== undefined) order.dispatch.riderName = input.riderName
      if (input.riderPhone !== undefined) order.dispatch.riderPhone = normalizePhone(input.riderPhone)
      if (input.waybillNumber !== undefined) order.dispatch.waybillNumber = input.waybillNumber
    }
    order.timeline.push({ stage: input.status, label: STATUS_LABELS[input.status], completedAt: new Date() })

    await order.save({ session })
    return { state: 'updated', order }
  })

  if (result.state === 'updated') void notifyOrderStatusChanged(result.order)
  return result
}

export const createManualOrder = async (input: AdminCreateManualOrderInput, recordedBy: string) => {
  const built = await buildOrderLines(input.items, { activeOnly: false })
  if (!built.ok) return built

  const shippingFee =
    input.paymentMethod === 'walk-in'
      ? 0
      : (await calculateShippingRate(input.shippingAddress.state, built.subtotal)).shippingFee
  const totalAmount = built.subtotal + shippingFee
  const paymentReference = generatePaymentReference('MANUAL')

  try {
    let created: Awaited<ReturnType<typeof Order.create>>[number] | null = null
    await mongoose.connection.transaction(async (session) => {
      await deductStock(built.lines, session)
      const [order] = await Order.create(
        [
          {
            orderId: generateOrderId(),
            paymentReference,
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
            shippingFee,
            totalAmount,
            paymentMethod: input.paymentMethod,
            status: input.status,
            stockDeducted: true,
            trackingNote: input.trackingNote ?? '',
            timeline: [{ stage: input.status, label: STATUS_LABELS[input.status], completedAt: new Date() }],
            paymentLog: [
              {
                event: `MANUAL_${input.paymentMethod.toUpperCase()} (${recordedBy})`,
                reference: paymentReference,
                amount: totalAmount,
                recordedAt: new Date(),
              },
            ],
          },
        ],
        { session }
      )
      created = order ?? null
    })

    return { ok: true as const, data: created! }
  } catch (err) {
    if (err instanceof StockConflictError) {
      return { ok: false as const, status: 409 as const, message: err.message }
    }
    throw err
  }
}
