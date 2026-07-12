import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '@/access/roles'
import { link } from '@/fields/link'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
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
          'Optional links shown in the footer information column. Main section links are managed in Editorial / Sections.',
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
