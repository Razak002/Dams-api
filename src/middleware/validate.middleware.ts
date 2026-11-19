import type { Context, Next } from 'hono'

export const requireJsonBody = async (c: Context, next: Next) => {
  const contentType = c.req.header('content-type') || ''
  if (!contentType.includes('application/json')) {
    return c.json({ error: 'Content-Type must be application/json' }, 415)
  }

  try {
    await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  await next()
}
