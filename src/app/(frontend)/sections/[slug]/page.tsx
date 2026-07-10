import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import type { Article } from '@/payload-types'
import { getSectionHref, siteName } from '@/utilities/editorial'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

export const revalidate = 600

type Args = {
  params: Promise<{
    slug?: string
  }>
  searchParams: Promise<{
    page?: string
  }>
}

const articleSelect = {
  articleType: true,
  author: true,
  coAuthors: true,
  featuredImage: true,
  headline: true,
  populatedAuthors: true,
  publishedAt: true,
  section: true,
  slug: true,
  summary: true,
} as const

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const sections = await payload.find({
    collection: 'sections',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
    where: {
      isActive: {
        equals: true,
      },
    },
  })

  return sections.docs.map(({ slug }) => ({ slug }))
}

export default async function SectionPage({ params, searchParams }: Args) {
  const { slug = '' } = await params
  const { page = '1' } = await searchParams
  const pageNumber = Number(page)

  if (!Number.isInteger(pageNumber) || pageNumber < 1) notFound()

  const payload = await getPayload({ config: configPromise })
  const sectionResult = await payload.find({
    collection: 'sections',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      slug: {
        equals: decodeURIComponent(slug),
      },
    },
  })
  const section = sectionResult.docs[0]

  if (!section || section.isActive === false) notFound()

  const articles = await payload.find({
    collection: 'articles',
    depth: 2,
    limit: 12,
    overrideAccess: false,
    page: pageNumber,
    select: articleSelect,
    sort: '-publishedAt',
    where: {
      section: {
        equals: section.id,
      },
    },
  })

  const [lead, ...rest] = articles.docs as Article[]

  return (
    <div className="section-page ep-container">
      <header className="archive-header section-page__header">
        <SectionHeading eyebrow="Sección">{section.name}</SectionHeading>
        {section.description && <p>{section.description}</p>}
      </header>

      {lead ? (
        <>
          {pageNumber === 1 && (
            <ArticleCard article={lead} imageSize="large" priority showSummary variant="lead" />
          )}
          <div className="archive-list">
            {(pageNumber === 1 ? rest : (articles.docs as Article[])).map((article) => (
              <ArticleCard article={article} key={article.id} variant="stream" />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h1>{section.name}</h1>
          <p>No hay artículos publicados en esta sección todavía.</p>
        </div>
      )}

      {articles.totalPages > 1 && (
        <nav aria-label="Paginación" className="text-pagination">
          {articles.hasPrevPage && (
            <Link href={`${getSectionHref(section)}?page=${pageNumber - 1}`}>Anterior</Link>
          )}
          <span>
            Página {articles.page} de {articles.totalPages}
          </span>
          {articles.hasNextPage && (
            <Link href={`${getSectionHref(section)}?page=${pageNumber + 1}`}>Siguiente</Link>
          )}
        </nav>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = '' } = await params
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'sections',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      slug: {
        equals: decodeURIComponent(slug),
      },
    },
  })
  const section = result.docs[0]

  return {
    alternates: {
      canonical: section ? getSectionHref(section) : '/',
    },
    description: section?.description || `Artículos de ${section?.name || 'sección'} en ${siteName}.`,
    openGraph: {
      description: section?.description || `Artículos de ${section?.name || 'sección'} en ${siteName}.`,
      title: section ? `${section.name} | ${siteName}` : siteName,
      url: section ? getSectionHref(section) : '/',
    },
    title: section ? `${section.name} | ${siteName}` : siteName,
  }
}
