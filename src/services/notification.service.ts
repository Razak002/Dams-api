interface NotifiableOrder {
  orderId: string
  status: string
}

// Provider-agnostic hooks; wire an email/WhatsApp provider (e.g. Resend, Termii) here.
export const notifyOrderPaid = async (order: NotifiableOrder) => {
  console.info(`[Notify] Payment confirmation pending delivery for ${order.orderId}`)
}

export const notifyOrderStatusChanged = async (order: NotifiableOrder) => {
  console.info(`[Notify] Status update (${order.status}) pending delivery for ${order.orderId}`)
}
