import type { Metadata } from 'next/types'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { Search } from '@/search/Component'
import PageClient from './page.client'
import type { Article } from '@/payload-types'

type Args = {
  searchParams: Promise<{
    q: string
  }>
}
export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise
  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: 'articles',
    depth: 1,
    limit: 12,
    overrideAccess: false,
    sort: '-publishedAt',
    select: {
      articleType: true,
      author: true,
      coAuthors: true,
      featuredImage: true,
      headline: true,
      populatedAuthors: true,
      publishedAt: true,
      slug: true,
      section: true,
      summary: true,
      meta: true,
    },
    // pagination: false reduces overhead if you don't need totalDocs
    pagination: false,
    ...(query
      ? {
          where: {
            or: [
              {
                headline: {
                  like: query,
                },
              },
              {
                summary: {
                  like: query,
                },
              },
              {
                'meta.description': {
                  like: query,
                },
              },
              {
                slug: {
                  like: query,
                },
              },
            ],
          },
        }
      : {}),
  })

  return (
    <div className="search-page ep-container">
      <PageClient />
      <header className="archive-header">
        <SectionHeading eyebrow="Buscar">Archivo público</SectionHeading>
        <Search />
      </header>

      {articles.totalDocs > 0 ? (
        <div className="archive-list">
          {(articles.docs as Article[]).map((article) => (
            <ArticleCard article={article} key={article.id} variant="stream" />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>{query ? 'No encontramos resultados publicados.' : 'Escribe una palabra para buscar.'}</p>
        </div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    alternates: {
      canonical: '/search',
    },
    robots: {
      follow: true,
      index: false,
    },
    title: 'Buscar | PANFLETO',
  }
}
