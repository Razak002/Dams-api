import 'dotenv/config'
import { serve, type ServerType } from '@hono/node-server'
import { createApp } from './app.js'
import { connectDB, disconnectDB, env, hydrateEnv } from './config/db.js'
import { expireStalePendingOrders } from './services/commerce/checkout.service.js'

hydrateEnv(process.env)

export const app = createApp()

let server: ServerType | null = null
let expiryInterval: ReturnType<typeof setInterval> | null = null
let isShuttingDown = false

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`)

  if (expiryInterval) {
    clearInterval(expiryInterval)
    expiryInterval = null
  }

  const forceExitTimer = setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
  forceExitTimer.unref()

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()))
      })
      console.log('[Server] HTTP server closed')
    }

    await disconnectDB()
    console.log('[Server] Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('[Server] Error during graceful shutdown:', error)
    process.exit(1)
  }
}

const startServer = async (): Promise<void> => {
  try {
    await connectDB()

    server = serve(
      {
        fetch: app.fetch,
        port: env.PORT,
      },
      (info) => {
        console.log(`[Server] Running in ${env.NODE_ENV} mode on http://localhost:${info.port}`)
      }
    )

    expiryInterval = setInterval(() => {
      void expireStalePendingOrders().catch((err) => {
        console.error('[Checkout] Stale order expiry error:', err)
      })
    }, 15 * 60 * 1000)
    expiryInterval.unref()

    process.on('SIGINT', () => void gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
  } catch (error) {
    console.error('[Server] Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
