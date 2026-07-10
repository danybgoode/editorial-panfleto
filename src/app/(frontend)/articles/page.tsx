import type { Metadata } from 'next/types'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import type { Article } from '@/payload-types'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page() {
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
  })

  return (
    <div className="archive-page ep-container">
      <PageClient />
      <header className="archive-header">
        <SectionHeading eyebrow="Archivo">Todos los artículos</SectionHeading>
        <p>
          {articles.totalDocs > 0
            ? `${articles.totalDocs} artículos publicados`
            : 'Aún no hay artículos publicados.'}
        </p>
      </header>

      <div className="archive-list">
        {(articles.docs as Article[]).map((article) => (
          <ArticleCard article={article} key={article.id} variant="stream" />
        ))}
      </div>

      {articles.totalPages > 1 && articles.page && (
        <Pagination page={articles.page} totalPages={articles.totalPages} />
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    alternates: {
      canonical: '/articles',
    },
    description: 'Archivo completo de artículos publicados en PANFLETO.',
    title: 'Archivo | PANFLETO',
  }
}
