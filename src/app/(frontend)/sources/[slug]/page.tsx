import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { InfiniteArticleList } from '@/components/Editorial/InfiniteArticleList'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import type { Article } from '@/payload-types'
import { formatEditorialDate, siteName, slugify } from '@/utilities/editorial'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const revalidate = 600

type Args = {
  params: Promise<{ slug: string }>
}

const INITIAL_LIMIT = 12

/**
 * Resolve the raw source title from a slug.
 * We fetch all articles with no select/where to avoid Payload named-tab query
 * issues, then filter in-memory.
 * Payload flattens named-tab fields in returned docs (e.g. doc.minifluxSourceTitle).
 */
async function resolveSourceTitle(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string,
): Promise<string | null> {
  const sample = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 2000,
    overrideAccess: false,
    pagination: false,
  })

  const titles = [
    ...new Set(
      sample.docs
        .map((d) => d.minifluxSourceTitle ?? null)
        .filter((t): t is string => Boolean(t)),
    ),
  ]

  return titles.find((t) => slugify(t) === slug) ?? null
}

export default async function SourcePage({ params }: Args) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const sourceTitle = await resolveSourceTitle(payload, slug)
  if (!sourceTitle) notFound()

  // Fetch ALL articles — no where clause — filter in memory
  const allArticles = await payload.find({
    collection: 'articles',
    depth: 2,
    limit: 2000,
    overrideAccess: false,
    pagination: false,
    sort: '-publishedAt',
  })

  const filtered = allArticles.docs.filter(
    (d) => d.minifluxSourceTitle === sourceTitle,
  ) as Article[]

  const totalDocs = filtered.length
  const articles = filtered.slice(0, INITIAL_LIMIT)
  const hasMore = filtered.length > INITIAL_LIMIT

  const [lead, ...rest] = articles
  const supportStories = rest.slice(0, 3)
  const streamArticles = rest.slice(3)

  const lastArticle = articles[articles.length - 1]
  const initialCursor = hasMore && lastArticle?.publishedAt ? lastArticle.publishedAt : null

  return (
    <div className="source-page ep-container">
      {/* Back link */}
      <Link className="tu-edicion-back-link" href="/sources">
        ← Todas las fuentes
      </Link>

      {/* Source header */}
      <header className="source-page__header">
        <SectionHeading eyebrow="Fuente">{sourceTitle}</SectionHeading>
        <p className="source-page__meta">
          {totalDocs} artículos importados
          {lead?.publishedAt && (
            <>
              {' '}· Último:{' '}
              <time dateTime={lead.publishedAt}>{formatEditorialDate(lead.publishedAt)}</time>
            </>
          )}
        </p>
      </header>

      {lead ? (
        <>
          {/* Lead + side rail layout */}
          <section className="source-front" aria-label="Artículos de esta fuente">
            {/* Lead article */}
            <ArticleCard
              article={lead}
              imageSize="medium"
              priority
              showSummary
              variant="lead"
            />

            {/* Compact support stack */}
            {supportStories.length > 0 && (
              <div className="source-front__stack">
                {supportStories.map((article) => (
                  <ArticleCard
                    article={article}
                    key={article.id}
                    showImage={false}
                    showSummary={false}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Inline stream of remaining initial articles */}
          {streamArticles.length > 0 && (
            <section className="source-river" aria-label="Más artículos">
              <SectionHeading eyebrow="Cronología">Más artículos</SectionHeading>
              <div className="home-river__list">
                {streamArticles.map((article) => (
                  <ArticleCard article={article} key={article.id} variant="stream" />
                ))}
              </div>
            </section>
          )}

          {/* Infinite scroll loads older articles beyond the first page */}
          {hasMore && (
            <section className="source-river" aria-label="Artículos más antiguos">
              <InfiniteArticleList
                initialArticles={[]}
                initialCursor={initialCursor}
                sourceSlug={slug}
                limit={INITIAL_LIMIT}
              />
            </section>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h1>{sourceTitle}</h1>
          <p>No hay artículos importados de esta fuente todavía.</p>
        </div>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const sourceTitle = await resolveSourceTitle(payload, slug)

  if (!sourceTitle) {
    return { title: `No encontrado | ${siteName}` }
  }

  return {
    title: `${sourceTitle} | ${siteName}`,
    description: `Todos los artículos importados desde ${sourceTitle} en ${siteName}.`,
  }
}
