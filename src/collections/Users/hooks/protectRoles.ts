import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from 'payload'

import { isAdmin } from '../../../access/roles'

const countAdmins = async (req: Parameters<CollectionBeforeChangeHook>[0]['req']) => {
  const result = await req.payload.count({
    collection: 'users',
    overrideAccess: true,
    where: {
      role: {
        equals: 'admin',
      },
    },
  })

  return result.totalDocs
}

export const createFirstUserAsAdmin: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation === 'create') {
    const userCount = await req.payload.count({
      collection: 'users',
      overrideAccess: true,
    })

    if (userCount.totalDocs === 0) {
      data.role = 'admin'
    }
  }

  return data
}

export const preventLastAdminRoleRemoval: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || originalDoc?.role !== 'admin' || data.role === 'admin') {
    return data
  }

  if (!isAdmin(req.user)) {
    throw new Error('Only admins can manage user roles.')
  }

  if ((await countAdmins(req)) <= 1) {
    throw new Error('At least one admin account must remain.')
  }

  return data
}

export const preventLastAdminDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const user = await req.payload.findByID({
    id,
    collection: 'users',
    overrideAccess: true,
  })

  if (user?.role === 'admin' && (await countAdmins(req)) <= 1) {
    throw new Error('At least one admin account must remain.')
  }
}
