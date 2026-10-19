import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { SectionHeading } from '@/components/Editorial/SectionHeading'
import { siteName, slugify } from '@/utilities/editorial'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const revalidate = 600

export default async function SourcesPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all articles — no where, no select — to avoid Payload named-tab query issues.
  // We filter in-memory for minifluxSourceTitle.
  const sample = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 2000,
    overrideAccess: false,
    pagination: false,
    sort: '-publishedAt',
  })

  // Build a map of sourceTitle → { count, lastPublishedAt }
  const sourceMap = new Map<string, { count: number; lastPublishedAt: string }>()
  for (const doc of sample.docs) {
    const title = doc.minifluxSourceTitle ?? null
    if (!title) continue
    const existing = sourceMap.get(title)
    if (existing) {
      existing.count++
    } else {
      sourceMap.set(title, {
        count: 1,
        lastPublishedAt: doc.publishedAt ?? '',
      })
    }
  }

  const sources = [...sourceMap.entries()]
    .map(([title, { count, lastPublishedAt }]) => ({
      title,
      count,
      lastPublishedAt,
      slug: slugify(title),
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="archive-page ep-container">
      <header className="archive-header">
        <SectionHeading eyebrow="Archivo">Todas las fuentes</SectionHeading>
        <p>
          {sources.length > 0
            ? `${sources.length} fuentes importadas desde Miniflux.`
            : 'No hay fuentes importadas todavía.'}
        </p>
      </header>

      {sources.length > 0 && (
        <ul className="source-index" role="list">
          {sources.map(({ title, count, slug }) => (
            <li className="source-index__item" key={slug}>
              <Link className="source-index__link" href={`/sources/${slug}`}>
                <span className="source-index__title">{title}</span>
                <span className="source-index__count">{count} artículos</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    description: `Todas las fuentes externas importadas en ${siteName}.`,
    title: `Fuentes | ${siteName}`,
  }
}
