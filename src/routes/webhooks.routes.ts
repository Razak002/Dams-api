import { Hono } from 'hono'
import { handlePaystackWebhook } from '../controllers/commerce/webhook.controller.js'

export const webhooksRouter = new Hono()

webhooksRouter.post('/paystack', handlePaystackWebhook)
