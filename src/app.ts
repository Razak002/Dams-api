import { Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { env, getDbHealth } from './config/db.js'
import { adminRouter } from './routes/admin.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { cartRouter } from './routes/cart.routes.js'
import { categoriesRouter } from './routes/categories.routes.js'
import { checkoutRouter } from './routes/checkout.routes.js'
import { collectionsRouter } from './routes/collections.routes.js'
import { customOrdersRouter } from './routes/custom-orders.routes.js'
import { enquiriesRouter } from './routes/enquiries.routes.js'
import { newsletterRouter } from './routes/newsletter.routes.js'
import { ordersRouter } from './routes/orders.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { shippingRouter } from './routes/shipping.routes.js'
import { webhooksRouter } from './routes/webhooks.routes.js'
import { wishlistRouter } from './routes/wishlist.routes.js'

const UPLOAD_PATHS = new Set(['/api/v1/admin/uploads', '/api/v1/custom-orders'])

const isOriginAllowed = (origin: string, rawCorsOrigin: unknown): boolean => {
  const raw = typeof rawCorsOrigin === 'string' && rawCorsOrigin.trim() ? rawCorsOrigin : env.CORS_ORIGIN
  const patterns = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return patterns.some((pattern) => {
    if (pattern === origin) return true
    if (pattern.startsWith('https://*.')) {
      return origin.startsWith('https://') && origin.endsWith(pattern.slice('https://*'.length))
    }
    if (pattern.startsWith('http://*.')) {
      return origin.startsWith('http://') && origin.endsWith(pattern.slice('http://*'.length))
    }
    return false
  })
}

/** Builds the Hono app. `dbMiddleware` lets runtimes (e.g. Workers) manage per-request DB connections. */
export const createApp = (dbMiddleware?: MiddlewareHandler) => {
  const app = new Hono()

  app.use('*', requestId())
  app.use('*', logger())
  app.use('*', secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const workerCors = (c.env as Record<string, unknown> | undefined)?.CORS_ORIGIN
        return isOriginAllowed(origin, workerCors) ? origin : ''
      },
      credentials: true,
    })
  )

  const uploadLimit = bodyLimit({
    maxSize: 16 * 1024 * 1024,
    onError: (c) => c.json({ status: 'error', message: 'Payload too large (max 16MB)' }, 413),
  })
  const defaultLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ status: 'error', message: 'Payload too large (max 1MB)' }, 413),
  })
  app.use('*', (c, next) => (UPLOAD_PATHS.has(c.req.path) ? uploadLimit(c, next) : defaultLimit(c, next)))

  if (dbMiddleware) {
    app.use('/api/*', dbMiddleware)
    app.use('/health', dbMiddleware)
  }

  app.get('/', (c) =>
    c.json({ service: 'dams-api', status: 'ok', environment: env.NODE_ENV })
  )

  app.get('/health', (c) => {
    const db = getDbHealth()
    return c.json(
      {
        status: db.healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        database: db,
      },
      db.healthy ? 200 : 503
    )
  })

  const v1 = new Hono()
  v1.route('/admin', adminRouter)
  v1.route('/auth', authRouter)
  v1.route('/wishlist', wishlistRouter)
  v1.route('/products', productsRouter)
  v1.route('/collections', collectionsRouter)
  v1.route('/categories', categoriesRouter)
  v1.route('/cart', cartRouter)
  v1.route('/shipping', shippingRouter)
  v1.route('/checkout', checkoutRouter)
  v1.route('/orders', ordersRouter)
  v1.route('/custom-orders', customOrdersRouter)
  v1.route('/enquiries', enquiriesRouter)
  v1.route('/newsletter', newsletterRouter)
  v1.route('/webhooks', webhooksRouter)
  app.route('/api/v1', v1)

  app.notFound((c) =>
    c.json({ error: 'Not Found', path: c.req.path, requestId: c.get('requestId') }, 404)
  )

  app.onError((err, c) => {
    console.error(`[Error] [${c.get('requestId') ?? 'no-id'}]`, err)
    return c.json(
      {
        error: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        requestId: c.get('requestId'),
      },
      500
    )
  })

  return app
}
