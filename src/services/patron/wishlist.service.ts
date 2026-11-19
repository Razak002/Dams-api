import { Product } from '../../models/product.model.js'
import { User } from '../../models/user.model.js'

export const getWishlist = async (userId: string) => {
  const user = await User.findOne({ publicId: userId }).select('wishlistProductIds')
  if (!user || user.wishlistProductIds.length === 0) {
    return []
  }

  return Product.find({
    publicId: { $in: user.wishlistProductIds },
    isActive: true,
  })
}

export const addToWishlist = async (userId: string, productId: string) => {
  const product = await Product.findOne({ publicId: productId, isActive: true }).select('publicId')
  if (!product) return { notFound: true as const }

  await User.updateOne(
    { publicId: userId },
    { $addToSet: { wishlistProductIds: product.publicId } }
  )

  const items = await getWishlist(userId)
  return { notFound: false as const, items }
}

export const removeFromWishlist = async (userId: string, productId: string) => {
  await User.updateOne(
    { publicId: userId },
    { $pull: { wishlistProductIds: productId } }
  )

  return getWishlist(userId)
}
