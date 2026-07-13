'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type SectionSummary = {
  id: number | string
  name?: string | null
}

const sectionQuery = new URLSearchParams({
  depth: '0',
  limit: '8',
  'where[isActive][equals]': 'true',
  sort: 'displayOrder',
})

export const GlobalSectionNavNotice: React.FC = () => {
  const [sections, setSections] = useState<SectionSummary[]>([])

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/sections?${sectionQuery.toString()}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return

        const result = await response.json()
        setSections(Array.isArray(result.docs) ? result.docs : [])
      })
      .catch(() => undefined)

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 8,
        marginBlockEnd: '1rem',
        padding: '0.85rem 1rem',
      }}
    >
      <h3 style={{ fontSize: '1rem', margin: '0 0 0.35rem' }}>Primary section navigation</h3>
      <p style={{ color: 'var(--theme-elevation-600)', fontSize: '0.9rem', margin: 0 }}>
        The main newspaper links in the header and footer come from active items in Editorial /
        Sections. Use the list below only for supplemental links.
      </p>
      <Link
        href="/admin/collections/sections"
        style={{
          display: 'inline-block',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBlockStart: '0.65rem',
        }}
      >
        Open Sections
      </Link>
      {sections.length > 0 && (
        <p style={{ fontSize: '0.9rem', margin: '0.65rem 0 0' }}>
          Current sections: {sections.map((section) => section.name).filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  )
}

export default GlobalSectionNavNotice
