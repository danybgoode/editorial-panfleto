import { cookies } from 'next/headers'
import { HeaderClient } from './Component.client'
import configPromise from '@payload-config'
import { isPersonalizedEditionEnabled, resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { slugify } from '@/utilities/editorial'
import type { Section } from '@/payload-types'
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

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)

  let navSections = sections.docs.filter(
    (s) => s.slug?.toLowerCase() !== 'pruebas' && s.name?.toLowerCase() !== 'pruebas',
  )

  if (reader) {
    try {
      const loaded = await loadPersonalizedEdition(cookieValue)
      if (loaded?.edition?.sections?.length) {
        navSections = loaded.edition.sections.map((sec, index) => ({
          id: index + 1,
          name: sec.category,
          slug: slugify(sec.category),
          isActive: true,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as unknown as Section))
      }
    } catch {
      // Degrade gracefully to payload sections
    }
  }

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
