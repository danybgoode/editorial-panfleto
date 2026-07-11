import { HeaderClient } from './Component.client'
import configPromise from '@payload-config'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getPayload } from 'payload'
import React from 'react'

export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const payload = await getPayload({ config: configPromise })
  const sections = await payload.find({
    collection: 'sections',
    depth: 0,
    limit: 8,
    overrideAccess: false,
    pagination: false,
    sort: 'displayOrder',
    where: {
      isActive: {
        equals: true,
      },
    },
  })
  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
  }).format(now)

  return (
    <HeaderClient
      data={headerData}
      dateLabel={dateLabel}
      dateTime={now.toISOString()}
      sections={sections.docs}
    />
  )
}
