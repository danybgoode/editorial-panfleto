import Link from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import type { Article } from '@/payload-types'
import {
  articleTypes,
  formatEditorialDate,
  getArticleAuthors,
  getArticleHref,
  getSectionHref,
  getSectionName,
} from '@/utilities/editorial'
import { cn } from '@/utilities/ui'

type ArticleCardProps = {
  article: Article
  className?: string
  imageSize?: 'thumbnail' | 'square' | 'small' | 'medium' | 'large' | 'xlarge'
  priority?: boolean
  showImage?: boolean
  showSummary?: boolean
  variant?: 'lead' | 'compact' | 'feature' | 'stream'
}

export function ArticleCard({
  article,
  className,
  imageSize = 'medium',
  priority,
  showImage = true,
  showSummary = true,
  variant = 'compact',
}: ArticleCardProps) {
  const sectionName = getSectionName(article.section)
  const section =
    article.section && typeof article.section === 'object' ? article.section : undefined
  const href = getArticleHref(article)
  const image = typeof article.featuredImage === 'object' ? article.featuredImage : null
  const byline = getArticleAuthors(article)
  const isOpinion = article.articleType === 'opinion' || article.articleType === 'editorial'

  return (
    <article
      className={cn(
        'editorial-card group',
        variant === 'lead' && 'editorial-card--lead',
        variant === 'feature' && 'editorial-card--feature',
        variant === 'stream' && 'editorial-card--stream',
        className,
      )}
    >
      {showImage && image && (
        <Link
          aria-label={article.headline}
          className="editorial-card__image"
          href={href}
          tabIndex={-1}
        >
          <Media
            imgClassName="h-full w-full object-cover"
            preferredSize={imageSize}
            priority={priority}
            resource={image}
            size={
              variant === 'lead'
                ? '(max-width: 768px) 100vw, 50vw'
                : '(max-width: 768px) 42vw, 22vw'
            }
          />
        </Link>
      )}
      <div className="editorial-card__body">
        <div className="editorial-meta-row">
          {section && (
            <Link className="editorial-kicker" href={getSectionHref(section)}>
              {sectionName}
            </Link>
          )}
          {isOpinion && <span className="editorial-type">{articleTypes[article.articleType]}</span>}
        </div>
        <h2 className="editorial-card__headline">
          <Link href={href}>{article.headline}</Link>
        </h2>
        {showSummary && article.summary && (
          <p className="editorial-card__summary">{article.summary}</p>
        )}
        <div className="editorial-byline">
          {byline && <span>Por {byline}</span>}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>{formatEditorialDate(article.publishedAt)}</time>
          )}
        </div>
      </div>
    </article>
  )
}
