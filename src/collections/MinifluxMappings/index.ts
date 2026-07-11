import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { adminOnly, adminOrEditor } from '../../access/roles'

const setMinifluxTargetKey: CollectionBeforeValidateHook = ({ data }) => {
  if (data?.sourceType && data?.minifluxTargetId) {
    data.minifluxTargetKey = `${data.sourceType}:${data.minifluxTargetId}`
  }

  return data
}

export const MinifluxMappings: CollectionConfig = {
  slug: 'miniflux-mappings',
  access: {
    create: adminOrEditor,
    delete: adminOnly,
    read: adminOrEditor,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: [
      'title',
      'sourceType',
      'minifluxTargetId',
      'section',
      'active',
      'lastSyncAt',
    ],
    group: 'Editorial',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      defaultValue: 'category',
      options: [
        { label: 'Category', value: 'category' },
        { label: 'Feed', value: 'feed' },
      ],
      required: true,
    },
    {
      name: 'minifluxTargetId',
      type: 'text',
      label: 'Miniflux category/feed ID',
      required: true,
    },
    {
      name: 'minifluxTargetKey',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
      },
      unique: true,
    },
    {
      name: 'minifluxTargetTitle',
      type: 'text',
      label: 'Miniflux source name',
    },
    {
      name: 'section',
      type: 'relationship',
      label: 'Panfleto section',
      relationTo: 'sections',
      required: true,
    },
    {
      name: 'defaultAuthor',
      type: 'relationship',
      label: 'Default article author',
      relationTo: 'authors',
      required: true,
    },
    {
      name: 'fetchLimit',
      type: 'number',
      defaultValue: 10,
      max: 15,
      min: 1,
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Enabled',
    },
    {
      name: 'syncNow',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/MinifluxSyncButton',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lastSyncAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            readOnly: true,
          },
        },
        {
          name: 'lastSyncCreated',
          type: 'number',
          admin: {
            readOnly: true,
          },
          defaultValue: 0,
        },
        {
          name: 'lastSyncUpdated',
          type: 'number',
          admin: {
            readOnly: true,
          },
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'lastSyncSkipped',
      type: 'number',
      admin: {
        hidden: true,
        readOnly: true,
      },
      defaultValue: 0,
    },
  ],
  hooks: {
    beforeValidate: [setMinifluxTargetKey],
  },
}
