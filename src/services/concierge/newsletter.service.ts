import { NewsletterSubscriber } from '../../models/newsletter.model.js'
import type { SubscribeNewsletterInput } from '../../validators/newsletter.validators.js'

export const subscribeToNewsletter = async (input: SubscribeNewsletterInput) => {
  const existing = await NewsletterSubscriber.findOne({ email: input.email })

  if (existing) {
    if (!existing.isActive || existing.source !== input.source) {
      existing.isActive = true
      existing.source = input.source
      await existing.save()
    }
    return { created: false }
  }

  await NewsletterSubscriber.create({
    email: input.email,
    source: input.source,
    isActive: true,
  })

  return { created: true }
}
