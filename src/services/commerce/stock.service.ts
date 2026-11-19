import type { ClientSession } from 'mongoose'
import { Product } from '../../models/product.model.js'

export interface StockLine {
  productId: string
  name: string
  size: number
  quantity: number
}

export class StockConflictError extends Error {
  constructor(line: StockLine) {
    super(`Insufficient stock for ${line.name} (EU ${line.size})`)
    this.name = 'StockConflictError'
  }
}

/** Must run inside a transaction so a failure on any line rolls back the others. */
export const deductStock = async (lines: StockLine[], session: ClientSession) => {
  for (const line of lines) {
    const result = await Product.updateOne(
      {
        publicId: line.productId,
        sizes: { $elemMatch: { size: line.size, stock: { $gte: line.quantity } } },
      },
      { $inc: { 'sizes.$.stock': -line.quantity } },
      { session }
    )

    if (result.modifiedCount !== 1) throw new StockConflictError(line)
  }
}

export const restoreStock = async (lines: StockLine[], session: ClientSession) => {
  for (const line of lines) {
    await Product.updateOne(
      { publicId: line.productId, 'sizes.size': line.size },
      { $inc: { 'sizes.$.stock': line.quantity } },
      { session }
    )
  }
}
