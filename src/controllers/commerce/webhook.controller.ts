import type { Context } from 'hono'
import { settleBespokeDeposit } from '../../services/admin/admin-custom-order.service.js'
import { settlePaidOrder } from '../../services/commerce/checkout.service.js'
import { verifyPaystackSignature } from '../../utils/paystack.js'

interface PaystackWebhookPayload {
  event?: string
  data?: { reference?: string; amount?: number; currency?: string }
}

export const handlePaystackWebhook = async (c: Context) => {
  const rawBody = await c.req.text()

  if (!verifyPaystackSignature(rawBody, c.req.header('x-paystack-signature'))) {
    return c.json({ status: 'error', message: 'Invalid webhook signature' }, 401)
  }

  let payload: PaystackWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ status: 'error', message: 'Invalid JSON payload' }, 400)
  }

  const { event, data } = payload
  if (
    event === 'charge.success' &&
    typeof data?.reference === 'string' &&
    typeof data.amount === 'number' &&
    typeof data.currency === 'string'
  ) {
    if (data.reference.startsWith('BESPOKE-DEP-')) {
      await settleBespokeDeposit({
        reference: data.reference,
        amountKobo: data.amount,
        currency: data.currency,
      })
    } else {
      // Throws on infrastructure errors so Paystack retries; business outcomes are logged and flagged.
      await settlePaidOrder({
        reference: data.reference,
        amountKobo: data.amount,
        currency: data.currency,
        source: 'PAYSTACK_WEBHOOK',
      })
    }
  }

  return c.json({ status: 'success', received: true })
}
