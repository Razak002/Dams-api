import { createMiddleware } from 'hono/factory'
import { env } from '../config/db.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix: string
}

export const rateLimit = ({ windowMs, max, keyPrefix }: RateLimitOptions) => {
  const store = new Map<string, RateLimitEntry>()

  return createMiddleware(async (c, next) => {
    const now = Date.now()
    if (store.size > 500) {
      for (const [k, entry] of store.entries()) {
        if (entry.resetAt <= now) store.delete(k)
      }
    }

    const cfIp = c.req.header('cf-connecting-ip')
    const forwardedFor = env.TRUST_PROXY
      ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip')
      : undefined
    const clientIp = cfIp || forwardedFor || 'local'
    const key = `${keyPrefix}:${clientIp}`

    const current = store.get(key)
    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      c.header('Retry-After', String(retryAfterSeconds))
      return c.json(
        {
          status: 'error',
          message: 'Too many requests, please try again later',
        },
        429
      )
    }

    current.count += 1
    await next()
  })
}
