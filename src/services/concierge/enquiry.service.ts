import { randomBytes } from 'node:crypto'
import { Enquiry } from '../../models/enquiry.model.js'
import { normalizePhone } from '../../utils/phone.js'
import type { CreateEnquiryInput } from '../../validators/enquiry.validators.js'

const generateTicketId = () => `ENQ-${randomBytes(3).toString('hex').toUpperCase()}`

export const createEnquiry = async (input: CreateEnquiryInput) => {
  const ticketId = generateTicketId()

  const enquiry = await Enquiry.create({
    ticketId,
    fullName: input.fullName,
    email: input.email,
    phone: normalizePhone(input.phone),
    subject: input.subject,
    message: input.message,
  })

  return {
    ticketId: enquiry.ticketId,
  }
}
