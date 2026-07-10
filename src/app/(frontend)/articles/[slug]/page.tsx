import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/Editorial/ArticleCard'
import { Media } from '@/components/Media'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import RichText from '@/components/RichText'
import type { Article as ArticleType } from '@/payload-types'
import {
  articleTypes,
  estimateReadingTime,
  formatEditorialDateTime,
  getAbsoluteMediaURL,
  getArticleAuthors,
  getArticleHref,
  getMediaCaption,
  getSectionHref,
  getSectionName,
  siteName,
} from '@/utilities/editorial'
import { generateMeta } from '@/utilities/generateMeta'
import { getServerSideURL } from '@/utilities/getURL'
import configPromise from '@payload-config'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { LivePreviewListener } from '@/components/LivePreviewListener'
import PageClient from './page.client'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const articles = await payload.find({
    collection: 'articles',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return articles.docs.map(({ slug }) => ({ slug }))
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Article({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const url = '/articles/' + decodedSlug
  const article = await queryArticleBySlug({ slug: decodedSlug })

  if (!article) return <PayloadRedirects url={url} />

  const section = article.section && typeof article.section === 'object' ? article.section : null
  const sectionName = getSectionName(article.section)
  const authors = getArticleAuthors(article)
  const heroImage = typeof article.featuredImage === 'object' ? article.featuredImage : null
  const related = article.relatedArticles?.filter((doc) => typeof doc === 'object') || []
  const minutes = estimateReadingTime(article.body)
  const articleURL = `${getServerSideURL()}${getArticleHref(article)}`
  const isOpinion = article.articleType === 'opinion' || article.articleType === 'editorial'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    author: authors ? authors.split(', ').map((name) => ({ '@type': 'Person', name })) : undefined,
    dateModified: article.updatedDate || article.updatedAt,
    datePublished: article.publishedAt,
    description: article.meta?.description || article.summary,
    headline: article.headline,
    image: heroImage ? [getAbsoluteMediaURL(heroImage)] : undefined,
    isAccessibleForFree: true,
    mainEntityOfPage: articleURL,
    publisher: {
      '@type': 'Organization',
      name: siteName,
    },
  }

  return (
    <article className="article-page">
      <PageClient />
      <PayloadRedirects disableNotFound url={url} />
      {draft && <LivePreviewListener />}

      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />

      <header className="article-header ep-container">
        <div className="article-header__meta">
          {section && (
            <Link className="editorial-kicker" href={getSectionHref(section)}>
              {sectionName}
            </Link>
          )}
          {isOpinion && <span className="editorial-type">{articleTypes[article.articleType]}</span>}
        </div>
        <h1>{article.headline}</h1>
        {article.subtitle && <p className="article-dek">{article.subtitle}</p>}
        <div className="article-byline">
          {authors && <span>Por {authors}</span>}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>{formatEditorialDateTime(article.publishedAt)}</time>
          )}
          {article.updatedDate && (
            <time dateTime={article.updatedDate}>
              Actualizado {formatEditorialDateTime(article.updatedDate)}
            </time>
          )}
          <span>{minutes} min de lectura</span>
        </div>
      </header>

      {heroImage && (
        <figure className="article-hero-image ep-container">
          <Media
            imgClassName="h-full w-full object-cover"
            preferredSize="large"
            priority
            resource={heroImage}
            size="(max-width: 1024px) 100vw, 1180px"
          />
          {(heroImage.caption || getMediaCaption(heroImage)) && (
            <figcaption>
              {heroImage.caption && <RichText data={heroImage.caption} enableGutter={false} />}
              {getMediaCaption(heroImage) && <span>{getMediaCaption(heroImage)}</span>}
            </figcaption>
          )}
        </figure>
      )}

      <div className="article-layout ep-container">
        <aside aria-label="Compartir artículo" className="article-share">
          <a href={`mailto:?subject=${encodeURIComponent(article.headline)}&body=${articleURL}`}>
            Email
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              article.headline,
            )}&url=${encodeURIComponent(articleURL)}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            X
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
              articleURL,
            )}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            LinkedIn
          </a>
        </aside>

        <div className="article-body-wrap">
          <RichText data={article.body} enableGutter={false} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="article-related ep-container">
          <h2>Lecturas relacionadas</h2>
          <div className="article-related__grid">
            {related.map((relatedArticle) => (
              <ArticleCard
                article={relatedArticle as ArticleType}
                key={(relatedArticle as ArticleType).id}
                showSummary={false}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const article = await queryArticleBySlug({ slug: decodedSlug })

  return generateMeta({ doc: article })
}

const queryArticleBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'articles',
    depth: 2,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
