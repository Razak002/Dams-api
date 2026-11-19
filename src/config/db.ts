import mongoose from 'mongoose'
import { z } from 'zod'

const DEV_JWT_FALLBACK = 'dams-dev-jwt-secret-change-in-prod'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must be a valid MongoDB connection URI'),
    JWT_SECRET: z.string().min(16).default(DEV_JWT_FALLBACK),
    CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001'),
    PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
    PAYSTACK_CALLBACK_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.JWT_SECRET === DEV_JWT_FALLBACK) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be explicitly set in production',
      })
    }
  })

export type AppEnv = z.infer<typeof envSchema>

const initialEnv: AppEnv = {
  NODE_ENV: 'development',
  PORT: 3000,
  MONGODB_URI: 'mongodb://127.0.0.1:27017/dams-api',
  JWT_SECRET: DEV_JWT_FALLBACK,
  CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001',
  TRUST_PROXY: false,
}

export const env: AppEnv = { ...initialEnv }

export const hydrateEnv = (raw: Record<string, unknown>): AppEnv => {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('Invalid environment configuration:', z.treeifyError(parsed.error))
    throw new Error('Invalid environment configuration')
  }
  Object.assign(env, parsed.data)
  return env
}

// Eagerly hydrate in Node when process.env already has MONGODB_URI (Workers hydrate per-request).
if (typeof process !== 'undefined' && process.env?.MONGODB_URI) {
  hydrateEnv(process.env)
}

const READY_STATE_MAP: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

let listenersRegistered = false

const registerConnectionListeners = (): void => {
  if (listenersRegistered) return
  listenersRegistered = true

  mongoose.connection.on('connected', () => {
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
  })

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected')
  })
}

export const connectDB = async (): Promise<typeof mongoose> => {
  registerConnectionListeners()

  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  try {
    return await mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== 'production',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
  } catch (error) {
    console.error('[DB] Initial MongoDB connection failed:', error)
    throw error
  }
}

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false)
  }
}

export const getDbHealth = () => {
  const readyState = mongoose.connection.readyState
  return {
    healthy: readyState === 1,
    state: READY_STATE_MAP[readyState] ?? 'unknown',
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || null,
  }
}
