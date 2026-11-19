import { randomBytes } from 'node:crypto'

const randomHex = (bytes: number) => randomBytes(bytes).toString('hex').toUpperCase()

export const generateOrderId = () => `ORD-${randomHex(5)}`

export const generatePaymentReference = (prefix: 'DAMS' | 'MANUAL') =>
  `${prefix}-${Date.now()}-${randomHex(6)}`

export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000
