import 'dotenv/config'
import { connectDB, disconnectDB, hydrateEnv } from '../config/db.js'
import { User, type UserRole } from '../models/user.model.js'
import { hashPassword } from '../utils/auth.js'

hydrateEnv(process.env)

interface SeedAccount {
  publicId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  role: UserRole
}

const ACCOUNTS: SeedAccount[] = [
  {
    publicId: 'usr_admin_razak',
    firstName: 'Razak',
    lastName: 'Admin',
    email: 'razak@admin.com',
    phone: '+2348000000001',
    password: 'Abdul002$',
    role: 'SUPER_ADMIN',
  },
  {
    publicId: 'usr_customer_razak',
    firstName: 'Razak',
    lastName: 'Patron',
    email: 'razak@user.com',
    phone: '+2348000000002',
    password: 'Abdul002$',
    role: 'CUSTOMER',
  },
]

/**
 * Seeds one SUPER_ADMIN and one CUSTOMER account into the User collection.
 * Usage: npm run seed:admin
 */
const run = async () => {
  await connectDB()

  for (const acc of ACCOUNTS) {
    const passwordHash = await hashPassword(acc.password)
    const result = await User.updateOne(
      { email: acc.email },
      {
        $setOnInsert: { publicId: acc.publicId },
        $set: {
          firstName: acc.firstName,
          lastName: acc.lastName,
          email: acc.email,
          phone: acc.phone,
          passwordHash,
          role: acc.role,
          isActive: true,
        },
      },
      { upsert: true }
    )

    const action = result.upsertedCount > 0 ? 'Created' : 'Updated'
    console.log(`[Seed Users] ${action} ${acc.role}: ${acc.email}`)
  }
}

run()
  .catch((err) => {
    console.error('[Seed Users] Failed:', err)
    process.exitCode = 1
  })
  .finally(() => disconnectDB())
