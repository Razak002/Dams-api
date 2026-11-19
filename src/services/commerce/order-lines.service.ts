import { Product } from '../../models/product.model.js'
import type { CartItemInput } from '../../validators/cart.validators.js'

export interface OrderLine {
  productId: string
  slug: string
  name: string
  size: number
  colour: string
  quantity: number
  priceAtPurchase: number
}

type BuildResult =
  | { ok: true; lines: OrderLine[]; subtotal: number }
  | { ok: false; status: 400 | 409; message: string }

const stockKey = (productId: string, size: number) => `${productId}:${size}`

/** Merges duplicate cart lines and validates price, colour and aggregated stock server-side. */
export const buildOrderLines = async (
  items: CartItemInput[],
  { activeOnly }: { activeOnly: boolean }
): Promise<BuildResult> => {
  const merged = new Map<string, CartItemInput>()
  for (const item of items) {
    const key = `${item.productId}:${item.size}:${(item.colour ?? '').toLowerCase()}`
    const existing = merged.get(key)
    if (existing) existing.quantity += item.quantity
    else merged.set(key, { ...item })
  }

  const productIds = [...new Set(items.map((i) => i.productId))]
  const products = await Product.find({
    publicId: { $in: productIds },
    ...(activeOnly ? { isActive: true } : {}),
  }).select('publicId slug name price sizes colourways')
  const productMap = new Map(products.map((p) => [p.publicId, p]))

  const requested = new Map<string, number>()
  const lines: OrderLine[] = []

  for (const item of merged.values()) {
    const product = productMap.get(item.productId)
    if (!product) {
      return { ok: false, status: 400, message: `Product not found: ${item.productId}` }
    }

    let colour = ''
    if (product.colourways.length > 0) {
      const match = product.colourways.find(
        (c) => c.name.toLowerCase() === (item.colour ?? '').trim().toLowerCase()
      )
      if (!match) {
        return { ok: false, status: 400, message: `Select a valid colourway for ${product.name}` }
      }
      colour = match.name
    }

    if (!product.sizes.some((s) => s.size === item.size)) {
      return { ok: false, status: 400, message: `EU ${item.size} is not offered for ${product.name}` }
    }

    const key = stockKey(product.publicId, item.size)
    requested.set(key, (requested.get(key) ?? 0) + item.quantity)

    lines.push({
      productId: product.publicId,
      slug: product.slug,
      name: product.name,
      size: item.size,
      colour,
      quantity: item.quantity,
      priceAtPurchase: product.price,
    })
  }

  for (const [key, quantity] of requested) {
    const [productId, size] = key.split(':')
    const product = productMap.get(productId!)!
    const available = product.sizes.find((s) => s.size === Number(size))?.stock ?? 0
    if (available < quantity) {
      return {
        ok: false,
        status: 409,
        message: `Insufficient stock for ${product.name} (EU ${size})`,
      }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.priceAtPurchase * l.quantity, 0)
  return { ok: true, lines, subtotal }
}
