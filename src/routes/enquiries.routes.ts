import { Hono } from 'hono'
import { submitEnquiry } from '../controllers/concierge/enquiry.controller.js'

export const enquiriesRouter = new Hono()

enquiriesRouter.post('/', ...submitEnquiry)
