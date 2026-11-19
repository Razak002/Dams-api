import { Order } from '../../models/order.model.js'
import { buildContactFilter } from '../../utils/phone.js'
import type { ListPatronOrdersQuery, TrackOrderQuery } from '../../validators/order.validators.js'

export const listPatronOrders = async (userId: string, { page, limit }: ListPatronOrdersQuery) => {
  const filter = { userId }

  const [total, data] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'orderId paymentReference items subtotal shippingFee totalAmount status timeline trackingNote createdAt'
      ),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const trackOrder = async ({ reference, contact }: TrackOrderQuery) => {
  const contactFilter = buildContactFilter(contact, { email: 'customerEmail', phone: 'customerPhone' })
  if (!contactFilter) return null

  const ref = reference.trim()
  const order = await Order.findOne({
    $or: [{ orderId: ref.toUpperCase() }, { paymentReference: ref }],
    ...contactFilter,
  }).select('orderId status timeline trackingNote')

  if (!order) return null

  return {
    orderId: order.orderId,
    status: order.status,
    timeline: order.timeline,
    trackingNote: order.trackingNote,
  }
}
