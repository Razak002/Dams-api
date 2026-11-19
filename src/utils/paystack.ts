import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/db.js'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

const getSecretKey = (): string => {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured')
  }
  return env.PAYSTACK_SECRET_KEY
}

interface PaystackApiResponse<T> {
  status: boolean
  message: string
  data: T
}

export const initializePaystackTransaction = async (params: {
  email: string
  amountKobo: number
  reference: string
  metadata?: Record<string, unknown>
}) => {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: 'NGN',
      reference: params.reference,
      ...(env.PAYSTACK_CALLBACK_URL ? { callback_url: env.PAYSTACK_CALLBACK_URL } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }),
  })

  const json = (await res.json()) as PaystackApiResponse<{
    authorization_url: string
    access_code: string
    reference: string
  }>

  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Paystack initialization failed')
  }

  return json.data
}

export const verifyPaystackTransaction = async (reference: string) => {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
    }
  )

  const json = (await res.json()) as PaystackApiResponse<{
    status: string
    reference: string
    amount: number
    currency: string
  }>

  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Paystack verification failed')
  }

  return json.data
}

export const verifyPaystackSignature = (rawBody: string, signature: string | undefined): boolean => {
  if (!signature || !env.PAYSTACK_SECRET_KEY) return false

  const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
