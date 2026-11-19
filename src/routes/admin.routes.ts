import { Hono } from 'hono'
import { createStaff, listStaff, listUsers } from '../controllers/admin/admin-auth.controller.js'
import {
  adjustProductStock,
  createAdminCollection,
  createAdminProduct,
  deleteAdminCollection,
  deleteOrArchiveProduct,
  getAdminProductById,
  listAdminCollections,
  listAdminProducts,
  updateAdminCollection,
  updateAdminProduct,
  uploadMedia,
} from '../controllers/admin/admin-catalog.controller.js'
import {
  getAdminCustomOrderById,
  listAdminCustomOrders,
  updateAdminCustomOrder,
} from '../controllers/admin/admin-custom-order.controller.js'
import {
  getAnalyticsOverview,
  getShippingSettings,
  listAdminEnquiries,
  listNewsletterSubscribers,
  updateAdminEnquiry,
  updateShippingSettings,
} from '../controllers/admin/admin-ops.controller.js'
import {
  createManualOrder,
  getAdminOrderById,
  listAdminOrders,
  updateOrderStatus,
} from '../controllers/admin/admin-order.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'

export const adminRouter = new Hono()

const superAdminGuard = [requireAuth, requireRole('SUPER_ADMIN')] as const
const catalogGuard = [requireAuth, requireRole('SUPER_ADMIN', 'WORKSHOP_MANAGER')] as const
const orderReadGuard = [
  requireAuth,
  requireRole('SUPER_ADMIN', 'WORKSHOP_MANAGER', 'CONCIERGE'),
] as const
const orderWriteGuard = [requireAuth, requireRole('SUPER_ADMIN', 'WORKSHOP_MANAGER')] as const
const customOrderGuard = [
  requireAuth,
  requireRole('SUPER_ADMIN', 'WORKSHOP_MANAGER', 'CONCIERGE'),
] as const
const enquiryGuard = [requireAuth, requireRole('SUPER_ADMIN', 'CONCIERGE')] as const

// User & staff management (SUPER_ADMIN only)
adminRouter.get('/users', ...superAdminGuard, ...listUsers)
adminRouter.get('/staff', ...superAdminGuard, ...listStaff)
adminRouter.post('/staff', ...superAdminGuard, ...createStaff)

// Footwear, collections, stock & media
adminRouter.get('/products', ...catalogGuard, ...listAdminProducts)
adminRouter.post('/products', ...catalogGuard, ...createAdminProduct)
adminRouter.get('/products/:id', ...catalogGuard, ...getAdminProductById)
adminRouter.patch('/products/:id', ...catalogGuard, ...updateAdminProduct)
adminRouter.patch('/products/:id/stock', ...catalogGuard, ...adjustProductStock)
adminRouter.delete('/products/:id', ...catalogGuard, ...deleteOrArchiveProduct)

adminRouter.get('/collections', ...catalogGuard, ...listAdminCollections)
adminRouter.post('/collections', ...catalogGuard, ...createAdminCollection)
adminRouter.patch('/collections/:id', ...catalogGuard, ...updateAdminCollection)
adminRouter.delete('/collections/:id', ...catalogGuard, ...deleteAdminCollection)

adminRouter.post('/uploads', ...catalogGuard, uploadMedia)

// Order & dispatch management
adminRouter.get('/orders', ...orderReadGuard, ...listAdminOrders)
adminRouter.post('/orders/manual', ...orderWriteGuard, ...createManualOrder)
adminRouter.get('/orders/:id', ...orderReadGuard, ...getAdminOrderById)
adminRouter.patch('/orders/:id/status', ...orderWriteGuard, ...updateOrderStatus)

// Bespoke / custom shoe commission pipeline
adminRouter.get('/custom-orders', ...customOrderGuard, ...listAdminCustomOrders)
adminRouter.get('/custom-orders/:id', ...customOrderGuard, ...getAdminCustomOrderById)
adminRouter.patch('/custom-orders/:id', ...customOrderGuard, ...updateAdminCustomOrder)

// Enquiries, newsletter, shipping settings & analytics
adminRouter.get('/enquiries', ...enquiryGuard, ...listAdminEnquiries)
adminRouter.patch('/enquiries/:id', ...enquiryGuard, ...updateAdminEnquiry)

adminRouter.get('/newsletter', ...superAdminGuard, ...listNewsletterSubscribers)

adminRouter.get('/settings/shipping', ...superAdminGuard, ...getShippingSettings)
adminRouter.patch('/settings/shipping', ...superAdminGuard, ...updateShippingSettings)

adminRouter.get('/analytics/overview', ...superAdminGuard, ...getAnalyticsOverview)
