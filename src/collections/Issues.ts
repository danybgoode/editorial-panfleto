import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { adminOnly, adminOrEditor } from '../access/roles'

export const Issues: CollectionConfig = {
  slug: 'issues',
  access: {
    create: adminOrEditor,
    delete: adminOnly,
    read: () => true,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'issueDate', 'slug'],
    group: 'Editorial',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
    {
      name: 'issueDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
      required: true,
    },
    {
      name: 'issueNumber',
      type: 'text',
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
