import type { QueryFilter } from 'mongoose'
import { CustomOrder } from '../../models/custom-order.model.js'
import { Enquiry, type IEnquiry } from '../../models/enquiry.model.js'
import { NewsletterSubscriber } from '../../models/newsletter.model.js'
import { Order } from '../../models/order.model.js'
import { Product } from '../../models/product.model.js'
import type {
  AdminListEnquiriesQuery,
  AdminListNewsletterQuery,
  AdminUpdateEnquiryInput,
} from '../../validators/admin-ops.validators.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PAID_ORDER_STATUSES = ['PAID', 'IN_WORKSHOP', 'DISPATCHED', 'DELIVERED'] as const
const LOW_STOCK_THRESHOLD = 3

export const listAdminEnquiries = async (query: AdminListEnquiriesQuery) => {
  const { subject, status, search, page, limit } = query
  const filter: QueryFilter<IEnquiry> = {}

  if (subject) filter.subject = subject
  if (status) filter.status = status
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ ticketId: rx }, { fullName: rx }, { email: rx }, { message: rx }]
  }

  const [total, data] = await Promise.all([
    Enquiry.countDocuments(filter),
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data,
  }
}

export const updateAdminEnquiry = async (id: string, input: AdminUpdateEnquiryInput) => {
  const enquiry = await Enquiry.findOne({ ticketId: id.trim().toUpperCase() })
  if (!enquiry) return null

  if (input.status !== undefined) {
    enquiry.status = input.status
    enquiry.resolvedAt = input.status === 'RESOLVED' ? new Date() : null
  }
  if (input.conciergeNotes !== undefined) {
    enquiry.conciergeNotes = input.conciergeNotes
  }

  await enquiry.save()
  return enquiry
}

const escapeCsv = (value: string) => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const listNewsletterSubscribers = async (query: AdminListNewsletterQuery) => {
  const filter = query.activeOnly === 'true' ? { isActive: true } : {}

  if (query.format === 'csv') {
    const rows = await NewsletterSubscriber.find(filter).sort({ createdAt: -1 })
    const header = 'email,source,isActive,createdAt'
    const lines = rows.map((r) =>
      [
        escapeCsv(r.email),
        escapeCsv(r.source ?? 'footer'),
        String(r.isActive),
        r.createdAt ? r.createdAt.toISOString() : '',
      ].join(',')
    )
    return { format: 'csv' as const, csv: [header, ...lines].join('\n') }
  }

  const [total, data] = await Promise.all([
    NewsletterSubscriber.countDocuments(filter),
    NewsletterSubscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ])

  return {
    format: 'json' as const,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    data,
  }
}

export const getAnalyticsOverview = async () => {
  const [
    revenueRows,
    orderStatusRows,
    pendingCustomCommissions,
    lowStockProducts,
    topProductRows,
    salesByStateRows,
  ] = await Promise.all([
    Order.aggregate<{ totalRevenue: number; paidOrders: number }>([
      { $match: { status: { $in: [...PAID_ORDER_STATUSES] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, paidOrders: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CustomOrder.countDocuments({ commissionStatus: { $in: ['NEW', 'REVIEWING', 'QUOTED'] } }),
    Product.find({
      isActive: true,
      sizes: { $elemMatch: { stock: { $lte: LOW_STOCK_THRESHOLD } } },
    }).select('publicId slug name sizes'),
    Order.aggregate<{ _id: string; unitsSold: number; revenue: number }>([
      { $match: { status: { $in: [...PAID_ORDER_STATUSES] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtPurchase', '$items.quantity'] } },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate<{ _id: string; ordersCount: number; revenue: number }>([
      { $match: { status: { $in: [...PAID_ORDER_STATUSES] } } },
      {
        $group: {
          _id: '$shippingAddress.state',
          ordersCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ])

  const topIds = topProductRows.map((r) => r._id)
  const topProducts = topIds.length
    ? await Product.find({ publicId: { $in: topIds } }).select('publicId silhouette name')
    : []
  const productLookup = new Map(topProducts.map((p) => [p.publicId, p]))

  const ordersByStatus = Object.fromEntries(orderStatusRows.map((r) => [r._id, r.count]))
  const ordersCount = orderStatusRows.reduce((sum, r) => sum + r.count, 0)

  return {
    totalRevenueNGN: revenueRows[0]?.totalRevenue ?? 0,
    paidOrdersCount: revenueRows[0]?.paidOrders ?? 0,
    ordersCount,
    ordersByStatus,
    pendingCustomCommissions,
    lowStockAlerts: lowStockProducts.map((p) => ({
      productId: p.publicId,
      slug: p.slug,
      name: p.name,
      lowSizes: p.sizes
        .filter((s) => s.stock <= LOW_STOCK_THRESHOLD)
        .map((s) => ({ size: s.size, stock: s.stock })),
    })),
    topSilhouettes: topProductRows.map((r) => {
      const prod = productLookup.get(r._id)
      return {
        productId: r._id,
        name: prod?.name ?? r._id,
        silhouette: prod?.silhouette ?? 'Unknown',
        unitsSold: r.unitsSold,
        revenueNGN: r.revenue,
      }
    }),
    salesByState: salesByStateRows.map((r) => ({
      state: r._id || 'Unspecified',
      ordersCount: r.ordersCount,
      revenueNGN: r.revenue,
    })),
  }
}
