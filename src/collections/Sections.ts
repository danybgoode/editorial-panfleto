import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { adminOnly, adminOrEditor } from '../access/roles'

export const Sections: CollectionConfig = {
  slug: 'sections',
  access: {
    create: adminOrEditor,
    delete: adminOnly,
    read: () => true,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['name', 'slug', 'displayOrder', 'isActive'],
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
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'sections',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active',
    },
  ],
}
