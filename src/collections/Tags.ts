import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { adminOnly, adminOrEditor } from '../access/roles'

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    create: adminOrEditor,
    delete: adminOnly,
    read: () => true,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['name', 'slug'],
    group: 'Editorial',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
      useAsSlug: 'name',
    }),
  ],
}
