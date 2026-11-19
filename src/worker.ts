import type { MiddlewareHandler } from 'hono'
import mongoose from 'mongoose'
import { createApp } from './app.js'
import { env, hydrateEnv } from './config/db.js'
import { expireStalePendingOrders } from './services/commerce/checkout.service.js'

// Serialized per-request DB queue prevents Cloudflare Workers cross-request socket errors.
let requestQueue: Promise<unknown> = Promise.resolve()

const enqueueDbTask = <T>(fn: () => Promise<T>): Promise<T> => {
  const current = requestQueue.then(fn, fn)
  requestQueue = current.catch(() => {})
  return current
}

const connectPerRequest = async (workerEnv: Record<string, unknown>) => {
  hydrateEnv(workerEnv)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {})
  }
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: false,
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  })
}

const workerDbMiddleware: MiddlewareHandler = async (c, next) => {
  return enqueueDbTask(async () => {
    try {
      await connectPerRequest((c.env ?? {}) as Record<string, unknown>)
      await next()
    } catch (err) {
      console.error('[Worker DB] Connection or handler error:', err)
      return c.json({ status: 'error', message: 'Database connection failed' }, 500)
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {})
      }
    }
  })
}

const app = createApp(workerDbMiddleware)

export default {
  fetch: app.fetch,
  scheduled: async (
    _event: unknown,
    workerEnv: Record<string, unknown>,
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ) => {
    ctx.waitUntil(
      enqueueDbTask(async () => {
        try {
          await connectPerRequest(workerEnv)
          await expireStalePendingOrders()
        } finally {
          if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(() => {})
          }
        }
      })
    )
  },
}
