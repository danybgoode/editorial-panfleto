import type { Metadata } from 'next/types'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'
import type { Article } from '@/payload-types'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber)) notFound()

  const articles = await payload.find({
    collection: 'articles',
    depth: 1,
    limit: 12,
    page: sanitizedPageNumber,
    overrideAccess: false,
    sort: '-publishedAt',
  })

  return (
    <div className="archive-page ep-container">
      <PageClient />
      <header className="archive-header">
        <SectionHeading eyebrow="Archivo">Todos los artículos</SectionHeading>
        <p>Página {articles.page} de {articles.totalPages}</p>
      </header>

      <div className="archive-list">
        {(articles.docs as Article[]).map((article) => (
          <ArticleCard article={article} key={article.id} variant="stream" />
        ))}
      </div>

      {articles?.page && articles?.totalPages > 1 && (
        <Pagination page={articles.page} totalPages={articles.totalPages} />
      )}
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `Archivo, página ${pageNumber || ''} | Editorial Panfleto`,
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const { totalDocs } = await payload.count({
    collection: 'articles',
    overrideAccess: false,
  })

  const totalPages = Math.ceil(totalDocs / 10)

  const pages: { pageNumber: string }[] = []

  for (let i = 1; i <= totalPages; i++) {
    pages.push({ pageNumber: String(i) })
  }

  return pages
}
