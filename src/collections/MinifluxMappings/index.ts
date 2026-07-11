import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { adminOnly, adminOrEditor } from '../../access/roles'

const setMinifluxTargetKey: CollectionBeforeValidateHook = ({ data }) => {
  if (data?.sourceType && data?.minifluxTargetId) {
    data.minifluxTargetKey = `${data.sourceType}:${data.minifluxTargetId}`
  }

  if (typeof data?.enabled === 'boolean') {
    data.active = data.enabled
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
      'enabled',
      'lastSynced',
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
      label: 'Miniflux source type',
      options: [
        { label: 'Category', value: 'category' },
        { label: 'Feed', value: 'feed' },
      ],
      required: true,
    },
    {
      name: 'minifluxTargetId',
      type: 'text',
      label: 'Miniflux source',
      admin: {
        components: {
          Field: '@/components/MinifluxSourceSelect',
        },
      },
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
      admin: {
        readOnly: true,
      },
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
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Enabled',
    },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        hidden: true,
        readOnly: true,
      },
      defaultValue: true,
      label: 'Legacy enabled flag',
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
          name: 'lastSynced',
          type: 'date',
          label: 'Last synced',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            readOnly: true,
          },
        },
        {
          name: 'lastSyncAt',
          type: 'date',
          admin: {
            hidden: true,
            readOnly: true,
          },
          label: 'Legacy last sync time',
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
