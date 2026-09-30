import { HeaderClient } from './Component.client'
import { isPersonalizedEditionEnabled } from '@/lib/personalized/resolver'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { resolveNavSections } from '@/utilities/navSections'
import React from 'react'

export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const navSections = await resolveNavSections()

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
      sections={navSections}
      showEditionLink={isPersonalizedEditionEnabled()}
    />
  )
}
