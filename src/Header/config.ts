import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '@/access/roles'
import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: adminOrEditor,
  },
  admin: {
    group: 'Site chrome',
  },
  fields: [
    {
      name: 'sectionNavNotice',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/GlobalSectionNavNotice',
        },
      },
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Supplemental nav items',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        description:
          'Optional links shown after the primary section navigation. Main section links are managed in Editorial / Sections.',
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
