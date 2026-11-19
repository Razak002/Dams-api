export const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('234')) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

/** Builds a safe email-or-phone filter; returns null when contact is unusable. */
export const buildContactFilter = (
  contact: string,
  fields: { email: string; phone: string }
): Record<string, string> | null => {
  const value = contact.trim()
  if (value.includes('@')) return { [fields.email]: value.toLowerCase() }

  const phone = normalizePhone(value)
  return phone.length >= 7 ? { [fields.phone]: phone } : null
}
