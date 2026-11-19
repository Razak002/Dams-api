import { Product } from '../../models/product.model.js'
import type { CartItemInput } from '../../validators/cart.validators.js'

export interface ValidatedCartItem {
  productId: string
  size: number
  availableStock: number
  currentPrice: number
  isAvailable: boolean
}

export const validateCartItems = async (items: CartItemInput[]) => {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const products = await Product.find({ publicId: { $in: productIds }, isActive: true }).select(
    'publicId price sizes colourways'
  )
  const productMap = new Map(products.map((p) => [p.publicId, p]))

  const requested = new Map<string, number>()
  for (const item of items) {
    const key = `${item.productId}:${item.size}`
    requested.set(key, (requested.get(key) ?? 0) + item.quantity)
  }

  const validatedItems: ValidatedCartItem[] = items.map((item) => {
    const product = productMap.get(item.productId)
    if (!product) {
      return {
        productId: item.productId,
        size: item.size,
        availableStock: 0,
        currentPrice: 0,
        isAvailable: false,
      }
    }

    const availableStock = product.sizes.find((s) => s.size === item.size)?.stock ?? 0
    const colourValid =
      product.colourways.length === 0 ||
      product.colourways.some(
        (c) => c.name.toLowerCase() === (item.colour ?? '').trim().toLowerCase()
      )

    return {
      productId: product.publicId,
      size: item.size,
      availableStock,
      currentPrice: product.price,
      isAvailable:
        colourValid && availableStock >= (requested.get(`${item.productId}:${item.size}`) ?? 0),
    }
  })

  return {
    valid: validatedItems.every((item) => item.isAvailable),
    items: validatedItems,
  }
}
