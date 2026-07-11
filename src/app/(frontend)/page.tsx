import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { SectionHeading } from '@/components/Editorial/SectionHeading'
import { getTrendingArticles } from '@/lib/trending/ranking'
import type { Article } from '@/payload-types'
import {
  articleTypes,
  formatEditorialDate,
  getArticleHref,
  getSectionHref,
  siteName,
} from '@/utilities/editorial'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-static'
export const revalidate = 600

const articleSelect = {
  articleType: true,
  author: true,
  coAuthors: true,
  featured: true,
  featuredImage: true,
  headline: true,
  populatedAuthors: true,
  publishedAt: true,
  section: true,
  slug: true,
  summary: true,
  trendingMultiplier: true,
  updatedDate: true,
} as const

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  const [featured, latest, breaking, sections, opinion, feature, trending] = await Promise.all([
    payload.find({
      collection: 'articles',
      depth: 2,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      select: articleSelect,
      sort: '-publishedAt',
      where: {
        featured: {
          equals: true,
        },
      },
    }),
    payload.find({
      collection: 'articles',
      depth: 2,
      limit: 12,
      overrideAccess: false,
      pagination: false,
      select: articleSelect,
      sort: '-publishedAt',
    }),
    payload.find({
      collection: 'articles',
      depth: 1,
      limit: 3,
      overrideAccess: false,
      pagination: false,
      select: articleSelect,
      sort: '-publishedAt',
      where: {
        breakingNews: {
          equals: true,
        },
      },
    }),
    payload.find({
      collection: 'sections',
      depth: 0,
      limit: 6,
      overrideAccess: false,
      pagination: false,
      sort: 'displayOrder',
      where: {
        isActive: {
          equals: true,
        },
      },
    }),
    payload.find({
      collection: 'articles',
      depth: 2,
      limit: 4,
      overrideAccess: false,
      pagination: false,
      select: articleSelect,
      sort: '-publishedAt',
      where: {
        articleType: {
          in: ['opinion', 'editorial'],
        },
      },
    }),
    payload.find({
      collection: 'articles',
      depth: 2,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      select: articleSelect,
      sort: '-publishedAt',
      where: {
        articleType: {
          in: ['investigation', 'feature'],
        },
      },
    }),
    getTrendingArticles({ payload, limit: 4 }).catch(() => []),
  ])

  const lead = (featured.docs[0] || latest.docs[0]) as Article | undefined
  const latestWithoutLead = latest.docs.filter((article) => article.id !== lead?.id) as Article[]
  const supportStories = latestWithoutLead.slice(0, 4)
  const latestStream = latestWithoutLead.slice(4, 10)
  const featureStory = feature.docs.find((article) => article.id !== lead?.id) as Article | undefined
  const trendingStories = trending.filter((article) => article.id !== lead?.id).slice(0, 4)

  const sectionModules = await Promise.all(
    sections.docs.slice(0, 4).map(async (section) => {
      const articles = await payload.find({
        collection: 'articles',
        depth: 2,
        limit: 3,
        overrideAccess: false,
        pagination: false,
        select: articleSelect,
        sort: '-publishedAt',
        where: {
          section: {
            equals: section.id,
          },
        },
      })

      return { articles: articles.docs as Article[], section }
    }),
  )

  return (
    <div className="newspaper-home">
      <section className="front-context ep-container" aria-label="Contexto editorial">
        <p>{formatEditorialDate(new Date().toISOString(), { weekday: 'long' })}</p>
        <h1>Noticias, cultura e ideas con criterio editorial.</h1>
        <p>Una portada compacta para leer primero lo importante y seguir el hilo del día.</p>
      </section>

      {breaking.docs.length > 0 && (
        <section aria-label="Última hora" className="breaking-strip ep-container">
          <span>Última hora</span>
          <div>
            {breaking.docs.map((article) => (
              <Link href={getArticleHref(article)} key={article.id}>
                {article.headline}
              </Link>
            ))}
          </div>
        </section>
      )}

      {lead ? (
        <section aria-label="Historia principal" className="lead-package ep-container">
          <ArticleCard
            article={lead}
            imageSize="medium"
            priority
            showSummary
            variant="lead"
          />
          <div className="lead-package__support">
            {supportStories.map((article) => (
              <ArticleCard article={article} key={article.id} showSummary={false} />
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-state ep-container">
          <h1>{siteName}</h1>
          <p>Cuando haya artículos publicados, aparecerán en esta portada.</p>
        </section>
      )}

      {latestStream.length > 0 && (
        <section className="home-river ep-container">
          <SectionHeading eyebrow="Cronología">Últimos artículos</SectionHeading>
          <div className="home-river__list">
            {latestStream.map((article) => (
              <ArticleCard article={article} key={article.id} variant="stream" />
            ))}
          </div>
        </section>
      )}

      {trendingStories.length > 0 && (
        <section className="home-river ep-container">
          <SectionHeading eyebrow="Lecturas">Más leído ahora</SectionHeading>
          <div className="home-river__list">
            {trendingStories.map((article) => (
              <ArticleCard article={article} key={article.id} variant="stream" />
            ))}
          </div>
        </section>
      )}

      {featureStory && (
        <section className="feature-band">
          <div className="ep-container">
            <SectionHeading eyebrow={articleTypes[featureStory.articleType]}>
              Lectura destacada
            </SectionHeading>
            <ArticleCard
              article={featureStory}
              imageSize="medium"
              showSummary
              variant="feature"
            />
          </div>
        </section>
      )}

      {opinion.docs.length > 0 && (
        <section className="opinion-module ep-container">
          <SectionHeading eyebrow="Ideas">Opinión y editorial</SectionHeading>
          <div className="opinion-module__grid">
            {(opinion.docs as Article[]).map((article) => (
              <ArticleCard article={article} key={article.id} showSummary={false} />
            ))}
          </div>
        </section>
      )}

      {sectionModules.some(({ articles }) => articles.length > 0) && (
        <section className="section-modules ep-container">
          {sectionModules.map(({ articles, section }) => {
            if (articles.length === 0) return null

            return (
              <div className="section-module" key={section.id}>
                <SectionHeading>
                  <Link href={getSectionHref(section)}>{section.name}</Link>
                </SectionHeading>
                <div>
                  {articles.map((article) => (
                    <ArticleCard article={article} key={article.id} showSummary={false} />
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    description:
      'PANFLETO publica noticias, opinión, cultura, investigación y ensayo con una mirada literaria y contemporánea.',
    title: siteName,
  }
}
