import type { CollectionConfig } from 'payload'

import { adminFieldOnly, adminOnly, isAdmin, isEditor, isWriter } from '../../access/roles'
import {
  createFirstUserAsAdmin,
  preventLastAdminDelete,
  preventLastAdminRoleRemoval,
} from './hooks/protectRoles'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => isAdmin(user) || isEditor(user) || isWriter(user),
    create: async ({ req }) => {
      if (isAdmin(req.user)) return true

      const userCount = await req.payload.count({
        collection: 'users',
        overrideAccess: true,
      })

      return userCount.totalDocs === 0
    },
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (user?.id) {
        return {
          id: {
            equals: user.id,
          },
        }
      }
      return false
    },
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      access: {
        create: adminFieldOnly,
        update: adminFieldOnly,
      },
      defaultValue: 'writer',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'Writer',
          value: 'writer',
        },
      ],
      required: true,
    },
  ],
  hooks: {
    beforeChange: [createFirstUserAsAdmin, preventLastAdminRoleRemoval],
    beforeDelete: [preventLastAdminDelete],
  },
  timestamps: true,
}
