import 'dotenv/config'
import { connectDB, disconnectDB, env, hydrateEnv } from '../config/db.js'
import { Collection } from '../models/collection.model.js'
import { Product } from '../models/product.model.js'
import { collections, products } from './data.js'

hydrateEnv(process.env)

/**
 * Idempotent catalogue seeder: upserts by slug, never deletes.
 * Re-running updates seed-managed fields (including stock) back to seed values.
 * Usage: npm run seed
 */
const run = async () => {
  if (env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('[Seed] Refusing to seed in production without --force')
    process.exit(1)
  }

  await connectDB()

  const colResult = await Collection.bulkWrite(
    collections.map((doc) => ({
      updateOne: { filter: { slug: doc.slug }, update: { $set: doc }, upsert: true },
    }))
  )

  const prodResult = await Product.bulkWrite(
    products.map((doc) => ({
      updateOne: { filter: { slug: doc.slug }, update: { $set: doc }, upsert: true },
    })),
    { timestamps: false }
  )

  console.log(`[Seed] Collections: ${colResult.upsertedCount} created, ${colResult.modifiedCount} updated`)
  console.log(`[Seed] Products: ${prodResult.upsertedCount} created, ${prodResult.modifiedCount} updated`)
}

run()
  .catch((err) => {
    console.error('[Seed] Failed:', err)
    process.exitCode = 1
  })
  .finally(() => disconnectDB())
