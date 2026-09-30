import { cache } from 'react'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'

import configPromise from '@payload-config'
import type { Section } from '@/payload-types'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { slugify } from '@/utilities/editorial'

export const filterCmsNavSections = (sections: Section[]): Section[] =>
  sections.filter(
    (section) =>
      section.slug?.toLowerCase() !== 'pruebas' && section.name?.toLowerCase() !== 'pruebas',
  )

export const sectionsFromEditionCategories = (categories: string[]): Section[] =>
  categories.map(
    (category, index) =>
      ({
        createdAt: new Date().toISOString(),
        id: index + 1,
        isActive: true,
        name: category,
        slug: slugify(category),
        updatedAt: new Date().toISOString(),
      }) as unknown as Section,
  )

export const resolveNavSections = cache(async (): Promise<Section[]> => {
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

  const navSections = filterCmsNavSections(sections.docs)
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)
  if (!reader) return navSections

  try {
    const loaded = await loadPersonalizedEdition(cookieValue)
    if (loaded?.edition?.sections?.length) {
      return sectionsFromEditionCategories(loaded.edition.sections.map((section) => section.category))
    }
  } catch {
    // Degrade gracefully to payload sections
  }

  return navSections
})
