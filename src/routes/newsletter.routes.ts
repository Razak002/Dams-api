import { Hono } from 'hono'
import { subscribeNewsletter } from '../controllers/concierge/newsletter.controller.js'

export const newsletterRouter = new Hono()

newsletterRouter.post('/subscribe', ...subscribeNewsletter)
