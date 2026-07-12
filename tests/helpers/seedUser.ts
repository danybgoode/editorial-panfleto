import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  role: 'admin' as const,
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    limit: 1,
    overrideAccess: true,
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      id: existing.docs[0].id,
      collection: 'users',
      data: testUser,
      overrideAccess: true,
    })

    return
  }

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUser,
    overrideAccess: true,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
